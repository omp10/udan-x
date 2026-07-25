// Warehouse + helper (labour) management for the goods/parcel module.
//
// Kept out of adminService.js deliberately: that file is already 11k+ lines.
// Same serialize/CRUD shape as the goods-type functions in there.
import { ApiError } from '../../../../utils/ApiError.js';
import { Ride } from '../../user/models/Ride.js';
import { Helper } from '../models/Helper.js';
import { Warehouse } from '../models/Warehouse.js';

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return !['0', 'false', 'no', 'inactive', 'off'].includes(normalized);
};

const toMoney = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const normalizeCoordinates = (payload = {}) => {
  const raw = Array.isArray(payload.coordinates)
    ? payload.coordinates
    : [payload.longitude ?? payload.lng, payload.latitude ?? payload.lat];

  const [longitude, latitude] = (raw || []).map(Number);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new ApiError(400, 'coordinates must be valid [longitude, latitude]');
  }

  return [longitude, latitude];
};

// ---------------------------------------------------------------- warehouses

const serializeWarehouse = (item) => ({
  _id: item._id,
  id: String(item._id),
  name: item.name || '',
  address: item.address || '',
  city: item.city || '',
  state: item.state || '',
  pincode: item.pincode || '',
  zone: item.zone || '',
  contact_name: item.contact_name || '',
  contact_phone: item.contact_phone || '',
  // the customer picker reads `coordinates` directly
  coordinates: Array.isArray(item.location?.coordinates) && item.location.coordinates.length === 2
    ? item.location.coordinates
    : null,
  is_pickup: item.is_pickup !== false,
  is_drop: item.is_drop !== false,
  capacity_notes: item.capacity_notes || '',
  active: item.active !== false,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});

const buildWarehouseUpdate = (payload = {}, { partial = false } = {}) => {
  const update = {};
  const assign = (key, value) => {
    if (!partial || payload[key] !== undefined) {
      update[key] = value;
    }
  };

  assign('name', String(payload.name || '').trim());
  assign('address', String(payload.address || '').trim());
  assign('city', String(payload.city || '').trim());
  assign('state', String(payload.state || '').trim());
  assign('pincode', String(payload.pincode || '').trim());
  assign('zone', String(payload.zone || '').trim());
  assign('contact_name', String(payload.contact_name || '').trim());
  assign('contact_phone', String(payload.contact_phone || '').trim());
  assign('capacity_notes', String(payload.capacity_notes || '').trim());
  assign('is_pickup', toBool(payload.is_pickup, true));
  assign('is_drop', toBool(payload.is_drop, true));
  assign('active', toBool(payload.active, true));

  const coordinates = normalizeCoordinates(payload);
  if (coordinates) {
    update.location = { type: 'Point', coordinates };
  }

  return update;
};

export const listWarehouses = async ({ activeOnly = false, role = '' } = {}) => {
  const filter = {};

  if (activeOnly) {
    filter.active = { $ne: false };
  }

  if (role === 'pickup') {
    filter.is_pickup = { $ne: false };
  } else if (role === 'drop') {
    filter.is_drop = { $ne: false };
  }

  const items = await Warehouse.find(filter).sort({ name: 1, createdAt: -1 }).lean();
  const results = items.map(serializeWarehouse);

  return { success: true, results, total: results.length };
};

export const createWarehouse = async (payload = {}) => {
  const update = buildWarehouseUpdate(payload);

  if (!update.name) {
    throw new ApiError(400, 'Warehouse name is required');
  }

  const item = await Warehouse.create(update);
  return serializeWarehouse(item.toObject());
};

export const updateWarehouse = async (id, payload = {}) => {
  const update = buildWarehouseUpdate(payload, { partial: true });

  if (update.name !== undefined && !update.name) {
    throw new ApiError(400, 'Warehouse name cannot be empty');
  }

  const item = await Warehouse.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();

  if (!item) {
    throw new ApiError(404, 'Warehouse not found');
  }

  return serializeWarehouse(item);
};

export const deleteWarehouse = async (id) => {
  const deleted = await Warehouse.findByIdAndDelete(id);

  if (!deleted) {
    throw new ApiError(404, 'Warehouse not found');
  }

  return { deleted: true };
};

// ------------------------------------------------------------------- helpers

const serializeHelper = (item) => ({
  _id: item._id,
  id: String(item._id),
  name: item.name || '',
  phone: item.phone || '',
  city: item.city || '',
  helper_type: item.helper_type || 'both',
  loading_charge: Number(item.loading_charge || 0),
  unloading_charge: Number(item.unloading_charge || 0),
  available: item.available !== false,
  total_earnings: Number(item.total_earnings || 0),
  total_jobs: Number(item.total_jobs || 0),
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});

