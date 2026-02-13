## YouTube Toolkit — FAQ

## How do I set up custom Google OAuth credentials for YouTube?
For a step-by-step guide on creating and configuring your own Google OAuth credentials with Composio, see [How to create OAuth2 credentials for Google Apps](https://composio.dev/auth/googleapps).

## YouTube rate limit
YouTube's default OAuth app is shared and subject to strict quota limits. For production use, create and use your own OAuth app to avoid shared quotas. Typical error when quota is exceeded:
```bash
{
  "error": {
    "code": 403,
    "message": "The request cannot be completed because you have exceeded your quota",
  }
}
```
