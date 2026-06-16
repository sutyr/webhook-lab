// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { customerCreated, customerUpdated } from '../../../src/generators/customers.js';

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
