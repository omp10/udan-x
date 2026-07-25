import mongoose from 'mongoose';
import { ApiError } from '../../../utils/ApiError.js';
import { Driver } from '../driver/models/Driver.js';
import { WalletTransaction } from '../driver/models/WalletTransaction.js';
import { PartnerSubscription } from '../driver/models/PartnerSubscription.js';
import { Owner } from '../admin/models/Owner.js';
import { OwnerWalletTransaction } from '../admin/models/OwnerWalletTransaction.js';
import { SubscriptionPlan } from '../admin/models/SubscriptionPlan.js';
import { AdminBusinessSetting } from '../admin/models/AdminBusinessSetting.js';

const PARTNER_AUDIENCES = ['driver', 'owner'];
const BILLING_CYCLES = ['monthly', 'quarterly', 'yearly', 'custom'];
const COVERAGE_SCOPES = ['individual', 'vehicle', 'fleet'];

const normalizeAudience = (value, fallback = 'driver') => {
  const normalized = String(value || fallback).trim().toLowerCase();
  return PARTNER_AUDIENCES.includes(normalized) ? normalized : fallback;
};

const normalizeBillingCycle = (value, fallback = 'monthly') => {
  const normalized = String(value || fallback).trim().toLowerCase();
  return BILLING_CYCLES.includes(normalized) ? normalized : fallback;
};

const normalizeCoverageScope = (value, fallback = 'individual') => {
  const normalized = String(value || fallback).trim().toLowerCase();
  return COVERAGE_SCOPES.includes(normalized) ? normalized : fallback;
};

const toMoney = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Number(parsed.toFixed(2));
};

const addDays = (value, days) => {
  const next = new Date(value);
  next.setDate(next.getDate() + Math.max(0, Number(days || 0)));
  return next;
};

const isActiveStatus = (value) => String(value || '').trim().toLowerCase() === 'active';

const ensurePartnerSubscriptionStatusFresh = async (subscription) => {
  if (!subscription) {
    return subscription;
  }

  const now = new Date();
  const hasExpired = subscription.expiresAt && new Date(subscription.expiresAt) <= now;
  if (!hasExpired) {
    return subscription;
  }

  if (subscription.status !== 'expired' || subscription.active !== false) {
    subscription.status = 'expired';
    subscription.active = false;
    await subscription.save();
  }

  return subscription;
};

const normalizePlanPayload = (payload = {}, fallbackAudience = 'driver') => {
  const audience = normalizeAudience(payload.audience, fallbackAudience);
  const billingCycle = normalizeBillingCycle(payload.billing_cycle, audience === 'owner' ? 'monthly' : 'monthly');
  const coverageScope = normalizeCoverageScope(
    payload.coverage_scope,
    audience === 'owner' ? 'fleet' : 'individual',
  );
  const durationDays = Math.max(1, Number(payload.duration || payload.durationDays || 30) || 30);

  return {
    audience,
    name: String(payload.name || '').trim(),
    description: String(payload.description || '').trim(),
    amount: Math.max(0, toMoney(payload.amount, 0)),
    duration: durationDays,
    transport_type: String(payload.transport_type || 'taxi').trim().toLowerCase() || 'taxi',
    vehicle_type_id:
      payload.vehicle_type_id && mongoose.Types.ObjectId.isValid(payload.vehicle_type_id)
        ? payload.vehicle_type_id
        : null,
    billing_cycle: billingCycle,
    coverage_scope: coverageScope,
    recurring_enabled: payload.recurring_enabled === true || String(payload.recurring_enabled || '').trim().toLowerCase() === 'true',
    auto_renew_default: payload.auto_renew_default === true || String(payload.auto_renew_default || '').trim().toLowerCase() === 'true',
    renewal_reminder_days: Math.max(0, Number(payload.renewal_reminder_days || 5) || 5),
    commission_discount_percent: Math.min(100, Math.max(0, Number(payload.commission_discount_percent || 0) || 0)),
    priority_booking: payload.priority_booking === true || String(payload.priority_booking || '').trim().toLowerCase() === 'true',
    featured_listing: payload.featured_listing === true || String(payload.featured_listing || '').trim().toLowerCase() === 'true',
    premium_support: payload.premium_support === true || String(payload.premium_support || '').trim().toLowerCase() === 'true',
    booking_limit: Math.max(0, Number(payload.booking_limit || 0) || 0),
    max_vehicles_covered: Math.max(0, Number(payload.max_vehicles_covered || 0) || 0),
    how_it_works: String(payload.how_it_works || '').trim(),
    active: payload.active !== undefined ? Boolean(payload.active) : true,
    metadata: typeof payload.metadata === 'object' && payload.metadata ? payload.metadata : {},
  };
};

