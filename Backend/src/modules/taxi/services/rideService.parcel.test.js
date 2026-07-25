// Run: node --test Backend/src/modules/taxi/services/rideService.parcel.test.js
//
// The parcel load details drive vehicle recommendation, so a ton/kg mix-up is a
// 1000x error in which vehicle gets dispatched. These asserts pin the conversion
// and the client-input clamping.
import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeParcelPayload, normalizeStopsPayload } from './rideService.js';

test('explicit kg weight passes through', () => {
  const parcel = normalizeParcelPayload({ weightKg: 42, weightUnit: 'kg' });
  assert.equal(parcel.weightKg, 42);
  assert.equal(parcel.weightUnit, 'kg');
});

test('tons are converted to kg', () => {
  const parcel = normalizeParcelPayload({ weightKg: 1.5, weightUnit: 'ton' });
  assert.equal(parcel.weightKg, 1500);
  assert.equal(parcel.weightUnit, 'ton');
});

test('legacy free-text weight bands still yield a number', () => {
  assert.equal(normalizeParcelPayload({ weight: 'Under 5kg' }).weightKg, 5);
  assert.equal(normalizeParcelPayload({ weight: '100kg - 500kg' }).weightKg, 100500);
  assert.equal(normalizeParcelPayload({ weight: '250' }).weightKg, 250);
});

test('a ton-flavoured legacy label is scaled, not read as kg', () => {
  const parcel = normalizeParcelPayload({ weight: '2 Ton' });
  assert.equal(parcel.weightKg, 2000);
  assert.equal(parcel.weightUnit, 'ton');
});

test('package count floors at 1 and rejects garbage', () => {
  assert.equal(normalizeParcelPayload({}).packageCount, 1);
  assert.equal(normalizeParcelPayload({ packageCount: 0 }).packageCount, 1);
  assert.equal(normalizeParcelPayload({ packageCount: -7 }).packageCount, 1);
  assert.equal(normalizeParcelPayload({ packageCount: 'abc' }).packageCount, 1);
  assert.equal(normalizeParcelPayload({ packageCount: '4.8' }).packageCount, 4);
});

test('negative dimensions collapse to 0 and the unit is whitelisted', () => {
  const parcel = normalizeParcelPayload({
    dimensions: { length: -5, width: 30, height: 'x', unit: 'furlong' },
  });
  assert.deepEqual(parcel.dimensions, { length: 0, width: 30, height: 0, unit: 'cm' });
});

test('helper type is whitelisted so an arbitrary string cannot be stored', () => {
  assert.equal(normalizeParcelPayload({}).helper.type, 'none');
  assert.equal(normalizeParcelPayload({ helperType: 'both' }).helper.type, 'both');
  assert.equal(normalizeParcelPayload({ helperType: 'FREE_LABOUR' }).helper.type, 'none');
  assert.equal(normalizeParcelPayload({ helper: { type: 'loading' } }).helper.type, 'loading');
});

test('the SOW fields that previously had nowhere to go are all captured', () => {
  const parcel = normalizeParcelPayload({
    materialName: '  Refrigerator ',
    handlingInstructions: ' keep upright ',
    isFragile: true,
    warehouse: { pickupId: 'wh1', dropId: 'wh2' },
  });
  assert.equal(parcel.materialName, 'Refrigerator');
  assert.equal(parcel.handlingInstructions, 'keep upright');
  assert.equal(parcel.isFragile, true);
  assert.equal(parcel.warehouse.pickupId, 'wh1');
  assert.equal(parcel.warehouse.dropId, 'wh2');
});

test('outstation scope and flag stay consistent whichever one the client sends', () => {
  assert.equal(normalizeParcelPayload({ deliveryScope: 'outstation' }).isOutstation, true);
  assert.equal(normalizeParcelPayload({ isOutstation: true }).deliveryScope, 'outstation');
  assert.equal(normalizeParcelPayload({}).deliveryScope, 'city');
  assert.equal(normalizeParcelPayload({}).isOutstation, false);
});

// --- multi-stop -------------------------------------------------------------
// The taxi UI collects stops as plain address strings and priced routes through
// them, but dropped them from the booking payload entirely.

test('plain address strings are accepted and blanks dropped', () => {
  const stops = normalizeStopsPayload(['Vijay Nagar', '   ', 'Palasia']);
  assert.equal(stops.length, 2);
  assert.deepEqual(stops.map((s) => s.address), ['Vijay Nagar', 'Palasia']);
  // no coordinates supplied -> the geo shape must stay unset, not [0,0]
  assert.ok(stops.every((s) => s.location === undefined));
});

test('object stops keep valid coordinates and kind', () => {
  const [stop] = normalizeStopsPayload([
    { address: 'Warehouse A', coordinates: [75.8, 22.7], kind: 'pickup' },
  ]);
  assert.deepEqual(stop.location, { type: 'Point', coordinates: [75.8, 22.7] });
  assert.equal(stop.kind, 'pickup');
});

test('out-of-range coordinates are dropped unless there is an address', () => {
  assert.equal(normalizeStopsPayload([{ coordinates: [999, 999] }]).length, 0);
  const kept = normalizeStopsPayload([{ address: 'Somewhere', coordinates: [999, 999] }]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].location, undefined);
});

test('stops are ordered by sequence and renumbered contiguously', () => {
  const stops = normalizeStopsPayload([
    { address: 'third', sequence: 9 },
    { address: 'first', sequence: 0 },
    { address: 'second', sequence: 4 },
  ]);
  assert.deepEqual(stops.map((s) => s.address), ['first', 'second', 'third']);
  assert.deepEqual(stops.map((s) => s.sequence), [0, 1, 2]);
});

test('stop count is capped so a client cannot post an unbounded array', () => {
  const many = Array.from({ length: 100 }, (_, i) => `stop ${i}`);
  assert.equal(normalizeStopsPayload(many).length, 10);
});

test('an unexpected kind falls back to a generic stop', () => {
  assert.equal(normalizeStopsPayload([{ address: 'x', kind: 'TELEPORT' }])[0].kind, 'stop');
});

test('non-array input yields no stops instead of throwing', () => {
  assert.deepEqual(normalizeStopsPayload(undefined), []);
  assert.deepEqual(normalizeStopsPayload(null), []);
  assert.deepEqual(normalizeStopsPayload('Vijay Nagar'), []);
});
