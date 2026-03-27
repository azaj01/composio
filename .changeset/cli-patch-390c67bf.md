---
"@composio/cli": patch
---

### Bug fixes & hardening
- Fix no-browser link flow to print raw redirect URLs
- Harden session artifacts, analytics dir creation, and consumer cache for sandboxed environments (wrap filesystem ops in try/catch, respect `COMPOSIO_SESSION_DIR` / `COMPOSIO_CACHE_DIR` env vars)
- Fix stale/broken symlink handling in skill installer (use `lstatSync` instead of `existsSync`)
- Fix `detectMaster` parameter type to avoid type conflict from bun env augmentation

### New features
- Add parallel execute support and help examples
- Add batched multi-query tool search
- Allow `execute --get-schema` without user context
- Cache no-auth toolkits as connected
- Report execute failure origin and tool log IDs
- Add skill installer during `composio login` (with `--no-skill-install` opt-out)
- Add contextual help on CLI errors and unknown arguments
- Add `composio files` subcommand help and richer examples in root help output