const normalizeHelperType = (value, fallback = 'both') => {
  const normalized = String(value || '').trim().toLowerCase();
  return ['loading', 'unloading', 'both'].includes(normalized) ? normalized : fallback;
};

const buildHelperUpdate = (payload = {}, { partial = false } = {}) => {
  const update = {};
  const assign = (key, value) => {
    if (!partial || payload[key] !== undefined) {
      update[key] = value;
    }
  };

  assign('name', String(payload.name || '').trim());
  assign('phone', String(payload.phone || '').trim());
  assign('city', String(payload.city || '').trim());
  assign('helper_type', normalizeHelperType(payload.helper_type));
  assign('loading_charge', toMoney(payload.loading_charge, 0));
  assign('unloading_charge', toMoney(payload.unloading_charge, 0));
  assign('available', toBool(payload.available, true));

  return update;
};

export const listHelpers = async ({ availableOnly = false } = {}) => {
  const filter = availableOnly ? { available: { $ne: false } } : {};
  const items = await Helper.find(filter).sort({ name: 1, createdAt: -1 }).lean();
  const results = items.map(serializeHelper);

  return { success: true, results, total: results.length };
};

export const createHelper = async (payload = {}) => {
  const update = buildHelperUpdate(payload);

  if (!update.name) {
    throw new ApiError(400, 'Helper name is required');
  }

  const item = await Helper.create(update);
  return serializeHelper(item.toObject());
};

export const updateHelper = async (id, payload = {}) => {
  const update = buildHelperUpdate(payload, { partial: true });

  if (update.name !== undefined && !update.name) {
    throw new ApiError(400, 'Helper name cannot be empty');
  }

  const item = await Helper.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();

  if (!item) {
    throw new ApiError(404, 'Helper not found');
  }

  return serializeHelper(item);
};

export const deleteHelper = async (id) => {
  const deleted = await Helper.findByIdAndDelete(id);

  if (!deleted) {
    throw new ApiError(404, 'Helper not found');
  }

  return { deleted: true };
};

// -------------------------------------------------------- helper assignment
//
// A booking used to be priced at the MAX rate across the whole roster and
// assigned to nobody, so total_earnings/total_jobs could never move. Now the
// booking picks real people and is billed at THEIR rates.

export const MAX_HELPERS_PER_BOOKING = 5;

const HELPER_ROLES = { loading: ['loading'], unloading: ['unloading'], both: ['loading', 'unloading'] };

// A 'both' request needs one person who does both jobs. Pairing a loading-only
// with an unloading-only helper would bill two people for one seat.
const helperCovers = (helper, roles) =>
  roles.every((role) => helper.helper_type === 'both' || helper.helper_type === role);

// toMoney (not Math.max) because Math.max(0, NaN) is NaN, not 0.
const helperChargeFor = (helper, roles) =>
  roles.reduce(
    (sum, role) => sum + toMoney(role === 'loading' ? helper.loading_charge : helper.unloading_charge, 0),
    0,
  );

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const emptyHelperSelection = () => ({
  type: 'none',
  count: 0,
  requestedCount: 0,
  loadingCharge: 0,
  unloadingCharge: 0,
  totalCharge: 0,
  assigned: [],
});

// Pure so it is testable without a DB. Least-used helpers first so work spreads
// across the roster instead of piling onto whoever happens to be cheapest.
//
// ponytail: `available` is the admin's switch, not a per-job lock — two
// overlapping bookings can draw the same helper. Real exclusivity needs booking
// time windows; add a busyUntil field if double-booking becomes a complaint.
export const selectHelpersFromPool = ({ helperType, count, helpers = [] } = {}) => {
  const normalized = normalizeHelperType(helperType, 'none');
  const roles = HELPER_ROLES[normalized];

  if (!roles) {
    return emptyHelperSelection();
  }

  const requestedCount = Math.min(
    Math.max(Math.floor(Number(count) || 1), 1),
    MAX_HELPERS_PER_BOOKING,
  );

  const pool = (Array.isArray(helpers) ? helpers : [])
    .filter((item) => item && item.available !== false && helperCovers(item, roles))
    .sort(
      (first, second) =>
        Number(first.total_jobs || 0) - Number(second.total_jobs || 0) ||
        helperChargeFor(first, roles) - helperChargeFor(second, roles),
    )
    .slice(0, requestedCount);

  const sumRate = (field) => pool.reduce((sum, item) => sum + toMoney(item[field], 0), 0);
  const loadingCharge = roles.includes('loading') ? roundMoney(sumRate('loading_charge')) : 0;
  const unloadingCharge = roles.includes('unloading') ? roundMoney(sumRate('unloading_charge')) : 0;

  return {
    // Nobody available -> the selection collapses to 'none' and costs nothing.
    type: pool.length ? normalized : 'none',
    count: pool.length,
    requestedCount,
    loadingCharge,
    unloadingCharge,
    totalCharge: roundMoney(loadingCharge + unloadingCharge),
    assigned: pool.map((item) => ({
      helperId: String(item._id || item.id || ''),
      name: item.name || '',
      phone: item.phone || '',
      helperType: item.helper_type || 'both',
      charge: roundMoney(helperChargeFor(item, roles)),
    })),
  };
};

