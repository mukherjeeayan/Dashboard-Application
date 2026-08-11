// Provider-agnostic AI interface (docs/16 §16.2). The rest of the app only
// ever talks to an `AiProvider`; adding a provider is a new adapter, not a
// change to any screen or the insight service.

export type AiProviderKind = "ANTHROPIC" | "OPENAI" | "CUSTOM";

export interface AiCompletionRequest {
  /** System-level instructions (the insight template). */
  system: string;
  /** The specific context/numbers for this insight. */
  user: string;
  model: string;
  apiKey: string;
  /** Provider-specific; the custom adapter forwards this as the base URL. */
  baseUrl?: string;
}

export interface AiProvider {
  /** Issues a single chat completion and returns the assistant text. */
  generate(request: AiCompletionRequest): Promise<string>;
  /** Makes one minimal request to confirm the key/model work (Settings → Test). */
  test(request: Omit<AiCompletionRequest, "user" | "system">): Promise<void>;
}
