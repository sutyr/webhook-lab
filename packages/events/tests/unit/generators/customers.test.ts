// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  customerCreated,
  customerUpdated,
  customerDeleted,
} from '../../../src/generators/customers.js';

describe('customerCreated', () => {
  it('returns a customer.created event', () => {
    const event = customerCreated();
    expect(event.type).toBe('customer.created');
  });

  it('wraps the customer in data.object', () => {
    const event = customerCreated();
    expect(event.data.object.object).toBe('customer');
  });

  it('generates a customer id starting with cus_', () => {
    const event = customerCreated();
    expect(event.data.object.id.startsWith('cus_')).toBe(true);
  });

  it('defaults email to jane@example.com', () => {
    const event = customerCreated();
    expect(event.data.object.email).toBe('jane@example.com');
  });

  it('defaults name to Jane Doe', () => {
    const event = customerCreated();
    expect(event.data.object.name).toBe('Jane Doe');
  });

  it('defaults balance to 0', () => {
    const event = customerCreated();
    expect(event.data.object.balance).toBe(0);
  });

  it('defaults delinquent to false', () => {
    const event = customerCreated();
    expect(event.data.object.delinquent).toBe(false);
  });

  it('accepts custom email', () => {
    const event = customerCreated({ email: 'custom@test.com' });
    expect(event.data.object.email).toBe('custom@test.com');
  });

  it('accepts custom name', () => {
    const event = customerCreated({ name: 'John Smith' });
    expect(event.data.object.name).toBe('John Smith');
  });

  it('sets phone to null', () => {
    const event = customerCreated();
    expect(event.data.object.phone).toBeNull();
  });

  it('sets currency to null', () => {
    const event = customerCreated();
    expect(event.data.object.currency).toBeNull();
  });

  it('sets invoice_settings.default_payment_method to null', () => {
    const event = customerCreated();
    expect(event.data.object.invoice_settings.default_payment_method).toBeNull();
  });

  it('has a non-empty invoice_prefix', () => {
    const event = customerCreated();
    expect(event.data.object.invoice_prefix.length).toBeGreaterThan(0);
  });

  it('sets livemode to false', () => {
    const event = customerCreated();
    expect(event.data.object.livemode).toBe(false);
    expect(event.livemode).toBe(false);
  });

  it('defaults metadata to empty object', () => {
    const event = customerCreated();
    expect(event.data.object.metadata).toEqual({});
  });

  it('accepts custom metadata', () => {
    const event = customerCreated({ metadata: { plan: 'pro' } });
    expect(event.data.object.metadata).toEqual({ plan: 'pro' });
  });

  it('uses custom timestamp', () => {
    const ts = 1700000000;
    const event = customerCreated({ timestamp: ts });
    expect(event.created).toBe(ts);
    expect(event.data.object.created).toBe(ts);
  });

  it('generates an event id starting with evt_', () => {
    const event = customerCreated();
    expect(event.id.startsWith('evt_')).toBe(true);
  });

  it('does not include previous_attributes', () => {
    const event = customerCreated();
    expect(event.data.previous_attributes).toBeUndefined();
  });
});

describe('customerUpdated', () => {
  it('returns a customer.updated event', () => {
    const event = customerUpdated();
    expect(event.type).toBe('customer.updated');
  });

  it('wraps the customer in data.object', () => {
    const event = customerUpdated();
    expect(event.data.object.object).toBe('customer');
  });

  it('generates a customer id starting with cus_ by default', () => {
    const event = customerUpdated();
    expect(event.data.object.id.startsWith('cus_')).toBe(true);
  });

  it('accepts a custom customerId', () => {
    const event = customerUpdated({ customerId: 'cus_existing123' });
    expect(event.data.object.id).toBe('cus_existing123');
  });

  it('defaults new email to jane.new@example.com', () => {
    const event = customerUpdated();
    expect(event.data.object.email).toBe('jane.new@example.com');
  });

  it('includes previous_attributes with old email', () => {
    const event = customerUpdated();
    expect(event.data.previous_attributes).toBeDefined();
    expect(event.data.previous_attributes!.email).toBe('jane@example.com');
  });

  it('accepts custom email and previousEmail', () => {
    const event = customerUpdated({
      email: 'updated@test.com',
      previousEmail: 'original@test.com',
    });
    expect(event.data.object.email).toBe('updated@test.com');
    expect(event.data.previous_attributes!.email).toBe('original@test.com');
  });

  it('accepts custom name', () => {
    const event = customerUpdated({ name: 'Updated Name' });
    expect(event.data.object.name).toBe('Updated Name');
  });

  it('defaults name to Jane Doe', () => {
    const event = customerUpdated();
    expect(event.data.object.name).toBe('Jane Doe');
  });

  it('sets livemode to false', () => {
    const event = customerUpdated();
    expect(event.data.object.livemode).toBe(false);
  });

  it('defaults metadata to empty object', () => {
    const event = customerUpdated();
    expect(event.data.object.metadata).toEqual({});
  });

  it('uses custom timestamp', () => {
    const ts = 1700000000;
    const event = customerUpdated({ timestamp: ts });
    expect(event.created).toBe(ts);
  });

  it('generates an event id starting with evt_', () => {
    const event = customerUpdated();
    expect(event.id.startsWith('evt_')).toBe(true);
  });
});

