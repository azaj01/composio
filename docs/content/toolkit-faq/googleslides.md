## How do I set up custom Google OAuth credentials for Google Slides?

For a step-by-step guide on creating and configuring your own Google OAuth credentials with Composio, see [How to create OAuth2 credentials for Google Apps](https://composio.dev/auth/googleapps).

## "App is blocked" warning while connecting to Google apps
Why it happens: the OAuth client requests scopes Google hasn't verified for that client (common when extra granular scopes are added).  
Fix: remove extra scopes or create/use your own OAuth app and submit scopes for verification (see the [Create OAuth app guide](https://composio.dev/auth/googleapps)).

## "<Google App Name> API has not been used in project <ID> before or it is disabled"
Why it happens: the Cloud project that owns your OAuth credentials doesn't have the required API enabled.  
Fix: enable the API (Google Cloud Console → APIs & Services) and wait a few minutes for propagation.

## Access blocked: Authorization Error (Error 400: invalid_scope)
Why it happens: requested scopes are invalid or misformatted in the auth URL.  
Fix: validate scopes against the [Google OAuth scopes docs](https://developers.google.com/identity/protocols/oauth2) and follow the [programmatic authConfig guide](https://docs.composio.dev/docs/programmatic-auth-configs).

## Composio name shown on the OAuth consent screen
To white‑label, create and use your own OAuth app and set a custom redirect URL. See the [white‑label OAuth guide](https://docs.composio.dev/docs/custom-auth-configs#white-labeling-the-oauth-consent-screen).

## 401 errors for tool calls
Common causes: user revoked access, password/2FA change, Workspace admin policy, or refresh‑token limits (~50). Reauthorize when needed.

---
## Why am I getting "Quota Exhausted" or "rate limit exhausted" on the service <SERVICE>.googleapis.com?
Google enforces quotas to limit request rates (per‑minute and daily). Shared default OAuth apps can hit these quotas under heavy use, causing "Quota Exhausted" errors.  
Fixes: add exponential backoff/retries, reduce request frequency (batch/cache), or use your own OAuth app credentials to avoid shared limits.

---
