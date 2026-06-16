> This document describes billing edge cases for educational and testing purposes. The classification logic, retry strategies, and orchestration rules that Sutyr applies to these edge cases in production are proprietary and are not included in this project.

# Checkout Failures

Stripe Checkout abstracts the payment flow behind a hosted session, but the session can end in several ways that are easy to conflate. A handler that only listens for the success event silently loses track of customers who abandon, expire, or fail mid-checkout.

## What happens

A completed checkout fires:

```
checkout.session.completed   (payment_status: paid)
payment_intent.succeeded
charge.succeeded
```

But a Checkout Session has multiple terminal and non-terminal outcomes:

- **Completed and paid** — `checkout.session.completed` with `payment_status: paid`.
- **Completed but not paid** — for `mode: subscription` with a trial, or async payment methods, `checkout.session.completed` can fire with `payment_status: unpaid` or `no_payment_required`. The session succeeded; the money has not (yet) moved.
- **Expired** — `checkout.session.expired` fires when the customer never completes the session within its window (24 hours by default). No payment intent succeeds.
- **Async failure** — for delayed-notification payment methods, the session completes but the underlying payment can later fail, arriving as a separate `payment_intent.payment_failed` well after the session event.

The session's `payment_status` (`paid`, `unpaid`, `no_payment_required`) and `status` (`open`, `complete`, `expired`) together describe the real outcome.

## Why it matters

- **`checkout.session.completed` does not mean "paid".** It means the customer finished the hosted flow. For subscriptions with trials, async payment methods, or zero-amount setups, completion and payment are separate facts. Provisioning access on the completed event alone can grant access to a customer whose payment later fails.
- **Expiration is silent from the customer's side.** A customer who opens Checkout and walks away produces only `checkout.session.expired`, hours later. A handler that tracks only successes never learns the difference between "still deciding" and "gone."
- **Async payments decouple completion from settlement.** With methods that settle later, the success and the eventual failure can be separated by minutes or days, and the failure references the PaymentIntent, not the session.

## What breaks in production

- Granting entitlements on `checkout.session.completed` without checking `payment_status`, so trial or async customers get access before (or without ever) paying.
- Ignoring `checkout.session.expired`, leaving abandoned-cart state stuck in "pending" forever and missing the signal to follow up or release reserved inventory.
- Failing to link a late `payment_intent.payment_failed` back to the originating checkout, so an async failure is treated as an unrelated payment problem.
- Assuming exactly one PaymentIntent per session for the entire flow, when correlation requires reading the session's `payment_intent` reference and matching it to subsequent events.

## Testing with Webhook Lab

The **Checkout Flow** scenario fires `checkout.session.completed` → `payment_intent.succeeded` → `charge.succeeded` with one correlated `cus_`, `pi_`, and `ch_`. Fire `checkout.session.expired` on its own to exercise the abandonment path. Confirm your handler:

- Reads `payment_status`, not just the event type, before provisioning.
- Has an explicit path for `checkout.session.expired`.
- Correlates the session's PaymentIntent with later `payment_intent.*` events so an async failure is attributed to the right checkout.
