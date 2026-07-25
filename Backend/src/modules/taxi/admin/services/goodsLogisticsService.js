// Warehouse + helper (labour) management for the goods/parcel module.
//
// Kept out of adminService.js deliberately: that file is already 11k+ lines.
// Same serialize/CRUD shape as the goods-type functions in there.
import { ApiError } from '../../../../utils/ApiError.js';
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

// Resolves the charge for a helper selection at booking time so the server does
// not trust a client-sent helperCharge. Mirrors the customer-side math in
// SenderReceiverDetails.jsx: loading | unloading | both (loading + unloading).
export const resolveHelperCharge = async (helperType) => {
  const normalized = normalizeHelperType(helperType, 'none');

  if (normalized === 'none' || !['loading', 'unloading', 'both'].includes(normalized)) {
    return { helperType: 'none', charge: 0 };
  }

  const helpers = await Helper.find({ available: { $ne: false } })
    .select('helper_type loading_charge unloading_charge')
    .lean();

  const loadingRate = Math.max(
    0,
    ...helpers
      .filter((item) => ['loading', 'both'].includes(item.helper_type))
      .map((item) => Number(item.loading_charge || 0)),
    0,
  );
  const unloadingRate = Math.max(
    0,
    ...helpers
      .filter((item) => ['unloading', 'both'].includes(item.helper_type))
      .map((item) => Number(item.unloading_charge || 0)),
    0,
  );

  const charge =
    normalized === 'loading'
      ? loadingRate
      : normalized === 'unloading'
        ? unloadingRate
        : loadingRate + unloadingRate;

  return { helperType: normalized, charge, loadingRate, unloadingRate };
};
