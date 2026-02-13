## How do I set up custom Google OAuth credentials for Google Sheets?

For a step-by-step guide on creating and configuring your own Google OAuth credentials with Composio, see [How to create OAuth2 credentials for Google Apps](https://composio.dev/auth/googleapps).

## "App is blocked" warning while connecting to Google apps
Why it happens: the OAuth client requests scopes Google hasn't verified for that client (often due to added granular scopes).  
Fix: remove the extra scopes or create/use your own OAuth app and submit scopes for verification (see the [Create OAuth app guide](https://composio.dev/auth/googleapps)).

## "<Google App Name> API has not been used in project <ID> before or it is disabled"
Why it happens: the Google Sheets API isn't enabled for the Cloud project tied to your OAuth credentials.  
Fix: enable the Sheets API in Google Cloud Console → APIs & Services, then wait a few minutes and retry.

## Access blocked: Authorization Error (Error 400: invalid_scope)
Why it happens: requested scopes are invalid or misformatted in the auth URL.  
Fix: verify scopes against the [Google OAuth scopes docs](https://developers.google.com/identity/protocols/oauth2) and follow the [programmatic authConfig guide](https://docs.composio.dev/docs/programmatic-auth-configs).

## Composio name shown on the OAuth consent screen
To white‑label the consent screen, create and use your own OAuth app and set a custom redirect URL. See the [white‑label OAuth guide](https://docs.composio.dev/docs/custom-auth-configs#white-labeling-the-oauth-consent-screen).

## 401 errors for tool calls
Common causes: user revoked access, password/2FA change, Workspace admin policy changes, or refresh‑token limits (~50 tokens). Reauthorization typically resolves 401s.

---
## Why am I getting "Quota Exhausted" or "rate limit exhausted" on the service <SERVICE>.googleapis.com?
Google enforces request quotas (per‑minute and daily) to protect its APIs. Shared default OAuth apps can reach those limits under high traffic, causing quota errors.  
Fixes: add exponential backoff and retries, batch or cache requests to lower the rate, or use your own OAuth app credentials to avoid shared quotas.

---
