## How do I set up custom OAuth credentials for Microsoft (Outlook)?

For a step-by-step guide on creating and configuring your own Microsoft (Outlook) OAuth credentials with Composio, see [How to create OAuth credentials for Microsoft (Outlook)](https://composio.dev/auth/outlook).

## Outlook new message trigger only sends the message ID
Outlook's official webhooks send only the message payload ID on trigger events. To fetch the full message (subject, body, headers), call the `OUTLOOK_GET_MESSAGE` tool with that message ID.

## I cannot see the sent message details while using OUTLOOK_SEND_EMAIL
Why: Microsoft Graph's send endpoint returns an HTTP 202 with no message details. Workaround: create a draft first with `OUTLOOK_CREATE_DRAFT` (this returns conversationID and messageID), then send the draft using `OUTLOOK_SEND_DRAFT` to obtain those IDs.
Reference: https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0&tabs=http

## What's the @odata.context / @odata URL?
The `@odata.context` URL provides metadata about the response (entity set, service version, and schema info) to help clients interpret the payload structure. It's primarily used for pagination and data parsing — not as a direct URL to the resource itself.
