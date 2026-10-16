> This document describes billing edge cases for educational and testing purposes. The classification logic, retry strategies, and orchestration rules that Sutyr applies to these edge cases in production are proprietary and are not included in this project.

# Decline Codes

When a card payment fails, Stripe reports two distinct fields on the PaymentIntent's `last_payment_error`: a coarse `code` and, for card declines, a finer `decline_code`. Handlers that treat every failure the same way miss the most important signal in billing: *why* the payment failed determines whether retrying it could ever succeed.

## What happens

A failed card payment surfaces an error object shaped like this:

```json
{
  "code": "card_declined",
  "decline_code": "insufficient_funds"
}
```

The `code` is one of a small set of high-level categories (`card_declined`, `expired_card`, `incorrect_cvc`, `processing_error`, ...). When `code` is `card_declined`, Stripe adds a `decline_code` that explains the specific reason the issuing bank gave: `insufficient_funds`, `do_not_honor`, `lost_card`, `stolen_card`, `fraudulent`, and dozens more.

Two subtleties trip up most handlers:

1. **`decline_code` only exists for `card_declined`.** For an `expired_card` error, the `code` is `expired_card` and there is **no** `decline_code` field at all. It is *absent*, not `null`. Code that reads `error.decline_code` unconditionally and branches on its value will misclassify every non-`card_declined` failure.

2. **The fields live on the PaymentIntent, not the Invoice or the Charge.** For subscription billing, the `invoice.payment_failed` event tells you an invoice failed, but the decline reason lives on the PaymentIntent that attempted the payment (`payment_intent.payment_failed`, under `last_payment_error`). Since API version `2025-03-31.basil` the Invoice has no `payment_intent` field: the two are linked through InvoicePayment objects, and `invoice_payment.paid` carries both the invoice ID and the PaymentIntent in `payment.payment_intent`. A Charge has no `decline_code` field either; `charge.failed` reports `failure_code` and an `outcome` object. A handler that only listens to invoice or charge events never sees the decline code.

## Why it matters

Decline reasons fall into broad behavioral classes that look similar but demand opposite responses:

- **Soft declines** (`insufficient_funds`, `do_not_honor`, `try_again_later`) are transient. The same card may succeed hours or days later. Retrying is appropriate.
- **Hard declines** (`lost_card`, `stolen_card`, `pickup_card`, `fraudulent`) are terminal. The card will never succeed. Retrying wastes attempts, annoys the customer and, for fraud-flagged declines, can trigger additional scrutiny from the network.
- **Action-required failures** (`expired_card`, `incorrect_cvc`, `authentication_required`) need the customer to do something. Retrying the same details is pointless; the right move is to prompt the customer to update their payment method.

A handler that retries a `stolen_card` decline on the same schedule it retries `insufficient_funds` is not just ineffective: it can increase card-network decline ratios, which carry real cost.

## What breaks in production

- Treating `decline_code === null` as a valid branch, when the field is actually absent, throws on the comparison or silently falls through to a default.
- Reading the decline reason from the invoice or charge object, where it does not exist, yielding `undefined` and a "reason unknown" path for every failure.
- Retrying hard declines, exhausting retry budgets on cards that can never succeed while genuinely recoverable soft declines time out.
- Assuming the set of decline codes is fixed. Stripe adds new ones over time; a handler with an exhaustive `switch` and no default will mishandle codes that did not exist when it was written.

## Testing with Webhook Lab

Fire `payment_intent.payment_failed` with different decline codes to confirm your handler classifies each correctly:

- `insufficient_funds` gives `code: card_declined`, `decline_code: insufficient_funds` (soft)
- `lost_card` gives `code: card_declined`, `decline_code: lost_card` (hard)
- `expired_card` gives `code: expired_card` and **no** `decline_code` (action required)

From the CLI: `npx @sutyr/webhook-lab fire payment_intent.payment_failed <url> --set declineCode=expired_card`.

Verify your handler reads the reason from the right field, tolerates the absent `decline_code`, and routes soft, hard, and action-required failures down different paths. Fire `charge.failed` too, to confirm nothing in the handler expects a `decline_code` on the Charge.
