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

- **Completed and paid**: `checkout.session.completed` with `payment_status: paid`.
- **Completed but not paid**: for `mode: subscription` with a trial, or for delayed payment methods such as ACH or SEPA Direct Debit, `checkout.session.completed` can fire with `payment_status: unpaid` or `no_payment_required`. The session succeeded; the money has not moved yet.
- **Expired**: `checkout.session.expired` fires when the customer never completes the session before it expires (24 hours after creation by default). No payment intent succeeds.
- **Delayed payment settled or failed**: for delayed payment methods, Stripe sends `checkout.session.async_payment_succeeded` when the payment finally succeeds, or `checkout.session.async_payment_failed` when it fails, well after the session completed.

The session's `payment_status` (`paid`, `unpaid`, `no_payment_required`) and `status` (`open`, `complete`, `expired`) together describe the real outcome.

## Why it matters

- **`checkout.session.completed` does not mean "paid".** It means the customer finished the hosted flow. For subscriptions with trials, delayed payment methods, or zero-amount setups, completion and payment are separate facts. Provisioning access on the completed event alone can grant access to a customer whose payment later fails.
- **Expiration is silent from the customer's side.** A customer who opens Checkout and walks away produces only `checkout.session.expired`, hours later. A handler that tracks only successes never learns the difference between "still deciding" and "gone."
- **Delayed payments separate completion from settlement.** With methods that settle later, the completion and the eventual success or failure can be minutes or days apart, and they arrive as different events about the same session.

## What breaks in production

- Granting entitlements on `checkout.session.completed` without checking `payment_status`, so trial or delayed-payment customers get access before (or without ever) paying.
- Ignoring `checkout.session.expired`, leaving abandoned-cart state stuck in "pending" forever and missing the signal to follow up or release reserved inventory.
- Ignoring `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`, so orders held for a delayed payment are never fulfilled, or are fulfilled even though the payment failed.
- Assuming exactly one PaymentIntent per session for the entire flow, when correlation requires reading the session's `payment_intent` reference and matching it to subsequent events.

## Testing with Webhook Lab

The **Checkout flow** scenario (`checkout-flow`) fires `checkout.session.completed`, `payment_intent.succeeded` and `charge.succeeded` with one correlated `cus_`, `pi_` and `ch_`. Fire `checkout.session.expired`, `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed` on their own to exercise the abandonment and delayed-payment paths. Confirm your handler:

- Reads `payment_status`, not just the event type, before provisioning.
- Has an explicit path for `checkout.session.expired`.
- Fulfills a held order on `checkout.session.async_payment_succeeded` and releases it on `checkout.session.async_payment_failed`.
- Correlates the session's PaymentIntent with later `payment_intent.*` events.
