import { ApiError } from '../../../../utils/ApiError.js';

export const SUPERADMIN_PERMISSION = '*';

export const ADMIN_PERMISSIONS = [
  'dashboard.view',
  'earnings.view',
  'chat.view',
  'promotions.view',
  'users.view',
  'employees.view',
  'wallet.view',
  'drivers.view',
  'referrals.view',
  'subadmins.manage',
  'owners.view',
  'reports.view',
  'support.view',
  'service_locations.view',
  'zones.view',
  'airports.view',
  'service_stores.view',
  'vehicle_types.view',
  'rental.view',
  'set_prices.view',
  'goods_types.view',
  'bus_service.view',
  'pooling.view',
  'geofencing.view',
  'trips.view',
  'deliveries.view',
  'ongoing.view',
  'settings.view',
];

export const normalizeAdminType = (value = '') =>
  String(value || '').trim().toLowerCase() === 'subadmin' ? 'subadmin' : 'superadmin';

export const normalizeAdminPermissions = (permissions = []) => {
  if (!Array.isArray(permissions)) {
    return [];
  }

  const normalized = permissions
    .map((permission) => String(permission || '').trim())
    .filter(Boolean);

  if (normalized.includes(SUPERADMIN_PERMISSION)) {
    return [SUPERADMIN_PERMISSION];
  }

  return [...new Set(normalized)];
};

// Route-level gate. Permission checks elsewhere are opt-in calls buried in the
// service layer, which is how money-moving routes ended up with none — mount
// this on the route instead so the check cannot be forgotten.
export const requireAdminPermission = (permission, label = 'this resource') => (req, res, next) => {
  if (hasAdminPermission(req.auth?.admin, permission)) {
    return next();
  }

  return next(new ApiError(403, `You do not have permission to access ${label}`));
};

export const hasAdminPermission = (admin, permission) => {
  const adminType = normalizeAdminType(admin?.admin_type || admin?.role);
  const permissions = normalizeAdminPermissions(admin?.permissions || []);

  if (adminType === 'superadmin') {
    return true;
  }

  return permissions.includes(SUPERADMIN_PERMISSION) || permissions.includes(permission);
};
