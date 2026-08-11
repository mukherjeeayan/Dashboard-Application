// Anthropic Messages API adapter (docs/16 §16.2). Uses fetch (Node >=20 global)
// against api.anthropic.com; no vendor SDK, so the adapter is trivially mocked
// in tests by stubbing the injected `fetch`/base URL.

import type { AiCompletionRequest, AiProvider } from "./types";

const DEFAULT_BASE_URL = "https://api.anthropic.com";

export function createAnthropicProvider(fetchFn: typeof fetch = fetch): AiProvider {
  async function call(request: AiCompletionRequest): Promise<Response> {
    const url = `${request.baseUrl ?? DEFAULT_BASE_URL}/v1/messages`;
    return fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": request.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: 1024,
        system: request.system,
        messages: [{ role: "user", content: request.user }],
      }),
    });
  }

  return {
    async generate(request) {
      const res = await call(request);
      if (!res.ok) throw new Error(`Anthropic request failed (${res.status})`);
      const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
      const text = (data.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("");
      if (!text) throw new Error("Anthropic returned no text.");
      return text;
    },
    async test(request) {
      const res = await call({ ...request, system: "ping", user: "Reply with OK." });
      if (!res.ok) throw new Error(`Anthropic connection failed (${res.status})`);
    },
  };
}
