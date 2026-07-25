import mongoose from 'mongoose';
import { env } from '../../../../config/env.js';
import { ApiError } from '../../../../utils/ApiError.js';
import { Helper } from '../../admin/models/Helper.js';
import { Owner } from '../../admin/models/Owner.js';
import { OwnerWalletTransaction } from '../../admin/models/OwnerWalletTransaction.js';
import { SetPrice } from '../../admin/models/SetPrice.js';
import { Vehicle } from '../../admin/models/Vehicle.js';
import { Driver } from '../models/Driver.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { Ride } from '../../user/models/Ride.js';
import { getWalletSettings } from '../../services/appSettingsService.js';
import { getPartnerSubscriptionMode, resolveActivePartnerBenefits } from '../../services/partnerSubscriptionService.js';

const normalizeAmount = (value, fieldName = 'amount') => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw new ApiError(400, `${fieldName} must be a valid number`);
  }

  return Math.round(amount * 100) / 100;
};

const normalizePaymentMethod = (value) => (
  String(value || '').trim().toLowerCase() === 'cash' ? 'cash' : 'online'
);

const normalizeCommissionType = (value) => {
  const numericValue = Number(value);
  return numericValue === 1 ? 'percentage' : 'fixed';
};

const computeCommissionAmount = ({ fare, type, value }) => {
  const safeFare = normalizeAmount(fare, 'fare');
  const safeValue = Math.max(normalizeAmount(value || 0, 'commission'), 0);

  if (normalizeCommissionType(type) === 'percentage') {
    return Math.min(Math.round((safeFare * safeValue)) / 100, safeFare);
  }

  return Math.min(safeValue, safeFare);
};

const resolveCommissionConfigForRide = async (ride, session) => {
  if (ride?.pricingSnapshot?.admin_commission_from_driver !== undefined) {
    return {
      source: ride.pricingSnapshot?.setPriceId ? 'ride_snapshot' : 'ride_snapshot_fallback',
      type: Number(ride.pricingSnapshot?.admin_commission_type_from_driver ?? 1),
      value: Number(ride.pricingSnapshot?.admin_commission_from_driver ?? 0),
    };
  }

  if (ride?.vehicleTypeId) {
    const normalizedServiceType = String(ride?.serviceType || '').trim().toLowerCase();
    const savedTransportType = String(ride.transport_type || '').trim().toLowerCase();
    const normalizedTransportType =
      normalizedServiceType === 'parcel'
        ? (savedTransportType === 'delivery' || savedTransportType === 'both' ? savedTransportType : 'delivery')
        : (savedTransportType || 'taxi');
    const filters = [
      {
        vehicle_type: ride.vehicleTypeId,
        active: 1,
        status: 'active',
        ...(ride.service_location_id ? { service_location_id: ride.service_location_id } : {}),
        transport_type: normalizedTransportType,
      },
      {
        vehicle_type: ride.vehicleTypeId,
        active: 1,
        status: 'active',
        ...(ride.service_location_id ? { service_location_id: ride.service_location_id } : {}),
        transport_type: 'both',
      },
      {
        vehicle_type: ride.vehicleTypeId,
        active: 1,
        status: 'active',
        transport_type: normalizedTransportType,
      },
      {
        vehicle_type: ride.vehicleTypeId,
        active: 1,
        status: 'active',
        transport_type: 'both',
      },
    ];

    for (const filter of filters) {
      const setPrice = await SetPrice.findOne(filter).sort({ updatedAt: -1, createdAt: -1 }).session(session).lean();
      if (setPrice) {
        return {
          source: 'set_price_lookup',
          type: Number(setPrice.admin_commission_type_from_driver ?? 1),
          value: Number(setPrice.admin_commission_from_driver ?? 0),
          setPriceId: setPrice._id,
        };
      }
    }

    if (normalizedServiceType === 'parcel') {
      const vehicle = await Vehicle.findById(ride.vehicleTypeId)
        .select('admin_commission_type_from_driver admin_commission_from_driver')
        .session(session)
        .lean();

      if (vehicle) {
        return {
          source: 'vehicle_type_parcel_fallback',
          type: Number(vehicle.admin_commission_type_from_driver ?? 1),
          value: Number(vehicle.admin_commission_from_driver ?? 0),
        };
      }
    }
  }

  return {
    source: 'env_fallback',
    type: 1,
    value: Number(env.driverWallet.commissionPercent || 0),
  };
};

const toNonNegativeNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallback;
};

