## How do I set up custom OAuth credentials for Salesforce?

For a step-by-step guide on creating and configuring your own Salesforce OAuth credentials with Composio, see [How to create OAuth credentials for Salesforce](https://composio.dev/auth/salesforce).

## Can’t find created items?
If created items don't appear in Salesforce UI, use search to confirm they exist (records may be present but not visible in a given view).

## Relationships: Pricebooks and Opportunities
Salesforce relationships example: Products → Pricebooks → Opportunities. Example query:
```sql
SELECT Id, Name,
  (SELECT Id, Quantity, UnitPrice, TotalPrice, PricebookEntry.Product2.Name FROM OpportunityLineItems)
FROM Opportunity
```

## Connection initiation
Required fields for connection: subdomain (your-company.my) and instance endpoint `/services/data/v61.0`. If you see `URL_NOT_RESET`, replace `login` subdomain with your organization’s subdomain.

## Deprecated tools
Deprecated tools continue to work until removed. Check tool descriptions for "DEPRECATED:" markers.
