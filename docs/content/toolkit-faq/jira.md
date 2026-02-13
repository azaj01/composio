## How do I set up custom OAuth credentials for Jira?

For a step-by-step guide on creating and configuring your own Jira OAuth credentials with Composio, see [How to create OAuth credentials for Jira](https://composio.dev/auth/jira).

## JQL GET vs POST and Search Issues
- JQL GET and POST target the same search functionality but use different HTTP methods. POST supports complex queries in the request body.  
- Use the `fields` parameter to request specific fields; responses may include empty values if fields are undefined. Use `["*all"]` to request all fields.

## Difference: JQL GET vs POST vs Search Issues
Search Issues uses JQL POST under the hood and supports extra parameters/filters. For consistent results prefer POST when submitting complex queries.
