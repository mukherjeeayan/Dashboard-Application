# 16. AI Insights (BYOK)

A fully optional, **off-by-default** feature that lets the user attach
their own LLM API key to generate natural-language commentary on their
own plan — a "financially literate friend reading your numbers," not an
automated advisor. This is the one deliberate, explicit exception to "no
internet dependency after installation" (`01-product-overview.md` §1.1),
and it is designed so that exception stays narrow, visible, and entirely
under the user's control.

This feature is part of the complete v1.0 scope, built in its own gated
phase (`10-implementation-plan.md` Phase 7, `11-task-list.md` Phase 7) —
it is layered strictly on top of everything else described in `01`–`13`,
but it is not optional polish to pick up only if time remains; the
v1.0.0 release is not cut until this doc's requirements are met.

**BYOK** = **B**ring **Y**our **O**wn **K**ey. WealthPath never operates,
proxies through, or pays for any LLM service itself. The user supplies an
API key for a provider they already have an account with; WealthPath's
local server calls that provider directly, using that key, only when the
user explicitly triggers an insight. There is no WealthPath-hosted AI
service, no bundled key, and no default-on behavior.

## 16.1 Design principles

1. **Off by default.** A fresh install has AI Insights disabled. The
   feature only activates once a user opens Settings → AI Insights and
   enters a key.
2. **The user's key, the user's cost, the user's provider.** WealthPath
   does not mark up, meter, or intermediate billing in any way — API
   usage is billed directly by the provider to the user's own account.
3. **Explicit trigger, every time.** Like the workbook's own Monte Carlo
   macros, generating an insight is a deliberate, on-demand action (an
   "✨ Generate Insight" button), never a background/automatic call — no
   silent network activity, ever, even with a key configured.
4. **Minimal, disclosed payload.** Exactly what data is about to be sent
   to the provider is shown to the user before the first call in a given
   session (a one-time-per-session confirmation, not a nag on every
   click) — see §16.6.
5. **Advisory language, not directive language, and never execution.**
   Generated text explains and contextualizes; it never issues a
   buy/sell/contribute instruction as if it were the app's own advice,
   and it can never take an action on the user's data (read-only feature
   — see §16.8). The existing "no investment advice" disclaimer
   (`01-` §1.5) applies to AI Insights output at least as strongly as to
   the rest of the app, and every AI-generated panel is visually labeled
   as AI-generated.
6. **Provider-agnostic.** The client code is written against one small
   internal interface, not a specific vendor's SDK, so adding a new
   supported provider is a config/adapter change, not an architecture
   change — directly mirroring the Jurisdiction Pack philosophy in
   `05-jurisdiction-tax-framework.md`: provider specifics are data/config,
   not hardcoded branches.

## 16.2 Supported providers (v1.0)

| Provider | API | Notes |
|---|---|---|
| Anthropic | Messages API (`api.anthropic.com`) | Default/first-class option |
| OpenAI | Chat Completions / Responses API (`api.openai.com`) | |
| Custom / OpenAI-compatible endpoint | User-supplied base URL + key | Covers self-hosted or third-party OpenAI-compatible gateways (e.g. a local Ollama instance, Azure OpenAI, OpenRouter) without a bespoke integration per vendor |

Each provider is implemented as a small adapter behind one internal
`AiProvider` interface (`generateInsight(prompt, context) => text`), so
the rest of the app never branches on which provider is active. Adding a
fourth provider later is a new adapter file, not a change to any screen
or engine module.

## 16.3 Where this fits in the architecture (extends `03-architecture.md`)

```
 packages/
   engine/            # unchanged — AI Insights never influences a computed number
   jurisdictions/      # unchanged
   server/
     ai/                # NEW — provider adapters, prompt templates, insight orchestration
       providers/
         anthropic.ts
         openai.ts
         customEndpoint.ts
       promptTemplates.ts   # one template per insight type, §16.5
       insightService.ts    # builds context payload, calls active provider, stores result
   client/
     (Settings → AI Insights screen; "Generate Insight" affordances per §16.7)
```

