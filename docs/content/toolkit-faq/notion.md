## Notion Toolkit — FAQ

## Notion Operations show Composio instead of user’s name
Why it happens: Notion attributes actions to the Integration itself (name/logo set in the Integration configuration), so operations and comments show the integration identity rather than the individual user.  
Fix: create and use your own Notion integration if you need a custom name/logo. See: https://developers.notion.com/docs/create-a-notion-integration

## Granting access to more pages
If you initially granted access to specific pages and later need to add more:
1. Open Notion → Settings & Members → Connections  
2. Select the integration (Composio or your custom integration)  
3. Click "Select pages" (or "Manage access") and add/remove pages as required

## Notion has no scopes
Notion does not use OAuth scopes. Instead, integrations are granted access to specific resources (pages/databases) during the authorization flow or via integration settings. You do not need to pass scopes when creating an authConfig.

## Configuring Scopes / Access model
Notion access is controlled by the integration type:
- OAuth app (public): access selection happens at authorization time.  
- Internal integration (API key): page access is managed in the Integration settings.  
Choose the integration model that matches your deployment and permissions needs.

