// AI Insights screen (docs/16, Phase 7). Bring-your-own-key: the user attaches
// their own LLM provider (Anthropic / OpenAI / custom OpenAI-compatible
// endpoint), and the app generates plain-language commentary from the plan's
// already-computed numbers. The API key is encrypted at rest on the server and
// is never returned to the client — only the last four characters are shown.
// Generation happens only on an explicit button press.

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type AiSettings,
  type AiInsight,
  type AiProvider,
  type InsightType,
} from "./api";

const INSIGHT_LABELS: Record<InsightType, string> = {
  PLAN_SUMMARY: "Plan summary",
  MONTE_CARLO_INTERPRETATION: "Monte Carlo interpretation",
  SENSITIVITY_SCENARIO_EXPLANATION: "Sensitivity / scenario explanation",
  GOAL_PROGRESS_NARRATIVE: "Goal progress narrative",
  ACTION_ITEMS_PRIORITIZATION: "Action items prioritization",
};

export function AiInsightsPanel({
  planId,
  locale = "en-IN",
}: {
  planId: string;
  locale?: string;
}) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [generating, setGenerating] = useState<InsightType | null>(null);

  // Settings form fields.
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<AiProvider>("ANTHROPIC");
  const [model, setModel] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const [s, list] = await Promise.all([api.getAiSettings(), api.listInsights(planId)]);
    setSettings(s);
    setInsights(list);
    if (s) {
      setEnabled(s.enabled);
      setProvider(s.provider);
      setModel(s.model);
      setCustomBaseUrl(s.customBaseUrl ?? "");
    }
  }, [planId]);

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [load]);

  const save = async () => {
    setMsg(null);
    setErr(null);
    const saved = await api.putAiSettings({
      enabled,
      provider,
      model,
      customBaseUrl: provider === "CUSTOM" && customBaseUrl ? customBaseUrl : undefined,
      apiKey,
    });
    setSettings(saved);
    setApiKey("");
    setMsg("Settings saved.");
  };

  const test = async () => {
    setMsg(null);
    setErr(null);
    await api.testAiConnection({
      provider,
      model,
      customBaseUrl: provider === "CUSTOM" && customBaseUrl ? customBaseUrl : undefined,
      apiKey,
    });
    setMsg("Connection OK.");
  };

  const disable = async () => {
    setMsg(null);
    setErr(null);
    await api.deleteAiSettings();
    setSettings(null);
    setEnabled(false);
    setApiKey("");
    setMsg("AI Insights disabled.");
  };

  const generate = async (type: InsightType) => {
    setGenerating(type);
    setMsg(null);
    setErr(null);
    try {
      const insight = await api.generateInsight(planId, { insightType: type });
      setInsights((prev) => [...prev, insight]);
      setMsg("Insight generated.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(null);
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">AI Insights</h3>
      </div>
      <p className="muted">
        Bring your own LLM API key to get plain-language commentary on your already-computed
        numbers. Your key is encrypted on this device and is never shared with us.
      </p>

      {err && <p className="error">{err}</p>}
      {msg && <p className="muted">{msg}</p>}

      <h4>Connection</h4>
      {settings ? (
        <p className="card-body">
          Configured: {settings.provider} · model {settings.model} · key ending in{" "}
          <strong>{settings.keyLastFour}</strong> · {settings.enabled ? "enabled" : "disabled"}.
        </p>
      ) : (
        <p className="muted">
          Not configured yet. Enter your provider details below.
        </p>
      )}

      <div className="form-stack" style={{ maxWidth: 460 }}>
        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "0.4rem" }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
        </label>
        <label className="field">
          Provider
          <select className="input" value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)}>
            <option value="ANTHROPIC">Anthropic</option>
            <option value="OPENAI">OpenAI</option>
            <option value="CUSTOM">Custom (OpenAI-compatible)</option>
          </select>
        </label>
        <label className="field">
          Model
          <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4o-mini" />
        </label>
        {provider === "CUSTOM" && (
          <label className="field">
            Base URL
            <input className="input" value={customBaseUrl} onChange={(e) => setCustomBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
          </label>
        )}
        <label className="field">
          API key
          <input
            className="input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={settings ? "Leave blank to keep current key" : "Paste your API key"}
          />
        </label>
        <div className="row">
          <button onClick={save} className="btn">Save settings</button>
          <button onClick={test} className="btn secondary">Test connection</button>
          {settings && (
            <button onClick={disable} className="btn danger">
              Disable
            </button>
          )}
        </div>
      </div>

      <h4 style={{ marginTop: "1rem" }}>Generate</h4>
      <div className="row">
        {(Object.keys(INSIGHT_LABELS) as InsightType[]).map((type) => (
          <button
            key={type}
            onClick={() => generate(type)}
            disabled={generating !== null}
            className="btn secondary"
          >
            {generating === type ? "Generating…" : INSIGHT_LABELS[type]}
          </button>
        ))}
      </div>

      {insights.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h4>Stored insights</h4>
          {insights.map((ins) => (
            <article
              key={ins.id}
              className="card"
              style={{ marginTop: "0.5rem", padding: "0.75rem 1rem", boxShadow: "none" }}
            >
              <strong>{INSIGHT_LABELS[ins.insightType] ?? ins.insightType}</strong>{" "}
              <span className="hint">
                {ins.provider} · {new Date(ins.generatedAt).toLocaleString(locale)}
              </span>
              <p style={{ whiteSpace: "pre-wrap", margin: "0.5rem 0 0", color: "#333" }}>
                {ins.generatedText}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
