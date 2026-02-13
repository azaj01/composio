## How do I set up custom Google OAuth credentials for Google Tasks?

For a step-by-step guide on creating and configuring your own Google OAuth credentials with Composio, see [How to create OAuth2 credentials for Google Apps](https://composio.dev/auth/googleapps).

## "App is blocked" warning while connecting to Google apps
Why it happens: the OAuth client is requesting scopes Google hasn't verified for that app. If you're using Composio's default OAuth client this usually means you added extra scopes beyond the defaults.  
Fix: either remove the extra scope(s) or create and use your own OAuth app (see the [Create OAuth app guide](https://composio.dev/auth/googleapps)) and submit scopes for verification.

## "<Google App Name> API has not been used in project <ID> before or it is disabled"
Why it happens: when using your own OAuth credentials the corresponding Google API (Sheets, Drive, Gmail, etc.) must be enabled in the Cloud project.  
Fix: open Google Cloud Console → APIs & Services → Enable the required API, then wait a few minutes for propagation.

## Access blocked: Authorization Error (Error 400: invalid_scope)
Why it happens: scopes are invalid, unsupported, or misformatted in the auth URL.  
Fix: verify scopes against Google's docs (see the [Google OAuth scopes docs](https://developers.google.com/identity/protocols/oauth2)) and follow the [programmatic authConfig guide](https://docs.composio.dev/docs/programmatic-auth-configs).

## Composio name shown on the OAuth consent screen
To white‑label the consent screen, create your own OAuth app and set a custom redirect URL. See the [white‑label OAuth guide](https://docs.composio.dev/docs/custom-auth-configs#white-labeling-the-oauth-consent-screen).

## 401 errors for tool calls
Common causes: user revoked access, password/2FA change, Workspace admin policy, or refresh‑token rotation/limits (~50 tokens). If a connection fails, ask the user to reauthorize.

---
## Why am I getting "Quota Exhausted" or "rate limit exhausted" on the service <SERVICE>.googleapis.com?
Google enforces request quotas to protect its services (per‑minute and daily limits). If many users share the default OAuth client, you may hit a shared quota and see "Quota Exhausted" errors.  
Fixes: implement exponential backoff and retries, reduce request rates (batch/cache), or use your own OAuth app credentials to avoid shared quotas.

---
