## Google Toolkits — FAQ

## "App is blocked" warning while connecting to Google apps
Why it happens: the OAuth client requests scopes Google hasn't verified for that client (often because extra granular scopes were added).  
Fix: remove the extra scopes or create and use your own OAuth app and submit scopes for verification — see the [Create OAuth app guide](https://composio.dev/auth/googleapps).

## "<Google App Name> API has not been used in project <ID> before or it is disabled"
Why it happens: the specific Google API (Sheets, Drive, Gmail, Slides, etc.) is not enabled for the Cloud project tied to your OAuth credentials.  
Fix: open Google Cloud Console → APIs & Services → enable the required API, then wait a few minutes and retry.

## Access blocked: Authorization Error (Error 400: invalid_scope)
Why it happens: requested scopes are invalid, unsupported, or misformatted in the authorization URL.  
Fix: verify scopes against the [Google OAuth scopes docs](https://developers.google.com/identity/protocols/oauth2) and follow the [programmatic authConfig guide](https://docs.composio.dev/docs/programmatic-auth-configs).

## Composio name shown on the OAuth consent screen
To white‑label the consent screen, create and use your own OAuth app and configure a custom redirect URL. See the [white‑label OAuth guide](https://docs.composio.dev/docs/custom-auth-configs#white-labeling-the-oauth-consent-screen).

---
