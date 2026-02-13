## How do I set up custom OAuth credentials for Slack?

For a step-by-step guide on creating and configuring your own Slack OAuth credentials with Composio, see [How to create OAuth credentials for Slack](https://composio.dev/auth/slack).

## Slack vs Slackbot — key differences
- Scope: Slack = workspace-level API (channels, files, users); Slackbot = bot-centric messaging/interactivity.  
- Triggers: Slack = workspace events; Slackbot = bot entry points (app_mention, DMs, slash commands).  
- Actions: Slack can manage channels/files/users; Slackbot focuses on messaging, ephemeral messages, and modals.  
- Message identity: Slack can post as app; Slackbot posts as the bot user.  
- Use cases: Slack for workspace management; Slackbot for conversational UX and bot flows.

## Docs & Scopes
See Slack Developer Docs: https://docs.slack.dev/reference/scopes/

## Redirect URI mismatch
Update in Slack App → OAuth & Permissions → Redirect URLs.

## Using Webhooks (Events)
1. Enable Event Subscriptions in your Slack app.  
2. Set Request URL to: `https://backend.composio.dev/api/v3/trigger_instances/slack/default/handle`  
3. Add `reaction_added` (and other events) to Subscribe to Bot Events and save.  
- If using Composio Slack app: you're all set.  
- If using Slackbot integration: add the bot to channels you want to monitor (or use /add to add Composio App).

## Scope Errors
1. Missing bot scope → add a bot scope under OAuth & Permissions.  
2. "Insufficient scopes" → ensure all scopes from your Auth Config are configured in the Slack app.

## Action-specific notes
- `as_user` parameter: Slack API — set `as_user=True`; Slackbot — leave blank (defaults False).  
- `missing_charset` error: usually due to invalid `as_user`, wrong channel ID, or missing required fields.

## Cannot use Triggers
Provide the Verification Token (or signing secret) in the Auth Config so Composio can validate incoming events.

