# Upstream provenance

- Source: https://github.com/dmmulroy/anti-slop
- Commit: `13909c9e07590f5a85d93c62712259fe14a883f7` (2026-10-13, merge of #45)
- Copied from: `skills/install-anti-slop/assets/anti-slop/` via `skills/install-anti-slop/scripts/install.mjs`; identical to upstream `src/` minus tests at that commit
- Installed to: `tools/oxlint/anti-slop/` (generic plugin `index.ts`; the Effect plugin in `effect/` is copied but not registered because the project does not depend on Effect)
- Oxlint: `oxlint` and `@oxlint/plugins` pinned to `1.88.0`

## Local deviations

- `shared/dictionary-types.ts`: `unsafeMembers[0]` → `(unsafeMembers[0] ?? null)` in `unsafeDirectValue` so the file typechecks under this repo's `noUncheckedIndexedAccess`. The preceding `length > 0` guard makes it behavior-neutral.

Oxlint loads the plugin and `oxlint.config.ts` as TypeScript, which needs Node ≥ 22.18 (`engines` in `package.json`; `.nvmrc` pins 26).
