---
"@composio/core": patch
---

Add missing `alias` option to `ToolRouterAuthorizeFn` type. The `ToolRouterSession.authorize()` implementation already accepted `alias`, but the exported type didn't include it, causing type errors when passing `{ alias: 'work-gmail' }` to `session.authorize()`.
