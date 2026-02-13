## How do I set up custom Google OAuth credentials for Google Calendar?

For a step-by-step guide on creating and configuring your own Google OAuth credentials with Composio, see [How to create OAuth2 credentials for Google Apps](https://composio.dev/auth/googleapps).

## "App is blocked" warning while connecting to Google apps
Why it happens: the OAuth client requests scopes that aren't verified for that client (common when adding extra scopes).  
Fix: remove extra scopes or create/use your own OAuth app and submit scopes for verification (see the [Create OAuth app guide](https://composio.dev/auth/googleapps)).

## "<Google App Name> API has not been used in project <ID> before or it is disabled"
Why it happens: the Calendar API is not enabled for the Cloud project tied to your OAuth credentials.  
Fix: enable the Calendar API in Google Cloud Console → APIs & Services, then wait a few minutes and retry.

## Access blocked: Authorization Error (Error 400: invalid_scope)
Why it happens: requested scopes are invalid or misformatted.  
Fix: verify scopes against the [Google OAuth scopes docs](https://developers.google.com/identity/protocols/oauth2) and follow the [programmatic authConfig guide](https://docs.composio.dev/docs/programmatic-auth-configs).

## Composio name shown on the OAuth consent screen
To white‑label the consent screen, create and use your own OAuth app and set a custom redirect URL. See the [white‑label OAuth guide](https://docs.composio.dev/docs/custom-auth-configs#white-labeling-the-oauth-consent-screen).

## 401 errors for tool calls
Common causes: user revoked access, password/2FA change, admin policy, or refresh‑token limits (~50). Reauthorization typically resolves 401s.

---
---