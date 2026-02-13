## How do I set up custom OAuth credentials for HubSpot?

For a step-by-step guide on creating and configuring your own HubSpot OAuth credentials with Composio, see [How to create OAuth credentials for HubSpot](https://composio.dev/auth/hubspot).

## Query limits
Use `limit <= 100` for `HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA` and `HUBSPOT_LIST_CONTACTS_PAGE` endpoints to avoid errors.

## Webhooks
Webhooks require public apps (AppId + Developer API Key). Private/internal apps cannot receive HubSpot webhooks.
