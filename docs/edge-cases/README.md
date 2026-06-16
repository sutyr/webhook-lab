> This document describes billing edge cases for educational and testing purposes. The classification logic, retry strategies, and orchestration rules that Sutyr applies to these edge cases in production are proprietary and are not included in this project.

# Billing Edge Cases

This directory documents billing edge cases that developers encounter when integrating with Stripe webhooks. Each file covers a category of failure modes with descriptions of what happens, why it matters, and what breaks in production when unhandled.

These documents are educational resources. They describe problems, not solutions. The Sutyr platform's response logic for these edge cases is proprietary and is not part of this open-source project.

## Categories

- [Decline Codes](decline-codes.md)
- [Subscription Lifecycle](subscription-lifecycle.md)
- [Checkout Failures](checkout-failures.md)

Additional categories are added over time. Contributions welcome — see [CONTRIBUTING.md](../../CONTRIBUTING.md).
