// Custom / OpenAI-compatible endpoint adapter (docs/16 §16.2). Reuses the
// OpenAI wire format but against a user-supplied base URL, so self-hosted or
// third-party gateways (Ollama, Azure OpenAI, OpenRouter) work with no bespoke
// integration. `baseUrl` is required (it's what the user configures).

import type { AiCompletionRequest, AiProvider } from "./types";

export function createCustomEndpointProvider(fetchFn: typeof fetch = fetch): AiProvider {
  function resolveUrl(request: AiCompletionRequest): string {
    const base = request.baseUrl?.replace(/\/$/, "");
    if (!base) throw new Error("Custom endpoint requires a base URL.");
    return `${base}/v1/chat/completions`;
  }

  async function call(request: AiCompletionRequest): Promise<Response> {
    return fetchFn(resolveUrl(request), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
      }),
    });
  }

  return {
    async generate(request) {
      const res = await call(request);
      if (!res.ok) throw new Error(`Custom endpoint request failed (${res.status})`);
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("Custom endpoint returned no text.");
      return text;
    },
    async test(request) {
      const res = await call({ ...request, system: "ping", user: "Reply with OK." });
      if (!res.ok) throw new Error(`Custom endpoint connection failed (${res.status})`);
    },
  };
}
