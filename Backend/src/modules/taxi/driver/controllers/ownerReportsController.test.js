// Run: node --test Backend/src/modules/taxi/driver/controllers/ownerReportsController.test.js
//
// These three helpers decide (a) how far back an owner report reaches, (b) the
// money totals shown on the earnings screen, and (c) whether a vehicle is flagged
// as having an expired document. An off-by-one in any of them is either a silently
// wrong payout figure or a truck on the road with lapsed insurance.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  expiryStatus,
  resolveReportRange,
  summarizeBuckets,
} from './ownerReportsController.js';

const NOW = new Date('2026-07-25T09:30:00.000Z');

test('default window is the trailing 30 days of day buckets', () => {
  const range = resolveReportRange({}, NOW);
  assert.equal(range.groupBy, 'day');
  assert.equal(range.format, '%Y-%m-%d');
  assert.equal((range.end - range.start) / 86400000, 30);
});

test('month grouping defaults to a year of buckets', () => {
  const range = resolveReportRange({ groupBy: 'MONTH' }, NOW);
  assert.equal(range.groupBy, 'month');
  assert.equal(range.format, '%Y-%m');
  assert.equal((range.end - range.start) / 86400000, 365);
});

test('an inclusive ?to date covers that whole day', () => {
  const range = resolveReportRange({ from: '2026-07-01', to: '2026-07-25' }, NOW);
  assert.equal(range.start.toISOString(), '2026-07-01T00:00:00.000Z');
  // end is exclusive, so it must land at the start of the 26th.
  assert.equal(range.end.toISOString(), '2026-07-26T00:00:00.000Z');
});

test('an inverted or garbage range falls back to the default span', () => {
  const inverted = resolveReportRange({ from: '2026-07-20', to: '2026-07-01' }, NOW);
  assert.equal((inverted.end - inverted.start) / 86400000, 30);

  const garbage = resolveReportRange({ from: 'not-a-date' }, NOW);
  assert.equal((garbage.end - garbage.start) / 86400000, 30);
});

test('an oversized range is clamped so bucket fan-out stays bounded', () => {
  const range = resolveReportRange({ from: '2010-01-01', to: '2026-07-25' }, NOW);
  assert.equal((range.end - range.start) / 86400000, 366);
});

test('bucket totals sum money and derive per-trip averages', () => {
  const totals = summarizeBuckets([
    {
      trips: 4,
      completedTrips: 3,
      cancelledTrips: 1,
      grossRevenue: 300.5,
      ownerEarnings: 240.25,
      commission: 60.25,
      cashTrips: 2,
      onlineTrips: 2,
      unsettledTrips: 1,
      unsettledGross: 100,
    },
    {
      trips: 2,
      completedTrips: 1,
      cancelledTrips: 1,
      grossRevenue: 99.5,
      ownerEarnings: 79.75,
      commission: 19.75,
      cashTrips: 1,
      onlineTrips: 1,
      unsettledTrips: 0,
      unsettledGross: 0,
    },
  ]);

  assert.equal(totals.trips, 6);
  assert.equal(totals.completedTrips, 4);
  assert.equal(totals.grossRevenue, 400);
  assert.equal(totals.ownerEarnings, 320);
  assert.equal(totals.commission, 80);
  assert.equal(totals.averageOwnerEarningsPerTrip, 80);
  assert.equal(totals.averageFare, 100);
  // Unsettled fares are surfaced, never folded into ownerEarnings.
  assert.equal(totals.unsettledTrips, 1);
  assert.equal(totals.unsettledGross, 100);
});

test('empty buckets produce zeroes, not NaN averages', () => {
  const totals = summarizeBuckets([]);
  assert.equal(totals.trips, 0);
  assert.equal(totals.ownerEarnings, 0);
  assert.equal(totals.averageOwnerEarningsPerTrip, 0);
  assert.equal(totals.averageFare, 0);
});

test('a document expiring inside the warning window is flagged, not expired', () => {
  const status = expiryStatus('2026-08-10', { now: NOW });
  assert.equal(status.expiryDate, '2026-08-10');
  assert.equal(status.daysRemaining, 16);
  assert.equal(status.expiringSoon, true);
  assert.equal(status.expired, false);
});

test('expiry day itself counts as expiring soon, the day after as expired', () => {
  const sameDay = expiryStatus('2026-07-25', { now: NOW });
  assert.equal(sameDay.daysRemaining, 0);
  assert.equal(sameDay.expiringSoon, true);
  assert.equal(sameDay.expired, false);

  const yesterday = expiryStatus('2026-07-24', { now: NOW });
  assert.equal(yesterday.daysRemaining, -1);
  assert.equal(yesterday.expired, true);
  assert.equal(yesterday.expiringSoon, false);
});

test('a far-off expiry is neither expired nor expiring soon', () => {
  const status = expiryStatus('2027-01-01', { now: NOW });
  assert.equal(status.expired, false);
  assert.equal(status.expiringSoon, false);
  assert.equal(status.daysRemaining, 160);
});

test('missing or unparseable expiry dates never flag as expired', () => {
  for (const value of ['', null, undefined, 'soon', '31/02/2026']) {
    const status = expiryStatus(value, { now: NOW });
    assert.equal(status.expiryDate, '');
    assert.equal(status.daysRemaining, null);
    assert.equal(status.expired, false);
    assert.equal(status.expiringSoon, false);
  }
});
