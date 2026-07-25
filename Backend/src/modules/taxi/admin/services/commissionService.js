// Commission settings + reports.
//
// Commission is CONFIGURED per vehicle-type / SetPrice row (Vehicle.js:138-153,
// SetPrice.js:238-258) and COLLECTED in driver/services/walletService.js at ride
// completion. This service exposes the platform-wide defaults the admin
// Commission page edits, and the reports built from settled rides.
//
// Kept out of adminService.js on purpose — that file is already 11k+ lines.
import mongoose from 'mongoose';

import { ApiError } from '../../../../utils/ApiError.js';
import { Ride } from '../../user/models/Ride.js';
import { AdminBusinessSetting } from '../models/AdminBusinessSetting.js';
import { Owner } from '../models/Owner.js';
import { Vehicle } from '../models/Vehicle.js';
import { WithdrawalRequest } from '../models/WithdrawalRequest.js';
import { Driver } from '../../driver/models/Driver.js';

const SETTINGS_SCOPE = 'default';

const DEFAULT_COMMISSION_SETTINGS = {
  commission_type: 'percentage',
  driver_commission: 20,
  fleet_owner_commission: 15,
  admin_share: 10,
  auto_payout: false,
  payout_threshold: 500,
  payout_frequency: 'weekly',
  vehicle_overrides: [],
};

const PAYOUT_FREQUENCIES = ['daily', 'weekly', 'monthly'];

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampPercent = (value, fallback = 0) => Math.min(100, Math.max(0, toNumber(value, fallback)));

const roundMoney = (value) => Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;

// ------------------------------------------------------------------- settings

export const getCommissionSettings = async () => {
  const setting = await AdminBusinessSetting.findOne({ scope: SETTINGS_SCOPE }).lean();
  const stored = setting?.commission || {};

  const settings = {
    commission_type: stored.commission_type || DEFAULT_COMMISSION_SETTINGS.commission_type,
    driver_commission: toNumber(stored.driver_commission, DEFAULT_COMMISSION_SETTINGS.driver_commission),
    fleet_owner_commission: toNumber(stored.fleet_owner_commission, DEFAULT_COMMISSION_SETTINGS.fleet_owner_commission),
    admin_share: toNumber(stored.admin_share, DEFAULT_COMMISSION_SETTINGS.admin_share),
    auto_payout: stored.auto_payout === true,
    payout_threshold: toNumber(stored.payout_threshold, DEFAULT_COMMISSION_SETTINGS.payout_threshold),
    payout_frequency: PAYOUT_FREQUENCIES.includes(stored.payout_frequency)
      ? stored.payout_frequency
      : DEFAULT_COMMISSION_SETTINGS.payout_frequency,
    vehicle_overrides: Array.isArray(stored.vehicle_overrides) ? stored.vehicle_overrides : [],
  };

  return { ...settings, analytics: await getCommissionAnalytics() };
};

// Per-vehicle overrides are written straight onto the vehicle-type rows, because
// that is where walletService actually reads commission from at settlement. If we
// only stored them here they would be another dead setting.
export const updateCommissionSettings = async (payload = {}) => {
  const overrides = Array.isArray(payload.vehicle_overrides) ? payload.vehicle_overrides : [];
  const commissionType = payload.commission_type === 'fixed' ? 'fixed' : 'percentage';
  // Vehicle.admin_commission_type_from_driver: 1 = percentage, 0 = fixed
  const commissionTypeCode = commissionType === 'percentage' ? 1 : 0;

  const settings = {
    commission_type: commissionType,
    driver_commission: clampPercent(payload.driver_commission, DEFAULT_COMMISSION_SETTINGS.driver_commission),
    fleet_owner_commission: clampPercent(payload.fleet_owner_commission, DEFAULT_COMMISSION_SETTINGS.fleet_owner_commission),
    admin_share: clampPercent(payload.admin_share, DEFAULT_COMMISSION_SETTINGS.admin_share),
    auto_payout: payload.auto_payout === true,
    payout_threshold: Math.max(0, toNumber(payload.payout_threshold, DEFAULT_COMMISSION_SETTINGS.payout_threshold)),
    payout_frequency: PAYOUT_FREQUENCIES.includes(payload.payout_frequency)
      ? payload.payout_frequency
      : DEFAULT_COMMISSION_SETTINGS.payout_frequency,
    vehicle_overrides: overrides
      .filter((item) => item && mongoose.Types.ObjectId.isValid(item.vehicle_type_id))
      .map((item) => ({
        vehicle_type_id: String(item.vehicle_type_id),
        commission: item.commission === null || item.commission === '' ? null : toNumber(item.commission, null),
      })),
  };

  await AdminBusinessSetting.updateOne(
    { scope: SETTINGS_SCOPE },
    { $set: { commission: settings } },
    { upsert: true },
  );

  // Push the resolved rate onto each vehicle type so settlement honours it.
  const writes = settings.vehicle_overrides
    .filter((item) => item.commission !== null)
    .map((item) => ({
      updateOne: {
        filter: { _id: item.vehicle_type_id },
        update: {
          $set: {
            admin_commission_type_from_driver: commissionTypeCode,
            admin_commission_from_driver: item.commission,
            admin_commission_type_for_owner: commissionTypeCode,
            admin_commission_for_owner: settings.fleet_owner_commission,
          },
        },
      },
    }));

  if (writes.length) {
    await Vehicle.bulkWrite(writes);
  }

  return { ...settings, analytics: await getCommissionAnalytics() };
};

