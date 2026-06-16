> This document describes billing edge cases for educational and testing purposes. The classification logic, retry strategies, and orchestration rules that Sutyr applies to these edge cases in production are proprietary and are not included in this project.

# Subscription Lifecycle

A Stripe subscription is not a single state — it moves through a sequence of statuses driven by billing cycles, payment outcomes, and customer or merchant actions. Each transition arrives as a separate webhook event, often out of the order a naive handler expects, and the same logical subscription threads through events that reference it in different ways.

## What happens

A healthy subscription billing cycle produces a burst of related events:

```
invoice.created            (status: draft)
invoice.finalized          (status: open)
charge.succeeded
payment_intent.succeeded
invoice.paid               (status: paid)
invoice.payment_succeeded
customer.subscription.updated   (period advances)
```

A failing cycle produces a different sequence:

```
invoice.created
invoice.payment_failed          (attempt_count: 1)
payment_intent.payment_failed
customer.subscription.updated   (status: active → past_due)
invoice.payment_failed          (attempt_count: 2)
...
customer.subscription.deleted   (status: canceled)   — after retries exhaust
```

Across all of these, the same subscription is identified by one `sub_` ID, the same invoice by one `in_` ID, and the same payment attempt by one `pi_` ID. The subscription's `status` field (`trialing`, `active`, `past_due`, `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, `paused`) tells you where in the lifecycle it sits.

## Why it matters

- **Status is the source of truth, not event type.** `customer.subscription.updated` fires for many different reasons — a plan change, a quantity change, a status transition, a period advance. The event type alone tells you almost nothing; the `status` field and the `previous_attributes` in the event envelope tell you what actually changed.
- **Events are not ordered or exactly-once.** Stripe may deliver events out of order, deliver the same event more than once, or deliver a later state before an earlier one under retry. A handler that assumes `invoice.created` always arrives before `invoice.paid` will eventually be wrong.
- **The "same" entity appears under different keys.** The subscription ID is the top-level `id` on a `customer.subscription.*` event, but a `subscription` field on an `invoice.*` event. Correlating a subscription's full lifecycle means reading the ID from the right place in each event shape.

## What breaks in production

- Keying state on event type instead of subscription status, so a benign `customer.subscription.updated` (period advance) is mistaken for a meaningful state change.
- Assuming exactly-once, in-order delivery, so a duplicate `invoice.payment_failed` double-counts a dunning attempt, or an out-of-order `invoice.paid` is overwritten by a late-arriving `invoice.payment_failed`.
- Treating `past_due` as terminal. A `past_due` subscription is still recoverable — payment can still succeed on a later retry and move it back to `active`. Canceling on first `past_due` loses revenue.
- Failing to correlate the invoice across its lifecycle, so `invoice.created`, `invoice.paid`, and `invoice.payment_succeeded` are tracked as three unrelated invoices instead of one progressing through states.

## Testing with Webhook Lab

The **Subscription Happy Path** and **Subscription Payment Failure** scenarios fire the full event sequence with correlated entity IDs — one `cus_`, one `sub_`, one `in_`, one `pi_` flowing through every step. Run them to confirm your handler:

- Tracks the subscription by its `sub_` ID across both top-level and referenced positions.
- Reads `status` (and `previous_attributes`) rather than branching on event type alone.
- Treats `past_due` as recoverable and only acts on `canceled` as terminal.
- Correlates the invoice lifecycle events as one invoice, not several.
