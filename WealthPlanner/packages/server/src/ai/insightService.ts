// AI Insights orchestration (docs/16 §16.3, §16.5–§16.6). Loads the active
// provider config, decrypts the stored key, builds the minimal context payload
// for the requested insight type, calls the provider, and persists the result.
// The server only ever calls a provider from here, and only on an explicit
// generate request — never from a background job or scheduled task.

import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { aiSettings, aiInsights } from "../db/schema";
import type { InsightType } from "./promptTemplates";
import { buildSystemPrompt, buildUserPrompt } from "./promptTemplates";
import { buildInsightContext } from "./context";
import { createProvider, type AiProviderKind } from "./providers";
import { decryptValue, loadOrCreateSecret } from "./secret";
import { HttpError } from "../api/errors";
import { createHash } from "node:crypto";

export interface GenerateInsightInput {
  planId: string;
  insightType: InsightType;
  /** Extra already-computed numbers for context (e.g. a Monte Carlo run). */
  context?: Record<string, unknown>;
}

export interface GeneratedInsight {
  id: string;
  planId: string;
  insightType: InsightType;
  generatedText: string;
  provider: string;
  model: string | null;
  generatedAt: string;
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/** Generates and stores one insight. Throws if AI is not configured/enabled. */
export async function generateInsight(
  db: Db,
  input: GenerateInsightInput,
  options: { fetchFn?: typeof fetch; secretPath?: string } = {},
): Promise<GeneratedInsight> {
  const fetchFn = options.fetchFn ?? fetch;
  const secretPath = options.secretPath;
  const [settings] = db.select().from(aiSettings).limit(1).all();
  if (!settings || !settings.enabled || !settings.provider || !settings.encryptedApiKey) {
    throw new HttpError(400, "AI Insights is not configured. Open Settings → AI Insights to enable it.", "AI_NOT_CONFIGURED");
  }

  const secret = loadOrCreateSecret(secretPath);
  const apiKey = decryptValue(secret, JSON.parse(settings.encryptedApiKey) as {
    iv: string;
    tag: string;
    data: string;
  });

  const context = await buildInsightContext(db, input.planId, input.insightType, input.context);
  const system = buildSystemPrompt(input.insightType);
  const user = buildUserPrompt(input.insightType, context);
  const sourceDataHash = hashPayload({ system, user });

  const provider = createProvider(settings.provider as AiProviderKind, fetchFn);
  const text = await provider.generate({
    system,
    user,
    model: settings.model ?? defaultModel(settings.provider),
    apiKey,
    baseUrl: settings.provider === "CUSTOM" ? (settings.customBaseUrl ?? undefined) : undefined,
  });

  const id = `${input.insightType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const generatedAt = new Date().toISOString();
  db.insert(aiInsights)
    .values({
      id,
      planId: input.planId,
      insightType: input.insightType,
      sourceDataHash,
      generatedText: text,
      provider: settings.provider,
      model: settings.model ?? null,
      generatedAt,
    })
    .run();

  const insight: GeneratedInsight = {
    id,
    planId: input.planId,
    insightType: input.insightType,
    generatedText: text,
    provider: settings.provider,
    model: settings.model ?? null,
    generatedAt,
  };
  return insight;
}

function defaultModel(kind: string): string {
  switch (kind) {
    case "ANTHROPIC":
      return "claude-3-5-haiku-latest";
    case "OPENAI":
      return "gpt-4o-mini";
    default:
      return "default";
  }
}

/** Lists stored insights for a plan (for replay after reload). */
export function listInsights(db: Db, planId: string): GeneratedInsight[] {
  const rows = db
    .select()
    .from(aiInsights)
    .where(eq(aiInsights.planId, planId))
    .orderBy(aiInsights.generatedAt)
    .all();
  return rows.map((r) => ({
    id: r.id,
    planId: r.planId,
    insightType: r.insightType as InsightType,
    generatedText: r.generatedText,
    provider: r.provider,
    model: r.model,
    generatedAt: r.generatedAt,
  }));
}
