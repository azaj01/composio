## QuickBooks Toolkit — FAQ

## Why am I seeing a DNS error while connecting my account?
Cause: this commonly happens when the `com.intuit.quickbooks.payment` scope is included in your `authConfig` but the connected QuickBooks account hasn't enabled the Payments module. The Payments scope requires the Payments feature to be active on the QuickBooks side.

Fix:
- Remove the `com.intuit.quickbooks.payment` scope from the `authConfig` and reconnect, or
- Enable/complete the Payments module in the QuickBooks account you’re connecting, then retry the connection.

