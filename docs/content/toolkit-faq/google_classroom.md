# Google Toolkits — FAQ

For a step-by-step guide on creating and configuring your own Google OAuth credentials with Composio, see [How to create OAuth2 credentials for Google Apps](https://composio.dev/auth/googleapps).

## "App is blocked" warning while connecting to Google apps
Why it happens: the OAuth client is requesting scopes Google hasn't verified for that client (often when extra granular scopes are added).  
Fix: remove the extra scopes or create/use your own OAuth app and submit scopes for verification (see the [Create OAuth app guide](https://composio.dev/auth/googleapps)).

## "Gmail API has not been used in project <ID> before or it is disabled"
Why it happens: when using custom OAuth credentials the Gmail API must be enabled in the Cloud project that owns those credentials.  
Fix: enable the Gmail API in Google Cloud Console → APIs & Services, wait a few minutes for propagation, then retry.

## Access blocked: Authorization Error (Error 400: invalid_scope)
Why it happens: requested scopes are invalid, unsupported, or misformatted in the auth URL.  
Fix: verify scope values against the [Google OAuth scopes docs](https://developers.google.com/identity/protocols/oauth2) and follow the [programmatic authConfig guide](https://docs.composio.dev/docs/programmatic-auth-configs).

## Composio name shown on the OAuth consent screen
To white‑label the consent screen, create and use your own OAuth app and set a custom redirect URL. See the [white‑label OAuth guide](https://docs.composio.dev/docs/custom-auth-configs#white-labeling-the-oauth-consent-screen).

## 401 errors for tool calls
Common causes: user revoked access, password/2FA change, Workspace admin policy, or refresh‑token limits (~50 tokens). Reauthorization typically resolves 401s.