export const serializePartnerPlan = (plan = {}) => ({
  id: String(plan._id || plan.id || ''),
  audience: normalizeAudience(plan.audience),
  name: String(plan.name || '').trim(),
  description: String(plan.description || '').trim(),
  amount: toMoney(plan.amount, 0),
  duration: Math.max(0, Number(plan.duration || 0)),
  transport_type: String(plan.transport_type || 'taxi').trim().toLowerCase(),
  vehicle_type_id: plan.vehicle_type_id?._id
    ? String(plan.vehicle_type_id._id)
    : plan.vehicle_type_id
      ? String(plan.vehicle_type_id)
      : '',
  vehicle_type: plan.vehicle_type_id?._id
    ? {
        id: String(plan.vehicle_type_id._id),
        name: String(plan.vehicle_type_id.name || '').trim(),
      }
    : null,
  billing_cycle: normalizeBillingCycle(plan.billing_cycle),
  coverage_scope: normalizeCoverageScope(plan.coverage_scope, normalizeAudience(plan.audience) === 'owner' ? 'fleet' : 'individual'),
  recurring_enabled: plan.recurring_enabled === true,
  auto_renew_default: plan.auto_renew_default === true,
  renewal_reminder_days: Math.max(0, Number(plan.renewal_reminder_days || 0)),
  commission_discount_percent: Math.max(0, Number(plan.commission_discount_percent || 0)),
  priority_booking: plan.priority_booking === true,
  featured_listing: plan.featured_listing === true,
  premium_support: plan.premium_support === true,
  booking_limit: Math.max(0, Number(plan.booking_limit || 0)),
  max_vehicles_covered: Math.max(0, Number(plan.max_vehicles_covered || 0)),
  how_it_works: String(plan.how_it_works || '').trim(),
  active: plan.active !== false,
  metadata: plan.metadata || {},
  createdAt: plan.createdAt || null,
  updatedAt: plan.updatedAt || null,
});

