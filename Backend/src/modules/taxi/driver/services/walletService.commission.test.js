// Run: node --test Backend/src/modules/taxi/driver/services/walletService.commission.test.js
//
// Pins the commission arithmetic that settleCompletedRideWallet performs. These
// are the exact formulas used, restated here — walletService's internals are not
// exported and the real path needs a Mongo transaction, so this guards the math
// rather than the I/O. If you change the formulas in walletService, change these.
import assert from 'node:assert/strict';
import test from 'node:test';

// mirrors computeCommissionAmount in walletService.js
const computeCommissionAmount = ({ fare, type, value }) => {
  const safeFare = Math.round(Number(fare) * 100) / 100;
  const safeValue = Math.max(Math.round(Number(value || 0) * 100) / 100, 0);

  if (Number(type) === 1) {
    return Math.min(Math.round(safeFare * safeValue) / 100, safeFare);
  }

  return Math.min(safeValue, safeFare);
};

// mirrors the subscription-discount block in settleCompletedRideWallet
const applySubscriptionDiscount = (grossCommission, discountPercent) => {
  const pct = Math.min(100, Math.max(0, Number(discountPercent || 0)));
  const discount = Math.round(grossCommission * pct) / 100;
  return {
    discount,
    net: Math.max(Math.round((grossCommission - discount) * 100) / 100, 0),
  };
};

test('percentage commission (type 1)', () => {
  assert.equal(computeCommissionAmount({ fare: 500, type: 1, value: 20 }), 100);
  assert.equal(computeCommissionAmount({ fare: 250, type: 1, value: 15 }), 37.5);
});

test('fixed commission (type 0)', () => {
  assert.equal(computeCommissionAmount({ fare: 500, type: 0, value: 40 }), 40);
});

test('commission can never exceed the fare', () => {
  assert.equal(computeCommissionAmount({ fare: 100, type: 0, value: 999 }), 100);
  assert.equal(computeCommissionAmount({ fare: 100, type: 1, value: 500 }), 100);
});

test('negative commission config is floored at zero', () => {
  assert.equal(computeCommissionAmount({ fare: 100, type: 1, value: -50 }), 0);
  assert.equal(computeCommissionAmount({ fare: 100, type: 0, value: -50 }), 0);
});

test('subscription discount reduces commission, never below zero', () => {
  // 20% of 500 = 100 gross; a 25% discount plan leaves 75
  const gross = computeCommissionAmount({ fare: 500, type: 1, value: 20 });
  const { discount, net } = applySubscriptionDiscount(gross, 25);
  assert.equal(gross, 100);
  assert.equal(discount, 25);
  assert.equal(net, 75);

  // a 100% discount plan means the platform takes nothing
  assert.equal(applySubscriptionDiscount(gross, 100).net, 0);
  // no plan means no change
  assert.equal(applySubscriptionDiscount(gross, 0).net, 100);
  // a nonsense discount cannot invert the commission
  assert.equal(applySubscriptionDiscount(gross, 500).net, 0);
  assert.equal(applySubscriptionDiscount(gross, -10).net, 100);
});

test('driver earnings are fare minus net commission', () => {
  const gross = computeCommissionAmount({ fare: 500, type: 1, value: 20 });
  const { net } = applySubscriptionDiscount(gross, 25);
  const driverEarnings = Math.max(Math.round((500 - net) * 100) / 100, 0);
  assert.equal(driverEarnings, 425);
});

test('owner earnings are fare minus the owner commission', () => {
  // 15% owner commission on a 500 fare -> owner keeps 425
  const ownerCommission = computeCommissionAmount({ fare: 500, type: 1, value: 15 });
  assert.equal(ownerCommission, 75);
  assert.equal(Math.max(Math.round((500 - ownerCommission) * 100) / 100, 0), 425);
});

test('a zero fare settles to zero, not NaN', () => {
  const gross = computeCommissionAmount({ fare: 0, type: 1, value: 20 });
  assert.equal(gross, 0);
  assert.equal(applySubscriptionDiscount(gross, 50).net, 0);
});
