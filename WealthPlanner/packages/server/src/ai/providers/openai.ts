// OpenAI Chat Completions adapter (docs/16 §16.2). fetch-based, no vendor SDK.

import type { AiCompletionRequest, AiProvider } from "./types";

const DEFAULT_BASE_URL = "https://api.openai.com";

export function createOpenAIProvider(fetchFn: typeof fetch = fetch): AiProvider {
  async function call(request: AiCompletionRequest): Promise<Response> {
    const url = `${request.baseUrl ?? DEFAULT_BASE_URL}/v1/chat/completions`;
    return fetchFn(url, {
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
      if (!res.ok) throw new Error(`OpenAI request failed (${res.status})`);
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("OpenAI returned no text.");
      return text;
    },
    async test(request) {
      const res = await call({ ...request, system: "ping", user: "Reply with OK." });
      if (!res.ok) throw new Error(`OpenAI connection failed (${res.status})`);
    },
  };
}
