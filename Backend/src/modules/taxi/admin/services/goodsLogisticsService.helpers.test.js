// Run: node --test Backend/src/modules/taxi/admin/services/goodsLogisticsService.helpers.test.js
//
// Labour booking is money: the roster picks who is assigned AND what the customer
// is billed, and settlement credits those same people. Two things are pinned here
// because getting either wrong is a silent financial bug:
//   1. selection/pricing scales with the requested count and never bills for a
//      helper it could not supply;
//   2. earnings accrual is idempotent, so a re-settled ride cannot pay twice.
import assert from 'node:assert/strict';
import test from 'node:test';

import { MAX_HELPERS_PER_BOOKING, selectHelpersFromPool } from './goodsLogisticsService.js';
import { buildHelperEarningIncrements } from '../../driver/services/walletService.js';

// 24-hex ids so the ObjectId guard in buildHelperEarningIncrements accepts them.
const id = (n) => String(n).padStart(24, '0');

const roster = [
  { _id: id(1), name: 'Amit', helper_type: 'both', loading_charge: 100, unloading_charge: 80, total_jobs: 0 },
  { _id: id(2), name: 'Bala', helper_type: 'both', loading_charge: 120, unloading_charge: 90, total_jobs: 1 },
  { _id: id(3), name: 'Chetan', helper_type: 'loading', loading_charge: 60, unloading_charge: 0, total_jobs: 0 },
  { _id: id(4), name: 'Dinesh', helper_type: 'unloading', loading_charge: 0, unloading_charge: 70, total_jobs: 0 },
  { _id: id(5), name: 'Esha', helper_type: 'both', loading_charge: 200, unloading_charge: 200, total_jobs: 9, available: false },
];

// --- selection + pricing ----------------------------------------------------

test('no helper requested costs nothing and assigns nobody', () => {
  for (const helperType of [undefined, 'none', 'FREE_LABOUR']) {
    const selection = selectHelpersFromPool({ helperType, count: 3, helpers: roster });
    assert.equal(selection.type, 'none');
    assert.equal(selection.totalCharge, 0);
    assert.deepEqual(selection.assigned, []);
  }
});

test('a single loading helper is billed that helper\'s own loading rate', () => {
  const selection = selectHelpersFromPool({ helperType: 'loading', count: 1, helpers: roster });
  assert.equal(selection.count, 1);
  assert.equal(selection.assigned.length, 1);
  // least-used first, cheapest as the tiebreak: Amit/Chetan both have 0 jobs, Chetan is cheaper
  assert.equal(selection.assigned[0].name, 'Chetan');
  assert.equal(selection.assigned[0].charge, 60);
  assert.equal(selection.loadingCharge, 60);
  assert.equal(selection.unloadingCharge, 0);
  assert.equal(selection.totalCharge, 60);
});

test('charge scales with the helper count and is the sum of real per-person rates', () => {
  const selection = selectHelpersFromPool({ helperType: 'loading', count: 3, helpers: roster });
  assert.equal(selection.count, 3);
  // Chetan 60 + Amit 100 (both 0 jobs) then Bala 120 (1 job)
  assert.deepEqual(selection.assigned.map((item) => item.charge), [60, 100, 120]);
  assert.equal(selection.totalCharge, 280);
  // and never the max-rate-times-count shortcut
  assert.notEqual(selection.totalCharge, 120 * 3);
});

test('"both" needs one person who does both jobs, not a loader plus an unloader', () => {
  const selection = selectHelpersFromPool({ helperType: 'both', count: 2, helpers: roster });
  assert.deepEqual(selection.assigned.map((item) => item.name), ['Amit', 'Bala']);
  assert.equal(selection.loadingCharge, 220);
  assert.equal(selection.unloadingCharge, 170);
  assert.equal(selection.totalCharge, 390);
  // each assigned person earns their own loading + unloading rate
  assert.deepEqual(selection.assigned.map((item) => item.charge), [180, 210]);
});

test('unavailable helpers are never assigned or billed', () => {
  const selection = selectHelpersFromPool({ helperType: 'both', count: 5, helpers: roster });
  assert.ok(!selection.assigned.some((item) => item.name === 'Esha'));
});

