// Provider factory (docs/16 §16.2). Returns the adapter for a configured
// provider kind, mirroring how the loader picks a Jurisdiction Pack by id.

import type { AiProvider, AiProviderKind } from "./types";
import { createAnthropicProvider } from "./anthropic";
import { createOpenAIProvider } from "./openai";
import { createCustomEndpointProvider } from "./customEndpoint";

export type { AiProvider, AiProviderKind, AiCompletionRequest } from "./types";

export function createProvider(kind: AiProviderKind, fetchFn: typeof fetch = fetch): AiProvider {
  switch (kind) {
    case "ANTHROPIC":
      return createAnthropicProvider(fetchFn);
    case "OPENAI":
      return createOpenAIProvider(fetchFn);
    case "CUSTOM":
      return createCustomEndpointProvider(fetchFn);
  }
}