const isEnabledSetting = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const resolveWalletRules = async () => {
  const walletSettings = await getWalletSettings();
  const configuredMinimumBalance = Number(walletSettings.driver_wallet_minimum_amount_to_get_an_order);
  const minimumBalanceForOrders = Number.isFinite(configuredMinimumBalance)
    ? Math.round(configuredMinimumBalance * 100) / 100
    : -toNonNegativeNumber(env.driverWallet.defaultCashLimit, 500);

  return {
    minimumBalanceForOrders,
    cashLimit: Math.abs(Math.min(minimumBalanceForOrders, 0)),
    minimumTopUpAmount: toNonNegativeNumber(walletSettings.minimum_amount_added_to_wallet, 0),
    minimumTransferAmount: toNonNegativeNumber(walletSettings.minimum_wallet_amount_for_transfer, 0),
    isWalletEnabled: isEnabledSetting(walletSettings.show_wallet_feature_for_driver, true),
    isTransferEnabled: isEnabledSetting(walletSettings.enable_wallet_transfer_driver, true),
  };
};

const getWalletSnapshot = async (driver) => {
  const rules = await resolveWalletRules();
  const balance = Number(driver?.wallet?.balance || 0);

  return {
    balance,
    cashLimit: rules.cashLimit,
    minimumBalanceForOrders: rules.minimumBalanceForOrders,
    availableForOrders: Math.round((balance - rules.minimumBalanceForOrders) * 100) / 100,
    isBlocked: Boolean(driver?.wallet?.isBlocked),
    rules,
  };
};

export const serializeDriverWallet = async (driver) => {
  const wallet = await getWalletSnapshot(driver);
  const isBelowMinimumBalance = wallet.balance < wallet.minimumBalanceForOrders;

  return {
    balance: wallet.balance,
    cashLimit: wallet.cashLimit,
    minimumBalanceForOrders: wallet.minimumBalanceForOrders,
    availableForOrders: wallet.availableForOrders,
    isWalletEnabled: wallet.rules.isWalletEnabled,
    isTransferEnabled: wallet.rules.isTransferEnabled,
    minimumTopUpAmount: wallet.rules.minimumTopUpAmount,
    minimumTransferAmount: wallet.rules.minimumTransferAmount,
    isBlocked: wallet.isBlocked || !wallet.rules.isWalletEnabled || isBelowMinimumBalance,
  };
};

export const ensureDriverWalletCanAcceptRide = async (driverOrId, { session } = {}) => {
  const driver =
    typeof driverOrId === 'object' && driverOrId?._id
      ? driverOrId
      : await Driver.findById(driverOrId).session(session);

  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }

  const wallet = await getWalletSnapshot(driver);
  const isBelowMinimumBalance = wallet.balance < wallet.minimumBalanceForOrders;
  const isBlocked = wallet.isBlocked || !wallet.rules.isWalletEnabled || isBelowMinimumBalance;

  if (isBlocked) {
    await Driver.findByIdAndUpdate(driver._id, {
      'wallet.cashLimit': wallet.cashLimit,
      'wallet.isBlocked': true,
    });
    throw new ApiError(403, wallet.rules.isWalletEnabled
      ? 'Driver wallet minimum balance is not met. Please top up to accept rides.'
      : 'Driver wallet is disabled by admin.');
  }

  if (Number(driver?.wallet?.cashLimit) !== wallet.cashLimit || driver?.wallet?.isBlocked) {
    await Driver.findByIdAndUpdate(driver._id, {
      'wallet.cashLimit': wallet.cashLimit,
      'wallet.isBlocked': false,
    });
  }

  return wallet;
};

export const applyDriverWalletAdjustment = async ({
  driverId,
  amount,
  type,
  rideId = null,
  description = '',
  metadata = {},
  session = null,
}) => {
  const normalizedAmount = normalizeAmount(amount);

  if (!normalizedAmount) {
    throw new ApiError(400, 'Wallet adjustment amount cannot be zero');
  }

  const driver = await Driver.findById(driverId).session(session);

  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }

  const before = await getWalletSnapshot(driver);
  const balanceAfter = Math.round((before.balance + normalizedAmount) * 100) / 100;
  const isBlockedAfter = !before.rules.isWalletEnabled || balanceAfter < before.minimumBalanceForOrders;

  const updatedDriver = await Driver.findByIdAndUpdate(
    driverId,
    {
      $inc: { 'wallet.balance': normalizedAmount },
      $set: {
        'wallet.cashLimit': before.cashLimit,
        'wallet.isBlocked': isBlockedAfter,
      },
    },
    { returnDocument: 'after', session },
  );

  const [transaction] = await WalletTransaction.create(
    [
      {
        driverId,
        rideId,
        type,
        amount: normalizedAmount,
        balanceBefore: before.balance,
        balanceAfter,
        cashLimit: before.cashLimit,
        isBlockedAfter,
        description,
        metadata,
      },
    ],
    { session },
  );

  return {
    driver: updatedDriver,
    wallet: await serializeDriverWallet(updatedDriver),
    transaction,
  };
};