export const serializePartnerSubscription = (item = {}) => {
  const expiresAt = item.expiresAt ? new Date(item.expiresAt) : null;
  const now = new Date();
  const remainingDays = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  return {
    id: String(item._id || item.id || ''),
    audience: normalizeAudience(item.audience),
    planId: item.planId?._id ? String(item.planId._id) : String(item.planId || ''),
    name: String(item.name || item.planId?.name || '').trim(),
    description: String(item.description || item.planId?.description || '').trim(),
    amount: toMoney(item.amount, 0),
    durationDays: Math.max(0, Number(item.durationDays || 0)),
    transport_type: String(item.transport_type || item.planId?.transport_type || 'taxi').trim().toLowerCase(),
    vehicle_type_id: item.vehicle_type_id?._id
      ? String(item.vehicle_type_id._id)
      : item.vehicle_type_id
        ? String(item.vehicle_type_id)
        : '',
    vehicle_type: item.vehicle_type_id?._id
      ? {
          id: String(item.vehicle_type_id._id),
          name: String(item.vehicle_type_id.name || '').trim(),
        }
      : null,
    billing_cycle: normalizeBillingCycle(item.billing_cycle),
    coverage_scope: normalizeCoverageScope(item.coverage_scope, normalizeAudience(item.audience) === 'owner' ? 'fleet' : 'individual'),
    commission_discount_percent: Math.max(0, Number(item.commission_discount_percent || 0)),
    priority_booking: item.priority_booking === true,
    featured_listing: item.featured_listing === true,
    premium_support: item.premium_support === true,
    booking_limit: Math.max(0, Number(item.booking_limit || 0)),
    max_vehicles_covered: Math.max(0, Number(item.max_vehicles_covered || 0)),
    recurring_enabled: item.recurring_enabled === true,
    autoRenew: item.autoRenew === true,
    status: String(item.status || 'active').trim().toLowerCase(),
    active: item.active !== false && isActiveStatus(item.status),
    purchaseSource: String(item.purchaseSource || 'wallet').trim().toLowerCase(),
    purchasedAt: item.purchasedAt || null,
    startedAt: item.startedAt || null,
    expiresAt: item.expiresAt || null,
    nextBillingAt: item.nextBillingAt || null,
    lastRenewedAt: item.lastRenewedAt || null,
    cancelledAt: item.cancelledAt || null,
    expiresInDays: remainingDays,
    metadata: item.metadata || {},
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
};

export const getPartnerSubscriptionMode = async () => getPartnerConfigMode();

const getPartnerConfigMode = async () => {
  const setting = await AdminBusinessSetting.findOne({ scope: 'default' }).lean();
  return String(setting?.subscription?.mode || 'commissionOnly').trim();
};

const getEntityModelForAudience = (audience) => (normalizeAudience(audience) === 'owner' ? Owner : Driver);

const getEntityQueryForAudience = (audience, entityId) =>
  normalizeAudience(audience) === 'owner' ? { ownerId: entityId } : { driverId: entityId };

const applyWalletPurchaseForAudience = async ({ audience, entity, amount, title, planId }) => {
  const normalizedAudience = normalizeAudience(audience);

  if (normalizedAudience === 'owner') {
    const balanceBefore = Number(entity.wallet?.balance || 0);
    if (balanceBefore < amount) {
      throw new ApiError(400, 'Insufficient wallet balance');
    }

    const balanceAfter = toMoney(balanceBefore - amount, 0);
    entity.wallet = entity.wallet || {};
    entity.wallet.balance = balanceAfter;
    entity.markModified('wallet');
    await entity.save();
    await OwnerWalletTransaction.create({
      ownerId: entity._id,
      amount,
      kind: 'debit',
      title,
      balance: balanceAfter,
    });

    return {
      wallet: {
        balance: balanceAfter,
        currency: 'INR',
      },
    };
  }

  const balanceBefore = Number(entity.wallet?.balance || 0);
  if (balanceBefore < amount) {
    throw new ApiError(400, 'Insufficient wallet balance');
  }

  const balanceAfter = toMoney(balanceBefore - amount, 0);
  entity.wallet = entity.wallet || {};
  entity.wallet.balance = balanceAfter;
  await entity.save();
  await WalletTransaction.create({
    driverId: entity._id,
    type: 'adjustment',
    amount: -amount,
    balanceBefore,
    balanceAfter,
    cashLimit: Number(entity.wallet?.cashLimit || 0),
    isBlockedAfter: entity.wallet?.isBlocked === true,
    description: title,
    metadata: {
      source: 'driver_subscription_purchase',
      planId: String(planId || ''),
      operation: 'debit',
    },
  });

  return {
    wallet: {
      balance: balanceAfter,
      cashLimit: Number(entity.wallet?.cashLimit || 0),
      isBlocked: entity.wallet?.isBlocked === true,
      currency: 'INR',
    },
  };
};

// Returns the live subscription benefits for a driver/owner, or null.
// Every benefit field used to be a stored flag nothing read; this is the single
// lookup that lets dispatch, commission and booking limits honour them.
export const resolveActivePartnerBenefits = async ({ audience = 'driver', entityId, session = null } = {}) => {
  if (!entityId || !mongoose.Types.ObjectId.isValid(entityId)) {
    return null;
  }

  const normalizedAudience = normalizeAudience(audience);
  const query = PartnerSubscription.findOne({
    audience: normalizedAudience,
    ...(normalizedAudience === 'owner' ? { ownerId: entityId } : { driverId: entityId }),
    status: 'active',
    active: true,
    expiresAt: { $gt: new Date() },
  }).sort({ expiresAt: -1 });

  if (session) {
    query.session(session);
  }

  const subscription = await query.lean();

  if (!subscription) {
    return null;
  }

  return {
    subscriptionId: subscription._id,
    planId: subscription.planId || null,
    name: subscription.name || '',
    commissionDiscountPercent: Math.min(100, Math.max(0, Number(subscription.commission_discount_percent || 0))),
    priorityBooking: subscription.priority_booking === true,
    featuredListing: subscription.featured_listing === true,
    premiumSupport: subscription.premium_support === true,
    // 0 means unlimited
    bookingLimit: Math.max(0, Number(subscription.booking_limit || 0)),
    maxVehiclesCovered: Math.max(0, Number(subscription.max_vehicles_covered || 0)),
    coverageScope: subscription.coverage_scope || 'individual',
    expiresAt: subscription.expiresAt || null,
  };
};

export const listPartnerSubscriptionPlans = async ({ audience = 'driver', activeOnly = false } = {}) => {
  const normalizedAudience = normalizeAudience(audience);
  const query = {
    audience: normalizedAudience,
  };

  if (activeOnly) {
    query.active = true;
  }

  const plans = await SubscriptionPlan.find(query)
    .sort({ active: -1, createdAt: -1 })
    .populate('vehicle_type_id', 'name')
    .lean();

  return plans.map(serializePartnerPlan);
};

export const createPartnerSubscriptionPlan = async (payload = {}) => {
  const nextPayload = normalizePlanPayload(payload, 'driver');
  if (!nextPayload.name) {
    throw new ApiError(400, 'Subscription name is required');
  }

  const plan = await SubscriptionPlan.create(nextPayload);
  return serializePartnerPlan(plan.toObject());
};

// No update/delete route existed for any plan, so the admin Subscription Plans
// page threw "is not a function" on edit, delete and activate.
export const updatePartnerSubscriptionPlan = async (id, payload = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Valid subscription plan id is required');
  }

  const plan = await SubscriptionPlan.findById(id);

  if (!plan) {
    throw new ApiError(404, 'Subscription plan not found');
  }

  const nextPayload = normalizePlanPayload(
    { ...plan.toObject(), ...payload },
    normalizeAudience(plan.audience),
  );

  if (!nextPayload.name) {
    throw new ApiError(400, 'Subscription name is required');
  }

  Object.assign(plan, nextPayload);
  await plan.save();

  return serializePartnerPlan(plan.toObject());
};