// Booking-time entry point. Partial availability degrades the count (the customer
// pays only for the people who actually turn up); zero availability rejects
// rather than silently dropping a service the customer asked and would be
// charged for.
export const assignHelpersForBooking = async ({ helperType, count } = {}) => {
  const normalized = normalizeHelperType(helperType, 'none');

  if (!HELPER_ROLES[normalized]) {
    return emptyHelperSelection();
  }

  const helpers = await Helper.find({ available: { $ne: false } })
    .select('name phone helper_type loading_charge unloading_charge available total_jobs')
    .lean();

  const selection = selectHelpersFromPool({ helperType: normalized, count, helpers });

  if (!selection.count) {
    throw new ApiError(
      409,
      `No ${normalized === 'both' ? 'loading & unloading' : normalized} helper is available right now. Remove the helper add-on to continue.`,
    );
  }

  return selection;
};

// Per-helper earnings, job counts and recent jobs for the admin view. Recent jobs
// are read off Ride.parcel.helper.assigned — no separate job ledger needed.
export const getHelperEarningsReport = async ({ recentLimit = 5 } = {}) => {
  const limit = Math.min(Math.max(Math.floor(Number(recentLimit) || 5), 1), 20);

  const [helpers, jobRows] = await Promise.all([
    Helper.find().sort({ total_earnings: -1, name: 1 }).lean(),
    Ride.aggregate([
      { $match: { serviceType: 'parcel', 'parcel.helper.assigned.helperId': { $exists: true, $ne: '' } } },
      { $sort: { completedAt: -1, createdAt: -1 } },
      { $unwind: '$parcel.helper.assigned' },
      {
        $group: {
          _id: '$parcel.helper.assigned.helperId',
          settled_earnings: {
            $sum: { $cond: ['$helpersSettledAt', '$parcel.helper.assigned.charge', 0] },
          },
          settled_jobs: { $sum: { $cond: ['$helpersSettledAt', 1, 0] } },
          pending_jobs: { $sum: { $cond: ['$helpersSettledAt', 0, 1] } },
          jobs: {
            $push: {
              ride_id: { $toString: '$_id' },
              status: '$status',
              charge: '$parcel.helper.assigned.charge',
              role: '$parcel.helper.assigned.helperType',
              pickup_address: '$pickupAddress',
              drop_address: '$dropAddress',
              settled: { $cond: ['$helpersSettledAt', true, false] },
              completed_at: '$completedAt',
              created_at: '$createdAt',
            },
          },
        },
      },
      { $project: { settled_earnings: 1, settled_jobs: 1, pending_jobs: 1, jobs: { $slice: ['$jobs', limit] } } },
    ]),
  ]);

  const byHelperId = new Map(jobRows.map((row) => [String(row._id), row]));

  const results = helpers.map((helper) => {
    const row = byHelperId.get(String(helper._id)) || {};

    return {
      ...serializeHelper(helper),
      settled_earnings: roundMoney(row.settled_earnings || 0),
      settled_jobs: Number(row.settled_jobs || 0),
      pending_jobs: Number(row.pending_jobs || 0),
      recent_jobs: Array.isArray(row.jobs) ? row.jobs : [],
    };
  });

  return {
    success: true,
    results,
    totals: {
      helpers: results.length,
      available: results.filter((item) => item.available).length,
      earnings: roundMoney(results.reduce((sum, item) => sum + item.total_earnings, 0)),
      jobs: results.reduce((sum, item) => sum + item.total_jobs, 0),
      pending_jobs: results.reduce((sum, item) => sum + item.pending_jobs, 0),
    },
  };
};
