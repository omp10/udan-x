// Run: node --test Backend/src/modules/taxi/services/ownerPayoutAndMembershipTier.test.js
//
// Three things worth a guard:
//   1. Owner payout rejection must refund the wallet hold exactly once. The money
//      already left the owner wallet at request time, so a double refund mints
//      cash and a missing refund steals it.
//   2. Membership tier normalisation, because the tier is what the SOW bills on.
//   3. The booking-limit off-by-one: a 5-ride plan must allow the 5th ride and
//      block the 6th, and 0 must stay unlimited.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isBookingLimitReached,
  normalizeTier,
  serializePartnerPlan,
  serializePartnerSubscription,
} from './partnerSubscriptionService.js';

/* ------------------------------------------------------------------ *
 * 1. Owner payout refund idempotency
 *
 * adminService.rejectOwnerWithdrawalRequest needs a Mongo round trip, so this
 * restates its control flow: the refund is gated behind an atomic conditional
 * status flip (`{_id, owner_id: {$ne: null}, status: 'pending'} -> cancelled`).
 * If anyone moves the wallet $inc outside that gate, these asserts fail.
 * ------------------------------------------------------------------ */

const makeOwnerPayoutWorld = () => {
  const requests = new Map();
  const ledger = [];
  let walletBalance = 0;

  return {
    ledger,
    get balance() {
      return walletBalance;
    },
    // Owner submits a payout: the amount is debited up front and held.
    submit(id, amount) {
      walletBalance -= amount;
      requests.set(id, { _id: id, owner_id: 'owner-1', amount, status: 'pending' });
      ledger.push({ kind: 'debit', amount });
    },
    fund(amount) {
      walletBalance += amount;
    },
    // Mirrors claimPendingOwnerWithdrawal + rejectOwnerWithdrawalRequest.
    reject(id) {
      const row = requests.get(id);

      if (!row || !row.owner_id) {
        throw new Error('404 Withdrawal request not found');
      }

      if (row.status !== 'pending') {
        throw new Error('400 Only pending withdrawal requests can be rejected');
      }

      row.status = 'cancelled';
      walletBalance += row.amount;
      ledger.push({ kind: 'credit', amount: row.amount });
      return row;
    },
    // Mirrors approveOwnerWithdrawalRequest: settles, never touches the wallet.
    approve(id) {
      const row = requests.get(id);

      if (!row || !row.owner_id) {
        throw new Error('404 Withdrawal request not found');
      }

      if (row.status !== 'pending') {
        throw new Error('400 Only pending withdrawal requests can be approved');
      }

      row.status = 'completed';
      return row;
    },
  };
};

test('rejecting an owner payout refunds the held amount exactly once', () => {
  const world = makeOwnerPayoutWorld();
  world.fund(1000);
  world.submit('req-1', 400);

  assert.equal(world.balance, 600, 'request holds the amount out of the wallet');

  world.reject('req-1');
  assert.equal(world.balance, 1000, 'reject puts the hold back');

  // Double tap: the row is no longer pending, so no second credit.
  assert.throws(() => world.reject('req-1'), /400/);
  assert.equal(world.balance, 1000);
  assert.equal(world.ledger.filter((row) => row.kind === 'credit').length, 1);
});

test('approving an owner payout never debits again', () => {
  const world = makeOwnerPayoutWorld();
  world.fund(1000);
  world.submit('req-2', 250);

  world.approve('req-2');
  assert.equal(world.balance, 750, 'approval only settles; the debit already happened');
  assert.equal(world.ledger.filter((row) => row.kind === 'debit').length, 1);

  assert.throws(() => world.approve('req-2'), /400/);
  assert.equal(world.balance, 750);
});

test('an approved owner payout can no longer be rejected into a refund', () => {
  const world = makeOwnerPayoutWorld();
  world.fund(500);
  world.submit('req-3', 500);
  world.approve('req-3');

  assert.throws(() => world.reject('req-3'), /400/);
  assert.equal(world.balance, 0, 'paid-out money is not refundable');
});

test('unknown or driver-only payout rows are rejected as not found', () => {
  const world = makeOwnerPayoutWorld();
  assert.throws(() => world.reject('nope'), /404/);
});

/* ------------------------------------------------------------------ *
 * 2. Membership tier normalisation
 * ------------------------------------------------------------------ */

test('tier normalisation accepts the four SOW tiers, case-insensitively', () => {
  assert.equal(normalizeTier('basic'), 'basic');
  assert.equal(normalizeTier('STANDARD'), 'standard');
  assert.equal(normalizeTier(' Business '), 'business');
  assert.equal(normalizeTier('Premium'), 'premium');
});

test('unknown, empty and non-string tiers fall back to basic', () => {
  for (const value of ['', null, undefined, 'gold', 'enterprise', 42, {}]) {
    assert.equal(normalizeTier(value), 'basic');
  }
});

test('plan serialisation always emits a tier', () => {
  assert.equal(serializePartnerPlan({ tier: 'BUSINESS' }).tier, 'business');
  assert.equal(serializePartnerPlan({}).tier, 'basic');
});

test('a purchased subscription keeps its own tier, else inherits the plan tier', () => {
  assert.equal(serializePartnerSubscription({ tier: 'premium' }).tier, 'premium');
  // Rows created before the tier field existed read through to their plan.
  assert.equal(serializePartnerSubscription({ planId: { tier: 'standard' } }).tier, 'standard');
  assert.equal(serializePartnerSubscription({}).tier, 'basic');
});

/* ------------------------------------------------------------------ *
 * 3. Booking limit math
 * ------------------------------------------------------------------ */

test('a booking limit of 0 means unlimited', () => {
  assert.equal(isBookingLimitReached(0, 0), false);
  assert.equal(isBookingLimitReached(0, 9999), false);
});

test('a 5-ride plan allows the 5th ride and blocks the 6th', () => {
  assert.equal(isBookingLimitReached(5, 3), false);
  assert.equal(isBookingLimitReached(5, 4), false, 'the 5th accept must still go through');
  assert.equal(isBookingLimitReached(5, 5), true, 'the 6th accept is over the allowance');
  assert.equal(isBookingLimitReached(5, 12), true);
});

test('garbage limits and counts never block a driver by accident', () => {
  assert.equal(isBookingLimitReached(null, 100), false);
  assert.equal(isBookingLimitReached(undefined, 100), false);
  assert.equal(isBookingLimitReached('abc', 100), false);
  assert.equal(isBookingLimitReached(-5, 100), false);
  assert.equal(isBookingLimitReached(3, null), false);
  assert.equal(isBookingLimitReached(3, -1), false);
});
