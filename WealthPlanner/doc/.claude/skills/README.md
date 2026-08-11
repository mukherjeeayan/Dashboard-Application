# Skills for building WealthPath

Skills capture reusable, repeatable procedures that any agent (or a human
developer, or a future Claude session with no prior context) should follow
consistently across the life of this project — the kind of "hard-won
trial-and-error" knowledge that's easy to relearn the hard way if it isn't
written down once.

| Skill | File | Use when |
|---|---|---|
| Formula Porting | `formula-porting/SKILL.md` | Translating a formula from `Investment_Workbook.docx` / `MacroMonteCarlo.bas` into `packages/engine` TypeScript |
| Jurisdiction Pack Authoring | `jurisdiction-pack-authoring/SKILL.md` | Creating or updating a country's Jurisdiction Pack |
| Monte Carlo Worker Development | `monte-carlo-worker/SKILL.md` | Building or modifying anything in `packages/engine/monteCarlo` or its `worker_threads` orchestration |
| npm CLI Packaging | `npm-cli-packaging/SKILL.md` | Any change to `packages/cli`, root `package.json`, or the install/launch flow |