- `packages/engine` and `packages/jurisdictions` **never** import anything
  from `packages/server/ai` and are never modified by this feature — this
  keeps the calculation engine's "pure functions of (inputs, jurisdiction
  pack) → outputs" property (`03-` §3.3) intact. AI Insights is strictly a
  presentation-layer add-on that *reads* already-computed results; it
  never feeds back into a calculation.
- The server only calls out to a provider from `packages/server/ai`, on
  an explicit `POST /api/ai-insights/generate` request — never from a
  background job, a scheduled task, or as a side effect of any other
  route.
- The API key is never sent to or through any WealthPath-operated
  infrastructure (there isn't any) — the local server process calls the
  provider's API directly from the user's own machine, exactly the same
  network trust boundary as the browser calling `localhost` today.

## 16.4 Key storage & security

- The API key is entered once in Settings → AI Insights and stored
  **locally**, in the same SQLite file as everything else
  (`08-data-model-and-storage.md` §8.1) — never in plaintext in the
  database file: it is encrypted at rest using a key derived from a
  per-install secret generated on first run and stored in the
  OS-appropriate app-data directory alongside the SQLite file (Node's
  built-in `crypto` module, AES-256-GCM — no new heavy dependency).
- The key is **never** included in any log line, error report, or the
  "Export Plan" backup (`08-` §8.5) — the export explicitly excludes the
  `ai_settings` table (§16.9) so a shared/backed-up export file can never
  leak a credential.
- The key is only ever transmitted over the network in one place: the
  outbound HTTPS request from the local server process to the configured
  provider's own API endpoint. It is never sent to the client/browser in
  a readable form after initial entry (the Settings screen shows a
  masked value, e.g. `sk-••••••••1234`, once saved).
- A **Remove Key** action in Settings immediately deletes the stored
  credential and disables the feature; this is a hard requirement, not a
  nice-to-have — a user must always be able to fully and immediately
  revert to the fully-offline product.

## 16.5 What insights are generated

Each is a distinct, user-triggered action producing a short (a few
paragraphs at most), plainly-labeled "AI Insight" panel adjacent to the
relevant dashboard — never replacing the underlying numbers, always
alongside them:

| Insight type | Triggered from | What it does |
|---|---|---|
| Plan summary | Overview | Plain-language narrative of current wealth, net worth, and portfolio risk posture |
| Monte Carlo interpretation | Monte Carlo screen, after a run completes | Explains what the probability-of-success figure and P10/P50/P90 spread practically mean for this plan, in plain language |
| Sensitivity/scenario explanation | Sensitivity Matrix, Scenario Analysis | Narrates which assumptions the plan is most sensitive to and why, based on the already-computed grid/scenario numbers |
| Goal progress narrative | Goals | Summarizes which goals are on-track vs. short-falling and by roughly how much, in plain language |
| Action Items prioritization commentary | Action Items | Suggests a reasonable order to tackle the already-computed action items list — commentary on existing flags, not a new source of flags |

Every insight is generated **from already-computed WealthPath output**
(numbers the engine already produced) — the LLM is never asked to
perform or check arithmetic itself, and its output is never written back
into any computed field. This keeps the correctness guarantees in
`06-financial-calculation-engine.md`/`07-monte-carlo-engine.md`/
`12-testing-strategy.md` completely unaffected by whether AI Insights is
enabled.

## 16.6 What data is sent to the provider

Exactly the numbers already shown on the screen the user clicked
"Generate Insight" from — e.g. the Monte Carlo interpretation sends that
run's `resultSummary` (`07-` §7.5) and the plan's horizon/currency, not
the user's full account list, balances, or any personally-identifying
detail beyond what's unavoidably implied by the numbers themselves (no
name, no account numbers, no holder names). The exact JSON payload for
the insight type being generated is shown in an expandable "What gets
sent" disclosure on the confirmation dialog (§16.1 point 4) — never
hidden or only available in documentation.

## 16.7 UI surface (extends `09-ui-ux-spec.md`)

- **Settings → AI Insights** (new nav section — `09-` §9.1's 7th nav
  section, not overloading the existing "Setup" section which is
  plan-data-entry, not app configuration): provider selector, API key
  entry (masked, with a **Test Connection** button that makes one
  minimal, free/near-free request to confirm the key works before
  saving), model selection where the provider offers more than one,
  enable/disable toggle, **Remove Key** action.
