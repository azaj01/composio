---
"@composio/core": minor
---

feat(core): custom tools, custom toolkits, and proxy execute for tool router sessions (TypeScript only)

### Custom Tools

Define local tools that execute in-process alongside remote Composio tools:

- **Standalone tools** — no auth, run entirely locally
- **Extension tools** — inherit auth from a Composio toolkit (e.g. Gmail) via `extendsToolkit`
- **Custom toolkits** — group related tools under a namespace

### Proxy Execute

`session.proxyExecute()` and `ctx.proxyExecute()` for raw HTTP API calls through Composio's auth layer. Returns `{ status, data, headers }`.

### Session Creation

```typescript
const session = await composio.create("user_123", {
  toolkits: ["gmail"],
  experimental: {
    customTools: [myTool, myExtensionTool],
    customToolkits: [myToolkit],
  },
});
```

### Other Changes

- Slug mapping uses backend response (`slug`/`original_slug`) instead of client-side prefix
- Uses official `@composio/client@0.1.0-alpha.62` types
- `proxyExecute` uses official client method
