## Twitter Toolkit — FAQ

## Twitter rate limiting
Why it happens: the default OAuth app is shared across users and subject to strict rate limits. Good for testing; for production use your own OAuth app.  
Example error(for ref only):
```bash
error: 'Request failed error: "{"account_id": <ID>, "product_name": "standard-basic" ',"title" : "UsageCapExceeded", "period" : "Monthly", "scope" : "Product", "detail": "Usage cap exceeded: Monthly product cap", "type": "https://api.twitter.com/2/problems/usage-capped"}"
```

## Twitter plan-based API access
Twitter enforces plan-based access tiers. Check your project's product/plan for required permissions: https://developer.x.com/en/portal/products

## Twitter 403s on API calls
Why it happens: your developer account/project may not have the required access level for the endpoint. Example 403 response explains missing enrollment or required level.