const getCommissionAnalytics = async () => {
  const [collected] = await Ride.aggregate([
    { $match: { status: 'completed', walletSettledAt: { $ne: null } } },
    {
      $group: {
        _id: null,
        total_collected: { $sum: { $ifNull: ['$commissionAmount', 0] } },
        total_fare: { $sum: { $ifNull: ['$fare', 0] } },
        trips: { $sum: 1 },
      },
    },
  ]);

  const [driverPending, fleetPending] = await Promise.all([
    WithdrawalRequest.aggregate([
      { $match: { status: 'pending', driver_id: { $ne: null } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
    ]),
    WithdrawalRequest.aggregate([
      { $match: { status: 'pending', owner_id: { $ne: null } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
    ]),
  ]);

  const totalFare = toNumber(collected?.total_fare, 0);
  const totalCollected = toNumber(collected?.total_collected, 0);

  return {
    total_collected: roundMoney(totalCollected),
    driver_payouts_pending: roundMoney(driverPending?.[0]?.total || 0),
    fleet_payouts_pending: roundMoney(fleetPending?.[0]?.total || 0),
    avg_rate: totalFare > 0 ? Math.round((totalCollected / totalFare) * 10000) / 100 : 0,
    total_trips: toNumber(collected?.trips, 0),
  };
};

// -------------------------------------------------------------------- reports

// Inclusive start of the requested window. 'daily' means today.
const resolvePeriodStart = (period) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'daily') {
    return start;
  }

  if (period === 'monthly') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (period === 'yearly') {
    return new Date(now.getFullYear(), 0, 1);
  }

  // weekly (default) — last 7 days including today
  start.setDate(start.getDate() - 6);
  return start;
};

const buildPeriodMatch = (period, { from, to } = {}) => {
  const match = { status: 'completed', walletSettledAt: { $ne: null } };
  const parsedFrom = from ? new Date(from) : null;
  const parsedTo = to ? new Date(to) : null;

  if (parsedFrom && !Number.isNaN(parsedFrom.getTime())) {
    match.completedAt = { $gte: parsedFrom };
    if (parsedTo && !Number.isNaN(parsedTo.getTime())) {
      match.completedAt.$lte = parsedTo;
    }
    return match;
  }

  match.completedAt = { $gte: resolvePeriodStart(period) };
  return match;
};

export const getCommissionReport = async ({ period = 'weekly', from, to } = {}) => {
  const match = buildPeriodMatch(period, { from, to });

  const [totals] = await Ride.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total_commission: { $sum: { $ifNull: ['$commissionAmount', 0] } },
        total_fare: { $sum: { $ifNull: ['$fare', 0] } },
        driver_share: { $sum: { $ifNull: ['$driverEarnings', 0] } },
        fleet_share: { $sum: { $ifNull: ['$ownerEarnings', 0] } },
        total_trips: { $sum: 1 },
      },
    },
  ]);

  const byVehicle = await Ride.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$vehicleTypeId',
        commission: { $sum: { $ifNull: ['$commissionAmount', 0] } },
        fare: { $sum: { $ifNull: ['$fare', 0] } },
        trips: { $sum: 1 },
      },
    },
    { $sort: { commission: -1 } },
    {
      $lookup: {
        from: Vehicle.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'vehicle',
      },
    },
    {
      $project: {
        _id: 0,
        vehicle_type_id: '$_id',
        vehicle_name: { $ifNull: [{ $first: '$vehicle.name' }, 'Unknown'] },
        commission: 1,
        fare: 1,
        trips: 1,
      },
    },
  ]);

  // Bucketed collection series — the SOW asks for daily/weekly/monthly reports
  // and nothing previously grouped by period at all.
  const bucketFormat = period === 'monthly' || period === 'yearly' ? '%Y-%m' : '%Y-%m-%d';
  const series = await Ride.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: bucketFormat, date: '$completedAt' } },
        commission: { $sum: { $ifNull: ['$commissionAmount', 0] } },
        fare: { $sum: { $ifNull: ['$fare', 0] } },
        trips: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, bucket: '$_id', commission: 1, fare: 1, trips: 1 } },
  ]);

  const totalCommission = roundMoney(totals?.total_commission || 0);
  const driverShare = roundMoney(totals?.driver_share || 0);
  const fleetShare = roundMoney(totals?.fleet_share || 0);

  return {
    period,
    total_commission: totalCommission,
    total_fare: roundMoney(totals?.total_fare || 0),
    total_trips: toNumber(totals?.total_trips, 0),
    driver_share: driverShare,
    fleet_share: fleetShare,
    // What the platform keeps after the fleet owner's cut.
    platform_share: roundMoney(totalCommission - fleetShare > 0 ? totalCommission - fleetShare : totalCommission),
    by_vehicle: byVehicle.map((row) => ({
      ...row,
      commission: roundMoney(row.commission),
      fare: roundMoney(row.fare),
    })),
    series,
  };
};

