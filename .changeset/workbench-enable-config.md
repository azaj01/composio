---
'@composio/core': patch
---

Add `workbench.enable` option to session config for disabling the workbench entirely. When set to `false`, code execution tools (COMPOSIO_REMOTE_WORKBENCH, COMPOSIO_REMOTE_BASH_TOOL) are excluded from the session. Defaults to `true`.