- Every screen listed in §16.5's table gets one small, clearly-labeled
  **"✨ Generate Insight"** button. If AI Insights is disabled/not
  configured, the button is still visible but shows a tooltip/short
  explainer linking to Settings → AI Insights, rather than being hidden —
  so users discover the feature exists without it being pushed on them.
- Generated insight panels are visually distinct (a clearly different
  background/border treatment, an "✨ AI-generated" label, and a
  timestamp) from every other panel in the app, so there is never any
  ambiguity about which numbers are engine-computed (`09-` §9.2's
  read-only computed panels) and which text is LLM-generated commentary.

## 16.8 Non-goals / guardrails for this feature

- **No automated or scheduled generation.** Every call is a direct result
  of a click in the current session.
- **No write access.** The AI Insights service is strictly read-only
  against the plan; it cannot create, edit, or delete any account, goal,
  liability, or assumption, and no prompt-injection surface (e.g. a
  crafted account label) can be escalated into a write, because the
  service has no write capability to escalate into in the first place.
- **No chat/open-ended interface in v1.0.** Insights are structured,
  templated (§16.5), single-shot generations tied to a specific
  dashboard's already-computed data — not a free-form chat box the user
  can ask arbitrary questions in. This keeps the payload sent to the
  provider bounded and predictable (§16.6) rather than open-ended.
- **No plan data sent anywhere unless the feature is both configured and
  explicitly triggered.** This is the same guarantee `01-` §1.1/§1.5
  already make for the rest of the app, extended explicitly to this one
  new surface rather than quietly weakened by it.

## 16.9 Data model additions (extends `08-data-model-and-storage.md` §8.2)

```typescript
// packages/server/db/schema.ts additions

export const aiSettings = sqliteTable("ai_settings", {
  id: text("id").primaryKey(),               // singleton row, one per local install
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  provider: text("provider"),                  // "ANTHROPIC" | "OPENAI" | "CUSTOM"
  model: text("model"),                          // provider-specific model identifier
  customBaseUrl: text("custom_base_url"),          // only for provider === "CUSTOM"
  encryptedApiKey: text("encrypted_api_key"),        // AES-256-GCM ciphertext, never plaintext
  keyLastFour: text("key_last_four"),                  // for the masked-display UI only
  updatedAt: text("updated_at").notNull(),
});

export const aiInsights = sqliteTable("ai_insights", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => plans.id).notNull(),
  insightType: text("insight_type").notNull(),   // one of §16.5's table keys
  sourceDataHash: text("source_data_hash").notNull(), // hash of the payload sent, for cache/staleness display
  generatedText: text("generated_text").notNull(),
  provider: text("provider").notNull(),
  model: text("model"),
  generatedAt: text("generated_at").notNull(),
});
```

`ai_settings` is explicitly excluded from the "Export Plan" flow
(`08-` §8.5) — export includes `ai_insights` (the generated text, for the
user's own record) but never the encrypted key or provider credentials.

## 16.10 Testing approach (extends `12-testing-strategy.md`)

- **No test in the default CI suite ever calls a real provider.** All
  provider adapters are tested against a mocked HTTP layer (fixed
  request/response fixtures per provider), so the full test suite never
  requires a real API key and never incurs real API cost — matching the
  project's existing "no network dependency for the core test suite"
  posture (`12-` §12.1).
- Unit tests: payload-construction correctness per insight type (§16.5) —
  assert the exact, minimal JSON sent for each insight type matches
  §16.6's stated scope, so an accidental over-broad payload is caught by
  a test, not discovered in production.
- Integration tests: the encrypt/decrypt round-trip for stored keys; the
  **Remove Key** action fully clearing stored credentials; the Export
  Plan flow never including `ai_settings`.
- E2E (Playwright): a mocked-provider end-to-end run of "configure a
  fake key → generate one insight of each type → verify the panel
  renders with the AI-generated label" — no real network call, using a
  local test double standing in for a provider's HTTP endpoint.