// Plans with live subscriptions are deactivated rather than removed, so existing
// subscribers keep working and historical reports stay intact.
export const deletePartnerSubscriptionPlan = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Valid subscription plan id is required');
  }

  const plan = await SubscriptionPlan.findById(id);

  if (!plan) {
    throw new ApiError(404, 'Subscription plan not found');
  }

  const liveCount = await PartnerSubscription.countDocuments({
    planId: plan._id,
    status: 'active',
    expiresAt: { $gt: new Date() },
  });

  if (liveCount > 0) {
    plan.active = false;
    await plan.save();
    return { deleted: false, deactivated: true, activeSubscribers: liveCount };
  }

  await SubscriptionPlan.findByIdAndDelete(plan._id);
  return { deleted: true, deactivated: false, activeSubscribers: 0 };
};

// Powers the "Expiring Within 7 Days" panel, which was permanently empty because
// getExpiringSubscriptions did not exist.
export const listExpiringPartnerSubscriptions = async ({ days = 7 } = {}) => {
  const now = new Date();
  const until = addDays(now, days);

  const items = await PartnerSubscription.find({
    status: 'active',
    active: true,
    expiresAt: { $gte: now, $lte: until },
  })
    .sort({ expiresAt: 1 })
    .limit(100)
    .populate('driverId', 'name phone')
    .populate('ownerId', 'owner_name company_name mobile')
    .lean();

  return {
    results: items.map((item) => ({
      id: String(item._id),
      audience: item.audience,
      name: item.name || '',
      amount: toMoney(item.amount, 0),
      expiresAt: item.expiresAt,
      autoRenew: item.autoRenew === true,
      subscriber:
        item.audience === 'owner'
          ? {
              id: item.ownerId?._id ? String(item.ownerId._id) : null,
              name: item.ownerId?.company_name || item.ownerId?.owner_name || 'Unknown',
              phone: item.ownerId?.mobile || '',
            }
          : {
              id: item.driverId?._id ? String(item.driverId._id) : null,
              name: item.driverId?.name || 'Unknown',
              phone: item.driverId?.phone || '',
            },
    })),
    total: items.length,
  };
};

