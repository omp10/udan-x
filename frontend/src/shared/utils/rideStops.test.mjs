// Run: node --test frontend/src/shared/utils/rideStops.test.mjs
//
// Stops cross three screens and now carry coordinates. A shape mix-up here means
// the driver is sent to the wrong place, so pin both shapes and the legacy one.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getStopAddress,
  getStopCoordinates,
  toStopAddresses,
  toStopCoordsMap,
  toStopPayload,
} from './rideStops.js';

test('legacy plain strings still read as addresses', () => {
  assert.equal(getStopAddress('  Vijay Nagar  '), 'Vijay Nagar');
  assert.equal(getStopCoordinates('Vijay Nagar'), null);
});

test('object stops expose address and coordinates', () => {
  const stop = { address: 'Palasia', coordinates: [75.88, 22.72] };
  assert.equal(getStopAddress(stop), 'Palasia');
  assert.deepEqual(getStopCoordinates(stop), [75.88, 22.72]);
});

test('malformed coordinates degrade to null rather than a bad point', () => {
  assert.equal(getStopCoordinates({ address: 'x', coordinates: [75.8] }), null);
  assert.equal(getStopCoordinates({ address: 'x', coordinates: ['a', 'b'] }), null);
  assert.equal(getStopCoordinates({ address: 'x', coordinates: null }), null);
  assert.equal(getStopCoordinates({ address: 'x' }), null);
});

test('toStopAddresses drops blanks and mixes shapes', () => {
  assert.deepEqual(
    toStopAddresses(['A', '   ', { address: 'B', coordinates: [1, 2] }, { address: '' }]),
    ['A', 'B'],
  );
});

test('toStopPayload keeps coordinates and removes blank addresses', () => {
  assert.deepEqual(
    toStopPayload([{ address: 'A', coordinates: [1, 2] }, { address: '  ' }, 'B']),
    [
      { address: 'A', coordinates: [1, 2] },
      { address: 'B', coordinates: null },
    ],
  );
});

test('toStopCoordsMap only indexes stops that actually resolved', () => {
  assert.deepEqual(
    toStopCoordsMap([{ address: 'A', coordinates: [1, 2] }, 'B', { address: 'C', coordinates: [3, 4] }]),
    { 0: [1, 2], 2: [3, 4] },
  );
});

test('non-array input is handled everywhere', () => {
  for (const bad of [undefined, null, 'A', 42, {}]) {
    assert.deepEqual(toStopAddresses(bad), []);
    assert.deepEqual(toStopPayload(bad), []);
    assert.deepEqual(toStopCoordsMap(bad), {});
  }
});
