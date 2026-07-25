// Run: node --test Backend/src/modules/taxi/services/rideService.proofOfDelivery.test.js
//
// The receiver OTP is the only thing standing between "parcel handed to the right
// person" and "driver closed the job from the pavement", and the guard has to stay
// silent for taxi rides and for parcel rows created before proof-of-delivery
// existed. These asserts pin both the guard and the proof normalisation.
import assert from 'node:assert/strict';
import test from 'node:test';

import { assertParcelHandoverAllowed, normalizeParcelPayload } from './rideService.js';

const parcelRide = (overrides = {}) => ({
  serviceType: 'parcel',
  liveStatus: 'arrived',
  parcel: { deliveryOtp: '4321', proofOfDelivery: {} },
  ...overrides,
});

test('correct receiver OTP allows completion', () => {
  assertParcelHandoverAllowed(parcelRide(), { nextStatus: 'completed', deliveryOtp: '4321' });
});

test('wrong or missing receiver OTP blocks completion', () => {
  for (const deliveryOtp of ['1234', '', undefined, null, '43210']) {
    assert.throws(
      () => assertParcelHandoverAllowed(parcelRide(), { nextStatus: 'completed', deliveryOtp }),
      /Incorrect delivery OTP/,
    );
  }
});

test('taxi rides are never asked for a delivery OTP', () => {
  assertParcelHandoverAllowed(
    { serviceType: 'ride', liveStatus: 'arrived', parcel: { deliveryOtp: '4321' } },
    { nextStatus: 'completed', deliveryOtp: '' },
  );
});

test('legacy parcel rows without a delivery OTP still complete', () => {
  assertParcelHandoverAllowed(parcelRide({ parcel: {} }), { nextStatus: 'completed' });
  assertParcelHandoverAllowed(parcelRide({ parcel: { deliveryOtp: '' } }), { nextStatus: 'completed' });
});

test('already recorded proof satisfies the guard without re-entering the OTP', () => {
  assertParcelHandoverAllowed(
    parcelRide({ parcel: { deliveryOtp: '4321', proofOfDelivery: { deliveredAt: new Date() } } }),
    { nextStatus: 'completed' },
  );
});

test('only the -> completed edge is guarded, and it is idempotent', () => {
  assertParcelHandoverAllowed(parcelRide(), { nextStatus: 'started', deliveryOtp: '' });
  assertParcelHandoverAllowed(parcelRide(), { nextStatus: 'arrived', deliveryOtp: '' });
  assertParcelHandoverAllowed(parcelRide({ liveStatus: 'completed' }), { nextStatus: 'completed' });
});

test('proof of delivery normalises to persistable shape', () => {
  const parcel = normalizeParcelPayload({
    deliveryOtp: ' 9182 ',
    proofOfDelivery: {
      photoUrl: ' https://res.cloudinary.com/demo/photo.jpg ',
      signatureUrl: 'https://res.cloudinary.com/demo/sign.png',
      receivedBy: '  Asha Verma ',
    },
  });

  assert.equal(parcel.deliveryOtp, '9182');
  assert.equal(parcel.proofOfDelivery.photoUrl, 'https://res.cloudinary.com/demo/photo.jpg');
  assert.equal(parcel.proofOfDelivery.signatureUrl, 'https://res.cloudinary.com/demo/sign.png');
  assert.equal(parcel.proofOfDelivery.receivedBy, 'Asha Verma');
  assert.equal(parcel.proofOfDelivery.deliveredAt, null);
});

test('missing proof of delivery normalises to empty, never undefined', () => {
  const parcel = normalizeParcelPayload({});

  assert.equal(parcel.deliveryOtp, '');
  assert.deepEqual(parcel.proofOfDelivery, {
    photoUrl: '',
    signatureUrl: '',
    receivedBy: '',
    deliveredAt: null,
  });
});
