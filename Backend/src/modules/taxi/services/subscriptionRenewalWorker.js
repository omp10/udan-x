// Auto-renewal + expiry sweep for partner (driver/owner) subscriptions.
//
// Before this existed, `recurring_enabled`, `autoRenew` and `nextBillingAt` were
// all written at purchase time and NEVER read — there was no cron dependency in
// the project at all, so nothing ever renewed or reminded.
//
// ponytail: plain setInterval in-process, matching how dispatchService.js already
// runs its sweeps. If the API is ever scaled to multiple instances this needs a
// distributed lock (Redis is already available in infrastructure/redis) so two
// instances cannot double-charge the same subscription.
import { Owner } from '../admin/models/Owner.js';
import { OwnerWalletTransaction } from '../admin/models/OwnerWalletTransaction.js';
import { Driver } from '../driver/models/Driver.js';
import { PartnerSubscription } from '../driver/models/PartnerSubscription.js';
import { WalletTransaction } from '../driver/models/WalletTransaction.js';

const RENEWAL_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
const RENEWAL_BATCH_SIZE = 50;

let sweepTimer = null;

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const addDays = (value, days) => {
  const next = new Date(value);
  next.setDate(next.getDate() + Math.max(0, Number(days || 0)));
  return next;
};

const markExpired = async (subscription, reason) => {
  subscription.status = 'expired';
  subscription.active = false;
  subscription.nextBillingAt = null;
  subscription.lastRenewalError = reason || '';
  await subscription.save();
};

const renewDriverSubscription = async (subscription) => {
  const driver = await Driver.findById(subscription.driverId);

  if (!driver) {
    await markExpired(subscription, 'driver not found');
    return { renewed: false, reason: 'driver_not_found' };
  }

  const amount = roundMoney(subscription.amount);
  const balanceBefore = Number(driver.wallet?.balance || 0);

  if (balanceBefore < amount) {
    await markExpired(subscription, 'insufficient wallet balance at renewal');
    return { renewed: false, reason: 'insufficient_balance' };
  }

  const balanceAfter = roundMoney(balanceBefore - amount);
  driver.wallet = driver.wallet || {};
  driver.wallet.balance = balanceAfter;
  driver.markModified('wallet');
  await driver.save();

  await WalletTransaction.create({
    driverId: driver._id,
    amount: -amount,
    type: 'adjustment',
    description: `${subscription.name} subscription auto-renewal`,
    balanceBefore,
    balanceAfter,
  });

  return { renewed: true, balanceAfter };
};

const renewOwnerSubscription = async (subscription) => {
  const owner = await Owner.findById(subscription.ownerId);

  if (!owner) {
    await markExpired(subscription, 'owner not found');
    return { renewed: false, reason: 'owner_not_found' };
  }

  const amount = roundMoney(subscription.amount);
  const balanceBefore = Number(owner.wallet?.balance || 0);

  if (balanceBefore < amount) {
    await markExpired(subscription, 'insufficient wallet balance at renewal');
    return { renewed: false, reason: 'insufficient_balance' };
  }

  const balanceAfter = roundMoney(balanceBefore - amount);
  owner.wallet = owner.wallet || {};
  owner.wallet.balance = balanceAfter;
  owner.markModified('wallet');
  await owner.save();

  await OwnerWalletTransaction.create({
    ownerId: owner._id,
    amount,
    kind: 'debit',
    title: `${subscription.name} subscription auto-renewal`,
    balance: balanceAfter,
  });

  return { renewed: true, balanceAfter };
};

export const runSubscriptionRenewalSweep = async () => {
  const now = new Date();
  const summary = { expired: 0, renewed: 0, failed: 0 };

  // 1. Expire anything past its date that is not set to auto-renew. Expiry was
  //    previously only flipped lazily when someone happened to read the record.
  const expiredResult = await PartnerSubscription.updateMany(
    {
      status: 'active',
      expiresAt: { $lte: now },
      $or: [{ autoRenew: { $ne: true } }, { recurring_enabled: { $ne: true } }],
    },
    { $set: { status: 'expired', active: false, nextBillingAt: null } },
  );
  summary.expired = expiredResult.modifiedCount || 0;

  // 2. Renew the ones that opted in and are due.
  const due = await PartnerSubscription.find({
    status: 'active',
    autoRenew: true,
    recurring_enabled: true,
    expiresAt: { $lte: now },
  })
    .limit(RENEWAL_BATCH_SIZE);

  for (const subscription of due) {
    try {
      const result = subscription.audience === 'owner'
        ? await renewOwnerSubscription(subscription)
        : await renewDriverSubscription(subscription);

      if (!result.renewed) {
        summary.failed += 1;
        continue;
      }

      const startedAt = new Date();
      const durationDays = Math.max(1, Number(subscription.durationDays || 30) || 30);
      subscription.startedAt = startedAt;
      subscription.expiresAt = addDays(startedAt, durationDays);
      subscription.nextBillingAt = subscription.recurring_enabled ? subscription.expiresAt : null;
      subscription.renewalCount = Number(subscription.renewalCount || 0) + 1;
      subscription.lastRenewedAt = startedAt;
      subscription.lastRenewalError = '';
      await subscription.save();

      summary.renewed += 1;
    } catch (error) {
      summary.failed += 1;
      console.error('[subscription-renewal] failed for', String(subscription._id), error?.message || error);
    }
  }

  return summary;
};

export const startSubscriptionRenewalWorker = () => {
  if (sweepTimer) {
    return sweepTimer;
  }

  const tick = async () => {
    try {
      const summary = await runSubscriptionRenewalSweep();
      if (summary.expired || summary.renewed || summary.failed) {
        console.log('[subscription-renewal]', JSON.stringify(summary));
      }
    } catch (error) {
      // Never let a sweep failure kill the process.
      console.error('[subscription-renewal] sweep error:', error?.message || error);
    }
  };

  sweepTimer = setInterval(tick, RENEWAL_SWEEP_INTERVAL_MS);
  if (typeof sweepTimer.unref === 'function') {
    sweepTimer.unref();
  }

  // Run once shortly after boot so a restart picks up anything already overdue.
  setTimeout(tick, 30_000).unref?.();

  return sweepTimer;
};

export const stopSubscriptionRenewalWorker = () => {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
};