// Powers the "Recent Subscriptions" panel (getRecentSubscriptions was absent).
export const listRecentPartnerSubscriptions = async ({ limit = 20 } = {}) => {
  const items = await PartnerSubscription.find({})
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit) || 20)))
    .populate('driverId', 'name phone')
    .populate('ownerId', 'owner_name company_name mobile')
    .lean();

  return {
    results: items.map((item) => ({
      id: String(item._id),
      audience: item.audience,
      name: item.name || '',
      amount: toMoney(item.amount, 0),
      status: item.status || 'unknown',
      startedAt: item.startedAt || item.createdAt,
      expiresAt: item.expiresAt,
      purchaseSource: item.purchaseSource || 'wallet',
      subscriber:
        item.audience === 'owner'
          ? {
              id: item.ownerId?._id ? String(item.ownerId._id) : null,
              name: item.ownerId?.company_name || item.ownerId?.owner_name || 'Unknown',
              phone: item.ownerId?.mobile || '',
            }
          : {
              id: item.driverId?._id ? String(item.driverId._id) : null,
              name: item.driverId?.name || 'Unknown',
              phone: item.driverId?.phone || '',
            },
    })),
    total: items.length,
  };
};

export const listPartnerSubscriptionsForEntity = async ({ audience = 'driver', entityId }) => {
  const normalizedAudience = normalizeAudience(audience);
  const EntityModel = getEntityModelForAudience(normalizedAudience);
  const entity = await EntityModel.findById(entityId).lean();

  if (!entity) {
    throw new ApiError(404, `${normalizedAudience === 'owner' ? 'Owner' : 'Driver'} not found`);
  }

  const query = {
    audience: normalizedAudience,
    ...getEntityQueryForAudience(normalizedAudience, entityId),
  };

  const items = await PartnerSubscription.find(query)
    .sort({ active: -1, expiresAt: 1, createdAt: -1 })
    .populate('planId', 'name description transport_type')
    .populate('vehicle_type_id', 'name')
    .lean();

  const refreshed = await Promise.all(
    items.map(async (item) => {
      const doc = await PartnerSubscription.findById(item._id);
      if (!doc) return item;
      await ensurePartnerSubscriptionStatusFresh(doc);
      return doc.toObject();
    }),
  );

  const results = refreshed.map(serializePartnerSubscription);
  const activePlans = results.filter((item) => item.active);

  return {
    results,
    summary: {
      mode: await getPartnerConfigMode(),
      activeCount: activePlans.length,
      autoRenewCount: activePlans.filter((item) => item.autoRenew).length,
      expiresSoonCount: activePlans.filter((item) => item.expiresInDays !== null && item.expiresInDays <= 7).length,
      premiumSupportCount: activePlans.filter((item) => item.premium_support).length,
      featuredCount: activePlans.filter((item) => item.featured_listing).length,
      maxCommissionDiscountPercent: activePlans.reduce(
        (max, item) => Math.max(max, Number(item.commission_discount_percent || 0)),
        0,
      ),
      activePlans,
      history: results,
    },
  };
};

export const getPartnerSubscriptionSummary = async ({ audience = 'driver', entityId }) => {
  const result = await listPartnerSubscriptionsForEntity({ audience, entityId });
  return result.summary;
};