export const getDriverPayoutReport = async ({ period = 'weekly', from, to } = {}) => {
  const match = buildPeriodMatch(period, { from, to });

  const rows = await Ride.aggregate([
    { $match: { ...match, driverId: { $ne: null } } },
    {
      $group: {
        _id: '$driverId',
        trips: { $sum: 1 },
        gross_fare: { $sum: { $ifNull: ['$fare', 0] } },
        commission: { $sum: { $ifNull: ['$commissionAmount', 0] } },
        earnings: { $sum: { $ifNull: ['$driverEarnings', 0] } },
      },
    },
    { $sort: { earnings: -1 } },
    {
      $lookup: {
        from: Driver.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'driver',
      },
    },
    {
      $project: {
        _id: 0,
        driver_id: '$_id',
        name: { $ifNull: [{ $first: '$driver.name' }, 'Unknown'] },
        phone: { $ifNull: [{ $first: '$driver.phone' }, '' ] },
        wallet_balance: { $ifNull: [{ $first: '$driver.wallet.balance' }, 0] },
        trips: 1,
        gross_fare: 1,
        commission: 1,
        earnings: 1,
      },
    },
  ]);

  return {
    period,
    results: rows.map((row) => ({
      ...row,
      gross_fare: roundMoney(row.gross_fare),
      commission: roundMoney(row.commission),
      earnings: roundMoney(row.earnings),
      wallet_balance: roundMoney(row.wallet_balance),
    })),
    total: rows.length,
  };
};

export const getFleetPayoutReport = async ({ period = 'weekly', from, to } = {}) => {
  const match = buildPeriodMatch(period, { from, to });

  const rows = await Ride.aggregate([
    { $match: { ...match, ownerId: { $ne: null } } },
    {
      $group: {
        _id: '$ownerId',
        trips: { $sum: 1 },
        gross_fare: { $sum: { $ifNull: ['$fare', 0] } },
        owner_commission: { $sum: { $ifNull: ['$ownerCommissionAmount', 0] } },
        earnings: { $sum: { $ifNull: ['$ownerEarnings', 0] } },
      },
    },
    { $sort: { earnings: -1 } },
    {
      $lookup: {
        from: Owner.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'owner',
      },
    },
    {
      $project: {
        _id: 0,
        owner_id: '$_id',
        company_name: { $ifNull: [{ $first: '$owner.company_name' }, ''] },
        name: { $ifNull: [{ $first: '$owner.owner_name' }, 'Unknown'] },
        mobile: { $ifNull: [{ $first: '$owner.mobile' }, ''] },
        wallet_balance: { $ifNull: [{ $first: '$owner.wallet.balance' }, 0] },
        trips: 1,
        gross_fare: 1,
        owner_commission: 1,
        earnings: 1,
      },
    },
  ]);

  return {
    period,
    results: rows.map((row) => ({
      ...row,
      gross_fare: roundMoney(row.gross_fare),
      owner_commission: roundMoney(row.owner_commission),
      earnings: roundMoney(row.earnings),
      wallet_balance: roundMoney(row.wallet_balance),
    })),
    total: rows.length,
  };
};

// Shared by the CSV/XLSX export route.
export const buildCommissionExportRows = async (query = {}) => {
  const report = await getCommissionReport(query);

  if (!report.by_vehicle.length) {
    throw new ApiError(404, 'No commission records found for the selected period');
  }

  return report.by_vehicle.map((row) => ({
    vehicle_type: row.vehicle_name,
    trips: row.trips,
    gross_fare: row.fare,
    commission_collected: row.commission,
  }));
};