test('a thin roster reduces the count instead of billing phantom labour', () => {
  const selection = selectHelpersFromPool({ helperType: 'unloading', count: 4, helpers: roster });
  // Dinesh, Amit, Bala can unload; the customer asked for 4
  assert.equal(selection.requestedCount, 4);
  assert.equal(selection.count, 3);
  assert.equal(selection.assigned.length, 3);
  assert.equal(selection.totalCharge, selection.assigned.reduce((sum, item) => sum + item.charge, 0));
});

test('an empty roster collapses to none rather than charging for nobody', () => {
  const selection = selectHelpersFromPool({ helperType: 'both', count: 2, helpers: [] });
  assert.equal(selection.type, 'none');
  assert.equal(selection.count, 0);
  assert.equal(selection.totalCharge, 0);
});

test('the count is clamped so a client cannot book an unbounded crew', () => {
  const many = Array.from({ length: 40 }, (_, index) => ({
    _id: id(index + 10),
    name: `H${index}`,
    helper_type: 'loading',
    loading_charge: 50,
    total_jobs: 0,
  }));
  const selection = selectHelpersFromPool({ helperType: 'loading', count: 999, helpers: many });
  assert.equal(selection.count, MAX_HELPERS_PER_BOOKING);
  assert.equal(selection.totalCharge, 50 * MAX_HELPERS_PER_BOOKING);
});

test('a missing or junk count means one helper, never zero-charge free labour', () => {
  for (const count of [undefined, 0, -3, 'abc']) {
    const selection = selectHelpersFromPool({ helperType: 'loading', count, helpers: roster });
    assert.equal(selection.count, 1, `count=${count}`);
    assert.ok(selection.totalCharge > 0);
  }
});

// --- earnings accrual idempotency -------------------------------------------

const rideWithHelpers = (overrides = {}) => ({
  helpersSettledAt: null,
  parcel: {
    helper: {
      type: 'both',
      count: 2,
      assigned: [
        { helperId: id(1), name: 'Amit', charge: 180 },
        { helperId: id(2), name: 'Bala', charge: 210 },
      ],
    },
  },
  ...overrides,
});

test('each assigned helper is credited their own charge exactly once', () => {
  const increments = buildHelperEarningIncrements(rideWithHelpers());
  assert.deepEqual(increments, [
    { helperId: id(1), earnings: 180, jobs: 1 },
    { helperId: id(2), earnings: 210, jobs: 1 },
  ]);
});

test('a ride already stamped helpersSettledAt credits nothing (idempotent)', () => {
  const increments = buildHelperEarningIncrements(rideWithHelpers({ helpersSettledAt: new Date() }));
  assert.deepEqual(increments, []);
});

test('rides with no labour produce no increments', () => {
  assert.deepEqual(buildHelperEarningIncrements(null), []);
  assert.deepEqual(buildHelperEarningIncrements({}), []);
  assert.deepEqual(buildHelperEarningIncrements({ parcel: { helper: { type: 'none', assigned: [] } } }), []);
});

test('the same helper assigned twice on one ride is one $inc, not two updates', () => {
  const increments = buildHelperEarningIncrements(
    rideWithHelpers({
      parcel: {
        helper: {
          assigned: [
            { helperId: id(1), charge: 100 },
            { helperId: id(1), charge: 80 },
          ],
        },
      },
    }),
  );
  assert.equal(increments.length, 1);
  assert.deepEqual(increments[0], { helperId: id(1), earnings: 180, jobs: 2 });
});

test('unusable helper ids are skipped so settlement cannot throw a CastError', () => {
  const increments = buildHelperEarningIncrements(
    rideWithHelpers({
      parcel: { helper: { assigned: [{ helperId: '', charge: 50 }, { helperId: 'not-an-id', charge: 50 }] } },
    }),
  );
  assert.deepEqual(increments, []);
});

test('a negative or junk charge never credits a negative amount', () => {
  const increments = buildHelperEarningIncrements(
    rideWithHelpers({
      parcel: { helper: { assigned: [{ helperId: id(1), charge: -500 }, { helperId: id(2), charge: 'free' }] } },
    }),
  );
  assert.deepEqual(increments.map((item) => item.earnings), [0, 0]);
});