export const topUpDriverWallet = async ({ driverId, amount, metadata = {} }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const walletSettings = await getWalletSettings();
    if (!isEnabledSetting(walletSettings.show_wallet_feature_for_driver, true)) {
      throw new ApiError(403, 'Driver wallet is disabled by admin');
    }

    const minimumTopUpAmount = toNonNegativeNumber(walletSettings.minimum_amount_added_to_wallet, 0);
    const normalizedTopUpAmount = Math.abs(normalizeAmount(amount));

    if (minimumTopUpAmount > 0 && normalizedTopUpAmount < minimumTopUpAmount) {
      throw new ApiError(400, `amount must be at least ${minimumTopUpAmount}`);
    }

    const result = await applyDriverWalletAdjustment({
      driverId,
      amount: normalizedTopUpAmount,
      type: 'top_up',
      description: 'Driver wallet top-up',
      metadata: {
        ...metadata,
        minimumTopUpAmount,
      },
      session,
    });

    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Credits the fleet owner their share of a completed ride and records it on the
// OwnerWalletTransaction ledger. Idempotent via Ride.ownerSettledAt.
//
// ponytail: owner earnings are credited to the owner wallet directly; a separate
// escrow/hold step can be layered on later if payouts need approval gating.
const settleOwnerCommissionForRide = async ({ ride, fare, session }) => {
  if (!ride?.driverId || ride.ownerSettledAt) {
    return null;
  }

  const driver = await Driver.findById(ride.driverId).select('owner_id').session(session).lean();
  const ownerId = driver?.owner_id;

  if (!ownerId) {
    return null;
  }

  const snapshot = ride.pricingSnapshot?.toObject?.() || ride.pricingSnapshot || {};
  const ownerCommission = computeCommissionAmount({
    fare,
    type: snapshot.admin_commission_type_for_owner ?? 1,
    value: snapshot.admin_commission_for_owner ?? 0,
  });

  const ownerEarnings = Math.max(Math.round((fare - ownerCommission) * 100) / 100, 0);

  if (!ownerEarnings) {
    return null;
  }

  const owner = await Owner.findById(ownerId).session(session);

  if (!owner) {
    return null;
  }

  const balanceBefore = Number(owner.wallet?.balance || 0);
  const balanceAfter = Math.round((balanceBefore + ownerEarnings) * 100) / 100;

  owner.wallet = owner.wallet || {};
  owner.wallet.balance = balanceAfter;
  owner.markModified('wallet');
  await owner.save({ session });

  await OwnerWalletTransaction.create(
    [
      {
        ownerId: owner._id,
        amount: ownerEarnings,
        kind: 'credit',
        title: `Ride earning (${String(ride._id).slice(-6)})`,
        balance: balanceAfter,
      },
    ],
    { session },
  );

  ride.ownerSettledAt = new Date();
  ride.ownerId = owner._id;
  ride.ownerEarnings = ownerEarnings;
  ride.ownerCommissionAmount = ownerCommission;
  await ride.save({ session });

  return { ownerId: owner._id, ownerEarnings, ownerCommission, balance: balanceAfter };
};

// Collapses a ride's assigned helpers into one $inc per person. Pure and exported
// so the idempotency guard is testable without a Mongo transaction: once
// helpersSettledAt is stamped there is nothing left to credit.
export const buildHelperEarningIncrements = (ride) => {
  if (!ride || ride.helpersSettledAt) {
    return [];
  }

  const byHelperId = new Map();

  for (const item of ride.parcel?.helper?.assigned || []) {
    const helperId = String(item?.helperId || '').trim();

    if (!helperId || !mongoose.isValidObjectId(helperId)) {
      continue;
    }

    // Math.max(NaN, 0) is NaN, which would $inc total_earnings into garbage.
    const rawCharge = Number(item?.charge);
    const charge = Number.isFinite(rawCharge) ? Math.max(Math.round(rawCharge * 100) / 100, 0) : 0;
    const current = byHelperId.get(helperId) || { helperId, earnings: 0, jobs: 0 };

    byHelperId.set(helperId, {
      helperId,
      earnings: Math.round((current.earnings + charge) * 100) / 100,
      jobs: current.jobs + 1,
    });
  }

  return [...byHelperId.values()];
};

// Labour earnings. Helper.total_earnings/total_jobs existed as fields with no
// writer because bookings never named a helper; this is the only writer, and it
// runs inside the ride-settlement transaction so it shares its atomicity.
const settleHelperEarningsForRide = async ({ ride, session }) => {
  const increments = buildHelperEarningIncrements(ride);

  if (!increments.length) {
    return null;
  }

  await Promise.all(
    increments.map(({ helperId, earnings, jobs }) =>
      Helper.updateOne({ _id: helperId }, { $inc: { total_earnings: earnings, total_jobs: jobs } }, { session }),
    ),
  );

  ride.helpersSettledAt = new Date();
  await ride.save({ session });

  return {
    helpers: increments.length,
    total: increments.reduce((sum, item) => sum + item.earnings, 0),
  };
};

export const settleCompletedRideWallet = async ({ rideId }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const ride = await Ride.findOneAndUpdate(
      { _id: rideId, walletSettledAt: null, driverId: { $ne: null } },
      { $set: { walletSettledAt: new Date() } },
      { returnDocument: 'after', session },
    );

    if (!ride) {
      await session.commitTransaction();
      return null;
    }

    const fare = normalizeAmount(ride.fare || 0, 'fare');
    const commissionConfig = await resolveCommissionConfigForRide(ride, session);
    const grossCommissionAmount = computeCommissionAmount({
      fare,
      type: commissionConfig.type,
      value: commissionConfig.value,
    });

    // Subscription benefit: reduced commission. commission_discount_percent was a
    // stored flag with no reader — this is where it finally applies.
    const driverBenefits = await resolveActivePartnerBenefits({
      audience: 'driver',
      entityId: ride.driverId,
      session,
    });

    // subscription.mode was only ever read to BLOCK a purchase; setting
    // 'subscriptionOnly' did not stop commission being deducted, so subscribed
    // drivers were charged twice. A subscribed driver pays no commission in
    // subscriptionOnly mode.
    const subscriptionMode = await getPartnerSubscriptionMode();
    const commissionWaivedBySubscription = subscriptionMode === 'subscriptionOnly' && Boolean(driverBenefits);

    const commissionDiscountPercent = commissionWaivedBySubscription
      ? 100
      : Math.min(100, Math.max(0, Number(driverBenefits?.commissionDiscountPercent || 0)));
    const commissionDiscountAmount = Math.round((grossCommissionAmount * commissionDiscountPercent)) / 100;
    const commissionAmount = Math.max(
      Math.round((grossCommissionAmount - commissionDiscountAmount) * 100) / 100,
      0,
    );

    const paymentMethod = normalizePaymentMethod(ride.paymentMethod);
    const driverEarnings = Math.max(Math.round((fare - commissionAmount) * 100) / 100, 0);
    const amount = paymentMethod === 'cash' ? -commissionAmount : driverEarnings;
    const type = paymentMethod === 'cash' ? 'commission_deduction' : 'ride_earning';

    ride.paymentMethod = paymentMethod;
    ride.commissionAmount = commissionAmount;
    ride.driverEarnings = driverEarnings;
    // Spread the existing snapshot: this used to REPLACE it with 4 keys, which
    // discarded admin_commission_*_for_owner (needed for owner settlement below)
    // plus the waiting-charge and allowed_payment_methods fields.
    ride.pricingSnapshot = {
      ...(ride.pricingSnapshot?.toObject?.() || ride.pricingSnapshot || {}),
      setPriceId: ride.pricingSnapshot?.setPriceId || commissionConfig.setPriceId || null,
      admin_commission_type_from_driver: Number(commissionConfig.type ?? ride.pricingSnapshot?.admin_commission_type_from_driver ?? 1),
      admin_commission_from_driver: Number(commissionConfig.value ?? ride.pricingSnapshot?.admin_commission_from_driver ?? 0),
      commission_gross: grossCommissionAmount,
      commission_discount_percent: commissionDiscountPercent,
      commission_discount_amount: commissionDiscountAmount,
      resolvedAt: ride.pricingSnapshot?.resolvedAt || new Date(),
    };
    await ride.save({ session });

    // Fleet-owner settlement. admin_commission_for_owner was fully configurable
    // and never collected — no owner settlement code existed at all.
    await settleOwnerCommissionForRide({ ride, fare, session });
    await settleHelperEarningsForRide({ ride, session });

    if (!amount) {
      await session.commitTransaction();
      return null;
    }

    const result = await applyDriverWalletAdjustment({
      driverId: ride.driverId,
      rideId: ride._id,
      amount,
      type,
      description: paymentMethod === 'cash'
        ? 'Commission deducted for cash ride'
        : 'Driver earning credited for online ride',
      metadata: {
        fare,
        commissionAmount,
        driverEarnings,
        paymentMethod,
        commissionSource: commissionConfig.source,
        commissionType: normalizeCommissionType(commissionConfig.type),
        commissionValue: Number(commissionConfig.value || 0),
      },
      session,
    });

    await session.commitTransaction();
    return {
      ...result,
      ride,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
