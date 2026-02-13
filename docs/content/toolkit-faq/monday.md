## Why is Monday.com OAuth2 not working for my users?

Monday.com requires a workspace admin to install the OAuth2 app before any user in that workspace can authorize their account. If the app is not installed, users will see an authorization error when trying to connect.

## How do I install the Composio OAuth2 app for Monday.com?

A workspace admin needs to visit the following URL and approve the app installation:

`https://auth.monday.com/oauth2/authorize?client_id=96b038435fc029e045f9ba800e66fefa&response_type=install`

Once the admin has installed the app, users in that workspace can authorize their accounts using OAuth2 as usual.

## Do I need to install the app for each user?

No. The admin only needs to install the app once per workspace. After that, any user in the workspace can connect their Monday.com account through Composio's OAuth2 flow.

## How do I set up custom OAuth credentials for Monday.com?

For a step-by-step guide on creating and configuring your own Monday.com OAuth credentials with Composio, see [How to create OAuth2 credentials for Monday](https://composio.dev/auth/monday).

## Monday has no scopes
Note: Monday's authConfig does not accept scopes in the same way Google does. Scopes are configured on the OAuth app itself. When using the default OAuth app, ensure the required app-level scopes are configured for full toolkit access. If creating a custom app, add these scopes as needed:

```bash
me:read
boards:read
boards:write
docs:read
docs:write
workspaces:read
workspaces:write
users:read
users:write
account:read
notifications:write
updates:read
updates:write
assets:read
tags:read
teams:read
teams:write
webhooks:write
webhooks:read
```
