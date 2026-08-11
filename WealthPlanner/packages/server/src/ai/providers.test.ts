import { describe, expect, it, vi } from "vitest";
import { createProvider } from "./providers";
import type { AiCompletionRequest } from "./providers";

function mockFetchOk(status = 200, body: unknown = {}) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

function request(overrides: Partial<AiCompletionRequest> = {}): AiCompletionRequest {
  return {
    system: "sys",
    user: "user",
    model: "test-model",
    apiKey: "sk-test",
    ...overrides,
  };
}

describe("AI providers", () => {
  it("openai adapter parses a chat completion response", async () => {
    const fetchFn = mockFetchOk(200, {
      choices: [{ message: { content: "Hello from OpenAI" } }],
    });
    const provider = createProvider("OPENAI", fetchFn as typeof fetch);
    const text = await provider.generate(request());
    expect(text).toBe("Hello from OpenAI");

    const call = fetchFn.mock.calls[0];
    expect(call[0]).toBe("https://api.openai.com/v1/chat/completions");
    const init = call[1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: "Bearer sk-test" });
  });

  it("openai adapter throws on non-2xx", async () => {
    const provider = createProvider("OPENAI", mockFetchOk(401) as typeof fetch);
    await expect(provider.generate(request())).rejects.toThrow(/401/);
  });

  it("anthropic adapter uses the Messages API shape and parses text blocks", async () => {
    const fetchFn = mockFetchOk(200, {
      content: [{ type: "text", text: "Anthropic answer" }],
    });
    const provider = createProvider("ANTHROPIC", fetchFn as typeof fetch);
    const text = await provider.generate(request());
    expect(text).toBe("Anthropic answer");

    const call = fetchFn.mock.calls[0];
    expect(call[0]).toBe("https://api.anthropic.com/v1/messages");
    const init = call[1] as RequestInit;
    expect(init.headers).toMatchObject({ "x-api-key": "sk-test", "anthropic-version": "2023-06-01" });
  });

  it("custom endpoint requires a base URL", async () => {
    const provider = createProvider("CUSTOM", mockFetchOk() as typeof fetch);
    await expect(provider.generate(request())).rejects.toThrow(/base URL/);
  });

  it("custom endpoint posts to baseUrl/v1/chat/completions", async () => {
    const fetchFn = mockFetchOk(200, { choices: [{ message: { content: "hi" } }] });
    const provider = createProvider("CUSTOM", fetchFn as typeof fetch);
    await provider.generate(request({ baseUrl: "https://my-gateway.example" }));
    expect(fetchFn.mock.calls[0][0]).toBe("https://my-gateway.example/v1/chat/completions");
  });
});
