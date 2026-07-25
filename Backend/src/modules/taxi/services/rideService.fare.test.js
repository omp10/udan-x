// Run: node --test Backend/src/modules/taxi/services/rideService.fare.test.js
//
// Guards the server-authoritative fare path. Before this existed, createRideRecord
// took `fare` straight from the request body, so a client could book any ride for
// ₹1. These asserts fail if the SetPrice fields stop being read.
import assert from 'node:assert/strict';
import test from 'node:test';

import { haversineKm } from '../../../utils/geo.js';
import { computeTaxiFareBreakdown } from './rideService.js';

// base 50 for the first 2km, then 10/km, 1/min, 5% tax
const RULE = {
  base_price: 50,
  base_distance: 2,
  price_per_distance: 10,
  time_price: 1,
  service_tax: 5,
  outstation_base_price: 500,
  outstation_base_distance: 10,
  outstation_price_per_distance: 8,
  outstation_time_price: 0,
};

test('charges base price only inside the base distance', () => {
  const fare = computeTaxiFareBreakdown({ pricingRule: RULE, distanceKm: 1.5, durationMinutes: 0 });
  assert.equal(fare.subtotal, 50);
  assert.equal(fare.total, 52.5); // + 5% tax
});

test('charges per-km beyond the base distance, plus time', () => {
  const fare = computeTaxiFareBreakdown({ pricingRule: RULE, distanceKm: 12, durationMinutes: 20 });
  // 50 + (12-2)*10 + 20*1 = 170
  assert.equal(fare.subtotal, 170);
  assert.equal(fare.total, 178.5);
  assert.equal(fare.serviceTaxAmount, 8.5);
});

test('uses the outstation column when the ride is outstation', () => {
  const fare = computeTaxiFareBreakdown({
    pricingRule: RULE,
    distanceKm: 110,
    durationMinutes: 200,
    isOutstation: true,
  });
  // 500 + (110-10)*8 + 200*0 = 1300, outstation time_price is 0 so duration is free
  assert.equal(fare.subtotal, 1300);
});

test('reports not-configured so the caller can fall back, instead of pricing at 0', () => {
  // An un-priced vehicle/zone must not silently produce a free ride.
  for (const rule of [null, {}, { base_price: 0, price_per_distance: 0, time_price: 99 }]) {
    const fare = computeTaxiFareBreakdown({ pricingRule: rule, distanceKm: 40, durationMinutes: 60 });
    assert.equal(fare.configured, false, `expected not-configured for ${JSON.stringify(rule)}`);
    assert.equal(fare.total, 0);
  }
});

test('negative and garbage inputs cannot drive the fare below the base price', () => {
  const fare = computeTaxiFareBreakdown({
    pricingRule: RULE,
    distanceKm: -500,
    durationMinutes: -90,
  });
  assert.equal(fare.subtotal, 50);
  assert.ok(fare.total >= 0);
});

test('haversine floors a lied-about trip distance', () => {
  // Indore -> Bhopal is ~190km straight line. A client claiming 0m must still be
  // charged for the real distance between the two points it submitted.
  const indore = [75.8577, 22.7196];
  const bhopal = [77.4126, 23.2599];
  const straightLineKm = haversineKm(indore, bhopal);
  assert.ok(straightLineKm > 150 && straightLineKm < 220, `got ${straightLineKm}`);

  const clientClaimsZeroMeters = 0;
  const distanceKm = Math.max(straightLineKm, clientClaimsZeroMeters / 1000);
  const fare = computeTaxiFareBreakdown({ pricingRule: RULE, distanceKm, durationMinutes: 0 });
  assert.ok(fare.total > 1800, `expected a real long-trip fare, got ${fare.total}`);
});

test('haversine is 0 for malformed coordinate input', () => {
  assert.equal(haversineKm([], []), 0);
  assert.equal(haversineKm([1, 2], null), 0);
  assert.equal(haversineKm(['x', 'y'], [1, 2]), 0);
});
