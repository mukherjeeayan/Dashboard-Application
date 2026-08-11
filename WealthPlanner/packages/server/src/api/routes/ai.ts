// AI Insights routes (docs/16 §16.3, §16.7). Settings are stored single-row
// and the API key is encrypted at rest; the decrypted key is never returned by
// any endpoint. Generation happens only on an explicit POST.

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import type { Db } from "../../db";
import { aiSettings } from "../../db/schema";
import { HttpError, validateOrThrow } from "../errors";
import { guardPlan } from "./helpers";
import { encryptValue, loadOrCreateSecret } from "../../ai/secret";
import { generateInsight, listInsights } from "../../ai/insightService";
import { createProvider } from "../../ai/providers";
import { z } from "zod";

const AiSettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(["ANTHROPIC", "OPENAI", "CUSTOM"]),
  model: z.string().min(1),
  customBaseUrl: z.string().url().optional(),
  apiKey: z.string().min(1),
});

const AiSettingsPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    provider: z.enum(["ANTHROPIC", "OPENAI", "CUSTOM"]).optional(),
    model: z.string().min(1).optional(),
    customBaseUrl: z.string().url().optional(),
    apiKey: z.string().min(1).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field required" });

const GenerateInsightSchema = z.object({
  insightType: z.enum([
    "PLAN_SUMMARY",
    "MONTE_CARLO_INTERPRETATION",
    "SENSITIVITY_SCENARIO_EXPLANATION",
    "GOAL_PROGRESS_NARRATIVE",
    "ACTION_ITEMS_PRIORITIZATION",
  ]),
  context: z.record(z.unknown()).optional(),
});

const TestSchema = z.object({
  provider: z.enum(["ANTHROPIC", "OPENAI", "CUSTOM"]),
  model: z.string().min(1),
  customBaseUrl: z.string().url().optional(),
  apiKey: z.string().min(1),
});

export function registerAiRoutes(
  app: FastifyInstance,
  db: Db,
  options: { fetchFn?: typeof fetch; secretPath?: string } = {},
): void {
  const fetchFn = options.fetchFn ?? fetch;
  const secretPath = options.secretPath;

  // Settings are global (single row), not per-plan.
  app.get("/ai-settings", async (_req, reply) => {
    const [row] = db.select().from(aiSettings).limit(1).all();
    if (!row) return reply.send(null);
    return reply.send({
      enabled: row.enabled,
      provider: row.provider,
      model: row.model,
      customBaseUrl: row.customBaseUrl,
      keyLastFour: row.keyLastFour,
    });
  });

  app.put<{ Body: unknown }>("/ai-settings", async (req, reply) => {
    const body = validateOrThrow(AiSettingsSchema, req.body);
    const secret = loadOrCreateSecret(secretPath);
    const encrypted = encryptValue(secret, body.apiKey);
    const id = "ai-settings";
    const updatedAt = new Date().toISOString();

    db.insert(aiSettings)
      .values({
        id,
        enabled: body.enabled,
        provider: body.provider,
        model: body.model,
        customBaseUrl: body.customBaseUrl,
        encryptedApiKey: JSON.stringify(encrypted),
        keyLastFour: body.apiKey.slice(-4),
        updatedAt,
      })
      .onConflictDoUpdate({
        target: aiSettings.id,
        set: {
          enabled: body.enabled,
          provider: body.provider,
          model: body.model,
          customBaseUrl: body.customBaseUrl,
          encryptedApiKey: JSON.stringify(encrypted),
          keyLastFour: body.apiKey.slice(-4),
          updatedAt,
        },
      })
      .run();

    return reply.send({
      enabled: body.enabled,
      provider: body.provider,
      model: body.model,
      customBaseUrl: body.customBaseUrl,
      keyLastFour: body.apiKey.slice(-4),
    });
  });

  app.patch<{ Body: unknown }>("/ai-settings", async (req, reply) => {
    const body = validateOrThrow(AiSettingsPatchSchema, req.body);
    const [existing] = db.select().from(aiSettings).limit(1).all();
    if (!existing) throw new HttpError(404, "AI settings not found", "NOT_FOUND");

    const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.enabled !== undefined) set.enabled = body.enabled;
    if (body.provider !== undefined) set.provider = body.provider;
    if (body.model !== undefined) set.model = body.model;
    if (body.customBaseUrl !== undefined) set.customBaseUrl = body.customBaseUrl;
    if (body.apiKey !== undefined) {
      const encrypted = encryptValue(loadOrCreateSecret(secretPath), body.apiKey);
      set.encryptedApiKey = JSON.stringify(encrypted);
      set.keyLastFour = body.apiKey.slice(-4);
    }

    db.update(aiSettings).set(set).where(eq(aiSettings.id, existing.id)).run();

    const [row] = db.select().from(aiSettings).where(eq(aiSettings.id, existing.id)).limit(1).all();
    return reply.send({
      enabled: row.enabled,
      provider: row.provider,
      model: row.model,
      customBaseUrl: row.customBaseUrl,
      keyLastFour: row.keyLastFour,
    });
  });

  app.delete("/ai-settings", async (_req, reply) => {
    const [existing] = db.select().from(aiSettings).limit(1).all();
    if (existing) db.delete(aiSettings).where(eq(aiSettings.id, existing.id)).run();
    return reply.code(204).send();
  });

  // Test the connection without persisting settings.
  app.post<{ Body: unknown }>("/ai/test", async (req, reply) => {
    const body = validateOrThrow(TestSchema, req.body);
    const provider = createProvider(body.provider, fetchFn);
    await provider.test({
      apiKey: body.apiKey,
      model: body.model,
      baseUrl: body.provider === "CUSTOM" ? body.customBaseUrl : undefined,
    });
    return reply.send({ ok: true });
  });

  // List stored insights for a plan (replay after reload).
  app.get<{ Params: { planId: string } }>("/plans/:planId/insights", async (req, reply) => {
    guardPlan(db, req.params.planId);
    return reply.send(listInsights(db, req.params.planId));
  });

  // Explicit, on-demand generation.
  app.post<{ Params: { planId: string }; Body: unknown }>(
    "/plans/:planId/insights/generate",
    async (req, reply) => {
      const planId = req.params.planId;
      guardPlan(db, planId);
      const body = validateOrThrow(GenerateInsightSchema, req.body);
      const insight = await generateInsight(
        db,
        { planId, insightType: body.insightType, context: body.context },
        { fetchFn, secretPath },
      );
      return reply.send(insight);
    },
  );
}
