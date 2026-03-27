---
"@composio/cli": patch
---

fix: bundle MCP server into subagent helper via static imports so it works with standalone CLI binaries without repo-local node_modules; fix codact failures not being reported by dispatching them through a dedicated background worker and wiring up the `tools execute` command to capture wrong-slug and wrong-param failures
