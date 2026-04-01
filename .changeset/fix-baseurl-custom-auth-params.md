---
"@composio/core": patch
---

Fix `customAuthParams.baseURL` not being sent to the API during tool execution. The SDK property `baseURL` is now correctly mapped to the API's expected `base_url` field.
