## How do I set up custom OAuth credentials for LinkedIn?

For a step-by-step guide on creating and configuring your own LinkedIn OAuth credentials with Composio, see [How to create OAuth credentials for LinkedIn](https://composio.dev/auth/linkedin).

## LinkedIn rate limiting
LinkedIn's default OAuth app is shared across users and has strict rate limits. Use a custom OAuth app for production to avoid shared quotas. Example error:
```bash
429 Client Error: Too Many Requests
```

## LinkedIn scope issue
LinkedIn restricts certain scope combinations (e.g., `w_member_social` and `r_organization_admin` cannot be used together). If you need conflicting scopes, create your own OAuth app with the required permissions.
