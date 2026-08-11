---
name: npm-cli-packaging
description: Use this skill for any change to packages/cli, the root package.json's bin/files/scripts configuration, or the install-and-launch flow that makes "npx wealthpath" or "npm install -g wealthpath" work.
---

# npm CLI Packaging

## When to use this skill

Any change to `packages/cli`, the root `package.json`'s `bin`, `files`, or
`scripts` fields, or anything affecting how the app installs and launches.

## Procedure

1. **Read `docs/13-packaging-distribution.md` in full** — it specifies the
   exact package shape, port-selection behavior, and update story
   expected.

2. **Never add a build step to the published package's runtime path.**
   The published tarball ships pre-built `dist/` output (§13.2) — dev
   dependencies (Vite, TypeScript, etc.) must never appear in the
   published package's `dependencies` (only in the workspace root's
   `devDependencies`, which npm does not install for consumers).

3. **Before merging any change here, actually test the install path**,
   not just the dev-mode path:
   ```bash
   npm run build --workspaces
   npm pack                      # produces the actual tarball a user would get
   cd /tmp && mkdir test-install && cd test-install
   npm install /path/to/wealthpath-X.Y.Z.tgz
   npx wealthpath                # or: ./node_modules/.bin/wealthpath
   ```
   A change that only works via `npm run dev` inside the monorepo but
   fails from a packed tarball is not done.

4. **Port selection must degrade gracefully** (§13.3) — test what happens
   when the default port range is occupied (e.g. run another process on
   4321–4323 first) and confirm the app still starts on a fallback port
   rather than crashing.

5. **Verify migrations run automatically on server start** with no manual
   step, by testing an "upgrade" scenario: install an older version,
   create some data, then install the new version over it and confirm the
   app starts cleanly with the data intact and migrated.

6. **Test cross-platform path/permission behavior explicitly** if your
   change touches the DB file location or any filesystem interaction —
   Windows path separators and permission models differ meaningfully from
   macOS/Linux; do not assume POSIX behavior generalizes.

7. **Resist scope creep.** Before adding anything (a background service, an
   installer executable, an auto-updater, telemetry), check
   `docs/13-` §13.6's explicit "not built" list first — if what you're
   about to add is on that list, stop and raise it as a scope question
   rather than building it.

## Definition of done

- The `npm pack` → fresh install → `npx wealthpath` flow (step 3 above)
  works end-to-end.
- Port fallback tested.
- Migration-on-upgrade tested.
- No dev dependency leaked into the published package's runtime
  dependencies (check `npm pack --dry-run`'s file list and the resulting
  tarball's `package.json`).