export const purchasePartnerSubscription = async ({
  audience = 'driver',
  entityId,
  planId,
  autoRenew,
  paymentSource = 'wallet',
}) => {
  const normalizedAudience = normalizeAudience(audience);
  if (!planId || !mongoose.Types.ObjectId.isValid(planId)) {
    throw new ApiError(400, 'Valid subscription plan id is required');
  }

  const [plan, EntityModel] = await Promise.all([
    SubscriptionPlan.findOne({
      _id: planId,
      audience: normalizedAudience,
      active: true,
    }).populate('vehicle_type_id', 'name'),
    getEntityModelForAudience(normalizedAudience),
  ]);

  if (!plan) {
    throw new ApiError(404, 'Subscription plan not found');
  }

  const entity = await EntityModel.findById(entityId);
  if (!entity) {
    throw new ApiError(404, `${normalizedAudience === 'owner' ? 'Owner' : 'Driver'} not found`);
  }

  const amount = Math.max(0, toMoney(plan.amount, 0));
  const mode = await getPartnerConfigMode();
  if (mode === 'commissionOnly') {
    throw new ApiError(400, 'Subscriptions are disabled in admin settings');
  }

  const walletResult = paymentSource === 'admin'
    ? {
        wallet: normalizedAudience === 'owner'
          ? { balance: Number(entity.wallet?.balance || 0), currency: 'INR' }
          : {
              balance: Number(entity.wallet?.balance || 0),
              cashLimit: Number(entity.wallet?.cashLimit || 0),
              isBlocked: entity.wallet?.isBlocked === true,
              currency: 'INR',
            },
      }
    : await applyWalletPurchaseForAudience({
        audience: normalizedAudience,
        entity,
        amount,
        title: `${plan.name} subscription purchase`,
        planId: plan._id,
      });

  const startedAt = new Date();
  const expiresAt = addDays(startedAt, plan.duration || 0);
  const nextBillingAt = plan.recurring_enabled ? expiresAt : null;
  const subscription = await PartnerSubscription.create({
    audience: normalizedAudience,
    ...(normalizedAudience === 'owner' ? { ownerId: entity._id } : { driverId: entity._id }),
    planId: plan._id,
    name: plan.name,
    description: plan.description,
    amount,
    durationDays: Math.max(1, Number(plan.duration || 0) || 30),
    transport_type: plan.transport_type || 'taxi',
    vehicle_type_id: plan.vehicle_type_id?._id || plan.vehicle_type_id || null,
    billing_cycle: normalizeBillingCycle(plan.billing_cycle),
    coverage_scope: normalizeCoverageScope(plan.coverage_scope, normalizedAudience === 'owner' ? 'fleet' : 'individual'),
    commission_discount_percent: Math.max(0, Number(plan.commission_discount_percent || 0)),
    priority_booking: plan.priority_booking === true,
    featured_listing: plan.featured_listing === true,
    premium_support: plan.premium_support === true,
    booking_limit: Math.max(0, Number(plan.booking_limit || 0)),
    max_vehicles_covered: Math.max(0, Number(plan.max_vehicles_covered || 0)),
    recurring_enabled: plan.recurring_enabled === true,
    autoRenew:
      autoRenew !== undefined
        ? Boolean(autoRenew)
        : plan.auto_renew_default === true,
    purchaseSource: paymentSource === 'admin' ? 'admin' : 'wallet',
    purchasedAt: startedAt,
    startedAt,
    expiresAt,
    nextBillingAt,
    metadata: {
      planSnapshot: serializePartnerPlan(plan),
    },
  });

  return {
    subscription: serializePartnerSubscription({
      ...subscription.toObject(),
      planId: plan.toObject(),
      vehicle_type_id: plan.vehicle_type_id || null,
    }),
    wallet: walletResult.wallet,
  };
};

export const getPartnerSubscriptionAnalytics = async () => {
  const now = new Date();
  const sevenDays = addDays(now, 7);

  const [plans, totals, expiringSoon, activeByAudience, revenueByAudience] = await Promise.all([
    SubscriptionPlan.find({ audience: { $in: PARTNER_AUDIENCES } }).lean(),
    PartnerSubscription.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    PartnerSubscription.countDocuments({
      status: 'active',
      expiresAt: { $gte: now, $lte: sevenDays },
    }),
    PartnerSubscription.aggregate([
      {
        $group: {
          _id: '$audience',
          activeCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'active'] }, 1, 0],
            },
          },
          totalCount: { $sum: 1 },
          autoRenewCount: {
            $sum: {
              $cond: ['$autoRenew', 1, 0],
            },
          },
        },
      },
    ]),
    PartnerSubscription.aggregate([
      {
        $group: {
          _id: '$audience',
          revenue: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  const countsByStatus = totals.reduce((acc, item) => {
    acc[String(item._id || 'unknown')] = Number(item.count || 0);
    return acc;
  }, {});

  const byAudience = PARTNER_AUDIENCES.reduce((acc, audience) => {
    const activeRow = activeByAudience.find((item) => String(item._id) === audience) || {};
    const revenueRow = revenueByAudience.find((item) => String(item._id) === audience) || {};
    const planCount = plans.filter((item) => normalizeAudience(item.audience) === audience).length;
    acc[audience] = {
      planCount,
      activeCount: Number(activeRow.activeCount || 0),
      totalCount: Number(activeRow.totalCount || 0),
      autoRenewCount: Number(activeRow.autoRenewCount || 0),
      revenue: toMoney(revenueRow.revenue, 0),
    };
    return acc;
  }, {});

  return {
    mode: await getPartnerConfigMode(),
    totalPlans: plans.length,
    activeSubscriptions: Number(countsByStatus.active || 0),
    expiredSubscriptions: Number(countsByStatus.expired || 0),
    cancelledSubscriptions: Number(countsByStatus.cancelled || 0),
    expiringSoon,
    totalRevenue: toMoney(
      Object.values(byAudience).reduce((sum, item) => sum + Number(item.revenue || 0), 0),
      0,
    ),
    byAudience,
  };
};