describe('customerDeleted', () => {
  it('returns a customer.deleted event at the pinned API version', () => {
    const event = customerDeleted();
    expect(event.type).toBe('customer.deleted');
    expect(event.object).toBe('event');
    expect(event.id.startsWith('evt_')).toBe(true);
    expect(event.api_version).toBe('2026-09-30.endive');
    expect(event.livemode).toBe(false);
  });

  it('wraps a full customer object, not the deleted stub', () => {
    const customer = customerDeleted().data.object;
    expect(customer.object).toBe('customer');
    expect(customer.id.startsWith('cus_')).toBe(true);
    expect(customer).not.toHaveProperty('deleted');
    expect(customer.email).toBe('jane@example.com');
    expect(customer.name).toBe('Jane Doe');
    expect(customer.balance).toBe(0);
    expect(customer.delinquent).toBe(false);
    expect(customer.invoice_prefix.length).toBeGreaterThan(0);
    expect(customer.livemode).toBe(false);
  });

  it('keeps nullable fields present as null', () => {
    const customer = customerDeleted().data.object;
    expect(customer.phone).toBeNull();
    expect(customer.currency).toBeNull();
    expect(customer.description).toBeNull();
    expect(customer.invoice_settings.default_payment_method).toBeNull();
  });

  it('omits includable lists that are not returned by default', () => {
    const customer = customerDeleted().data.object;
    expect(customer).not.toHaveProperty('sources');
    expect(customer).not.toHaveProperty('subscriptions');
    expect(customer).not.toHaveProperty('tax_ids');
    expect(customer).not.toHaveProperty('cash_balance');
  });

  it('the customer was created before the deletion event', () => {
    const ts = 1700000000;
    const event = customerDeleted({ timestamp: ts });
    expect(event.created).toBe(ts);
    expect(event.data.object.created).toBeLessThan(ts);
  });

  it('does not include previous_attributes', () => {
    expect(customerDeleted().data).not.toHaveProperty('previous_attributes');
  });

  it('accepts customerId so scenarios can share it', () => {
    const event = customerDeleted({ customerId: 'cus_gone123' });
    expect(event.data.object.id).toBe('cus_gone123');
  });

  it('accepts email, name, currency and metadata', () => {
    const customer = customerDeleted({
      email: 'former@test.com',
      name: 'Former Customer',
      currency: 'eur',
      metadata: { reason: 'churned' },
    }).data.object;
    expect(customer.email).toBe('former@test.com');
    expect(customer.name).toBe('Former Customer');
    expect(customer.currency).toBe('eur');
    expect(customer.metadata).toEqual({ reason: 'churned' });
  });

  it('accepts explicit null email and name', () => {
    const customer = customerDeleted({ email: null, name: null }).data.object;
    expect(customer.email).toBeNull();
    expect(customer.name).toBeNull();
  });
});

describe('customerDeleted full default shape at 2026-09-30.endive', () => {
  it('every default customer field is present', () => {
    const customer = customerDeleted().data.object;
    for (const field of [
      'address', 'balance', 'created', 'currency', 'customer_account', 'default_source',
      'delinquent', 'description', 'discount', 'email', 'invoice_prefix', 'invoice_settings',
      'livemode', 'metadata', 'name', 'next_invoice_sequence', 'phone', 'preferred_locales',
      'shipping', 'tax_exempt', 'test_clock',
    ]) {
      expect(customer, field).toHaveProperty(field);
    }
  });

  it('defaults match an unconfigured customer', () => {
    const customer = customerDeleted().data.object;
    expect(customer.address).toBeNull();
    expect(customer.shipping).toBeNull();
    expect(customer.discount).toBeNull();
    expect(customer.default_source).toBeNull();
    expect(customer.customer_account).toBeNull();
    expect(customer.test_clock).toBeNull();
    expect(customer.tax_exempt).toBe('none');
    expect(customer.preferred_locales).toEqual([]);
    expect(customer.next_invoice_sequence).toBe(1);
    expect(customer.invoice_settings).toEqual({
      custom_fields: null,
      default_payment_method: null,
      footer: null,
      rendering_options: null,
    });
  });

  it('omits invoice_credit_balance and the names that are present only when set', () => {
    const customer = customerDeleted().data.object;
    expect(customer).not.toHaveProperty('invoice_credit_balance');
    expect(customer).not.toHaveProperty('business_name');
    expect(customer).not.toHaveProperty('individual_name');
  });

  it('names the API or Dashboard request that deleted the customer', () => {
    expect(customerDeleted().request.id).toMatch(/^req_[A-Za-z0-9]{14}$/);
  });
});
