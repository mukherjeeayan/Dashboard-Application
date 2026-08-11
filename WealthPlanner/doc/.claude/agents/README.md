# Sub-agents for building WealthPath

These agent definitions are meant to be used with Claude Code (or a
compatible agentic coding tool) to build this project according to the
plan in `docs/`. Each agent has a narrow mandate and is expected to read
the relevant planning docs before acting, and to keep those docs updated
if the implementation deviates from the plan (per `docs/10-implementation-plan.md`'s
closing note: "living documents, not frozen specs").

| Agent | File | Mandate |
|---|---|---|
| Jurisdiction Architect | `jurisdiction-architect.md` | Owns `packages/jurisdictions` — schema, packs, validation tooling |
| Financial Engine Builder | `financial-engine-builder.md` | Owns `packages/engine` — deterministic + Monte Carlo calculation modules |
| API & Data Engineer | `api-data-engineer.md` | Owns `packages/server` — Fastify routes, Drizzle schema/migrations, worker orchestration |
| Frontend Builder | `frontend-builder.md` | Owns `packages/client` — screens, forms, charts, per `docs/09-ui-ux-spec.md` |
| AI Insights Integrator | `ai-insights-integrator.md` | Owns `packages/server/ai` and the Settings → AI Insights screen — the optional, off-by-default BYOK feature, per `docs/16-ai-insights-byok.md` |
| Packaging Engineer | `packaging-engineer.md` | Owns `packages/cli`, root `package.json`, cross-platform install/launch behavior |
| QA & Correctness Auditor | `qa-correctness-auditor.md` | Owns the test suites, especially golden-value tests against the source workbook's worked examples |

## How to invoke

Each file below is a self-contained system-prompt-style brief. Load the
relevant one as a sub-agent's instructions when delegating a phase or task
from `docs/11-task-list.md` to it. Agents should treat `docs/*.md` as the
source of truth and `Investment_Workbook.docx` / `MacroMonteCarlo.bas` as
the ground-truth specification for financial correctness — never the other
way around (i.e. never let an agent "simplify" a formula because it looks
unfamiliar; the source doc's worked examples are the authority).
