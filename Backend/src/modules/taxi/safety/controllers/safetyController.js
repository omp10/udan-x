import { asyncHandler } from '../../../../utils/asyncHandler.js';
import { SafetyAlert } from '../../common/models/SafetyAlert.js';
import { Driver } from '../../driver/models/Driver.js';
import { Delivery } from '../../user/models/Delivery.js';
import { Ride } from '../../user/models/Ride.js';
import { User } from '../../user/models/User.js';
import { emitToAdmins } from '../../services/dispatchService.js';
import { sendPushNotificationToEntities } from '../../services/pushNotificationService.js';
import { sendTransactionalSms } from '../../services/smsService.js';
import { normalizeEmergencyContacts } from '../../common/utils/emergencyContacts.js';

const cleanString = (value = '') => String(value || '').trim();

const maskPhone = (phone = '') => `${'*'.repeat(6)}${String(phone).slice(-4)}`;

const normalizeCoordinates = (value) => {
  if (Array.isArray(value) && value.length >= 2) {
    const [lng, lat] = value;
    if (Number.isFinite(Number(lng)) && Number.isFinite(Number(lat))) {
      return [Number(lng), Number(lat)];
    }
  }

  const nestedCoordinates = value?.coordinates;
  if (Array.isArray(nestedCoordinates) && nestedCoordinates.length >= 2) {
    const [lng, lat] = nestedCoordinates;
    if (Number.isFinite(Number(lng)) && Number.isFinite(Number(lat))) {
      return [Number(lng), Number(lat)];
    }
  }

  const lat = Number(value?.lat ?? value?.latitude);
  const lng = Number(value?.lng ?? value?.longitude ?? value?.lon);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return [Number(lng), Number(lat)];
  }

  return null;
};

const serializeSafetyAlert = (alert = {}) => {
  const coordinates = Array.isArray(alert?.location?.coordinates) ? alert.location.coordinates : [];
  const [lng, lat] = coordinates;

  return {
    id: String(alert?._id || ''),
    incidentType: cleanString(alert?.incidentType || 'sos').toLowerCase(),
    status: cleanString(alert?.status || 'active').toLowerCase(),
    sourceApp: cleanString(alert?.sourceApp || '').toLowerCase(),
    serviceType: cleanString(alert?.serviceType || 'general').toLowerCase(),
    riderName: cleanString(alert?.riderName),
    riderPhone: cleanString(alert?.riderPhone),
    driverName: cleanString(alert?.driverName),
    driverPhone: cleanString(alert?.driverPhone),
    vehicleLabel: cleanString(alert?.vehicleLabel),
    tripCode: cleanString(alert?.tripCode),
    pickupAddress: cleanString(alert?.pickupAddress),
    dropAddress: cleanString(alert?.dropAddress),
    locationLabel: cleanString(alert?.locationLabel),
    location:
      Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
        ? {
            lat: Number(lat),
            lng: Number(lng),
            coordinates: [Number(lng), Number(lat)],
          }
        : null,
    notes: cleanString(alert?.notes),
    notifiedContacts: Array.isArray(alert?.notifiedContacts)
      ? alert.notifiedContacts.map((contact) => ({
          name: cleanString(contact?.name),
          phone: cleanString(contact?.phone),
          channels: Array.isArray(contact?.channels) ? contact.channels.map(cleanString) : [],
          delivered: Boolean(contact?.delivered),
          error: cleanString(contact?.error),
          notifiedAt: contact?.notifiedAt || null,
        }))
      : [],
    createdAt: alert?.createdAt || null,
    updatedAt: alert?.updatedAt || null,
    resolvedAt: alert?.resolvedAt || null,
    rideId: alert?.rideId ? String(alert.rideId?._id || alert.rideId) : '',
    deliveryId: alert?.deliveryId ? String(alert.deliveryId?._id || alert.deliveryId) : '',
    userId: alert?.userId ? String(alert.userId?._id || alert.userId) : '',
    driverId: alert?.driverId ? String(alert.driverId?._id || alert.driverId) : '',
    logs: Array.isArray(alert?.logs)
      ? alert.logs.map((log) => ({
          id: String(log?._id || ''),
          actorRole: cleanString(log?.actorRole || 'system').toLowerCase(),
          message: cleanString(log?.message),
          createdAt: log?.createdAt || null,
        }))
      : [],
  };
};

const readRideContext = async ({ rideId, deliveryId }) => {
  let ride = null;
  let delivery = null;

  if (rideId) {
    ride = await Ride.findById(rideId)
      .populate('userId', 'name phone')
      .populate('driverId', 'name phone vehicle')
      .lean();
  }

  if (deliveryId) {
    delivery = await Delivery.findById(deliveryId)
      .populate('userId', 'name phone')
      .populate('driverId', 'name phone vehicle')
      .lean();
  }

  if (!delivery && ride?.deliveryId) {
    delivery = await Delivery.findById(ride.deliveryId)
      .populate('userId', 'name phone')
      .populate('driverId', 'name phone vehicle')
      .lean();
  }

  if (!ride && delivery?.rideId) {
    ride = await Ride.findById(delivery.rideId)
      .populate('userId', 'name phone')
      .populate('driverId', 'name phone vehicle')
      .lean();
  }

  return { ride, delivery };
};

const deriveServiceType = ({ requestedServiceType, ride, delivery }) => {
  const direct = cleanString(requestedServiceType).toLowerCase();
  if (['ride', 'parcel', 'intercity', 'general'].includes(direct)) {
    return direct;
  }

  const rideType = cleanString(ride?.serviceType || ride?.type).toLowerCase();
  if (['ride', 'parcel', 'intercity'].includes(rideType)) {
    return rideType;
  }

  if (delivery) {
    return 'parcel';
  }

  return 'general';
};

const createAlertRecord = async ({
  sourceApp,
  authId,
  rideId,
  deliveryId,
  serviceType,
  location,
  locationLabel,
  pickupAddress,
  dropAddress,
  notes,
  tripCode,
  vehicleLabel,
}) => {
  const { ride, delivery } = await readRideContext({ rideId, deliveryId });
  const actorUser = sourceApp === 'user'
    ? await User.findById(authId).select('name phone emergencyContacts').lean()
    : ride?.userId || delivery?.userId || null;
  const actorDriver = sourceApp === 'driver'
    ? await Driver.findById(authId).select('name phone vehicle emergencyContacts').lean()
    : ride?.driverId || delivery?.driverId || null;
  const coords =
    normalizeCoordinates(location)
    || normalizeCoordinates(delivery?.pickupLocation)
    || normalizeCoordinates(ride?.pickupLocation);

  const created = await SafetyAlert.create({
    sourceApp,
    serviceType: deriveServiceType({ requestedServiceType: serviceType, ride, delivery }),
    userId: sourceApp === 'user' ? authId : actorUser?._id || null,
    driverId: sourceApp === 'driver' ? authId : actorDriver?._id || null,
    rideId: ride?._id || rideId || null,
    deliveryId: delivery?._id || deliveryId || null,
    riderName: cleanString(actorUser?.name),
    riderPhone: cleanString(actorUser?.phone),
    driverName: cleanString(actorDriver?.name),
    driverPhone: cleanString(actorDriver?.phone),
    vehicleLabel: cleanString(vehicleLabel) || cleanString(actorDriver?.vehicle),
    tripCode:
      cleanString(tripCode)
      || cleanString(ride?.bookingId)
      || cleanString(ride?._id)
      || cleanString(delivery?._id),
    pickupAddress:
      cleanString(pickupAddress)
      || cleanString(delivery?.pickupAddress)
      || cleanString(ride?.pickupAddress),
    dropAddress:
      cleanString(dropAddress)
      || cleanString(delivery?.dropAddress)
      || cleanString(ride?.dropAddress),
    locationLabel:
      cleanString(locationLabel)
      || cleanString(delivery?.pickupAddress)
      || cleanString(ride?.pickupAddress),
    location: coords ? { type: 'Point', coordinates: coords } : undefined,
    notes: cleanString(notes),
    logs: [
      {
        actorRole: 'system',
        message: `SOS triggered from ${sourceApp} app`,
      },
    ],
  });

  const actor = sourceApp === 'driver' ? actorDriver : actorUser;

  return {
    alert: await SafetyAlert.findById(created._id).lean(),
    contacts: normalizeEmergencyContacts(actor?.emergencyContacts),
    actorLabel: cleanString(actor?.name) || (sourceApp === 'driver' ? 'Your driver contact' : 'Your contact'),
    actorPhone: cleanString(actor?.phone),
  };
};

const buildSosSmsText = ({ actorLabel, actorPhone, alert }) => {
  const coordinates = Array.isArray(alert?.location?.coordinates) ? alert.location.coordinates : [];
  const [lng, lat] = coordinates;
  const mapLink =
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? `https://maps.google.com/?q=${Number(lat)},${Number(lng)}`
      : '';

  return [
    `EMERGENCY SOS: ${actorLabel} has triggered an SOS alert and may need help.`,
    actorPhone ? `Phone: ${actorPhone}.` : '',
    cleanString(alert?.locationLabel) ? `Near: ${cleanString(alert.locationLabel)}.` : '',
    mapLink ? `Live location: ${mapLink}` : '',
    cleanString(alert?.tripCode) ? `Trip: ${cleanString(alert.tripCode)}.` : '',
    'Please reach out immediately.',
  ]
    .filter(Boolean)
    .join(' ');
};

// A contact who also has one of our apps installed gets a push too; contacts
// without an account simply have no token and this is a no-op.
const pushToContactAccount = async ({ phone, message }) => {
  const phoneVariants = [phone, `91${phone}`, `+91${phone}`];
  const [users, drivers] = await Promise.all([
    User.find({ phone: { $in: phoneVariants } }).select('_id').lean(),
    Driver.find({ phone: { $in: phoneVariants } }).select('_id').lean(),
  ]);

  if (!users.length && !drivers.length) {
    return false;
  }

  const result = await sendPushNotificationToEntities({
    userIds: users.map((user) => user._id),
    driverIds: drivers.map((driver) => driver._id),
    title: 'Emergency SOS alert',
    body: message,
    data: { type: 'sos_emergency_contact' },
  });

  return Number(result?.deliveredCount || 0) > 0;
};

/**
 * Notifies the actor's stored emergency contacts. Every failure is swallowed and
 * logged: the alert is already persisted and on the admin dashboard, and a dead
 * SMS provider must never turn a recorded SOS into a 500.
 */
const notifyEmergencyContacts = async ({ alert, contacts, actorLabel, actorPhone }) => {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return [];
  }

  const message = buildSosSmsText({ actorLabel, actorPhone, alert });

  return Promise.all(
    contacts.map(async (contact) => {
      const record = {
        name: contact.name,
        phone: contact.phone,
        channels: [],
        delivered: false,
        error: '',
        notifiedAt: new Date(),
      };

      try {
        await sendTransactionalSms({ phone: contact.phone, message, purpose: 'sos alert' });
        record.channels.push('sms');
        record.delivered = true;
      } catch (error) {
        record.error = cleanString(error?.message || 'SMS delivery failed').slice(0, 300);
        console.error('[safetyController] SOS SMS to emergency contact failed', {
          alertId: String(alert?._id || ''),
          phone: maskPhone(contact.phone),
          error: record.error,
        });
      }

      try {
        if (await pushToContactAccount({ phone: contact.phone, message })) {
          record.channels.push('push');
          record.delivered = true;
        }
      } catch (error) {
        console.error('[safetyController] SOS push to emergency contact failed', {
          alertId: String(alert?._id || ''),
          phone: maskPhone(contact.phone),
          error: cleanString(error?.message),
        });
      }

      return record;
    }),
  );
};

const dispatchSosAlert = async ({ sourceApp, req, res }) => {
  const { alert, contacts, actorLabel, actorPhone } = await createAlertRecord({
    sourceApp,
    authId: req.auth.sub,
    rideId: cleanString(req.body?.rideId),
    deliveryId: cleanString(req.body?.deliveryId),
    serviceType: req.body?.serviceType,
    location: req.body?.location,
    locationLabel: req.body?.locationLabel,
    pickupAddress: req.body?.pickupAddress,
    dropAddress: req.body?.dropAddress,
    notes: req.body?.notes,
    tripCode: req.body?.tripCode,
    vehicleLabel: req.body?.vehicleLabel,
  });

  // Admins first: they must see the incident even if contact delivery hangs.
  const initialPayload = serializeSafetyAlert(alert);
  emitToAdmins('new_sos', initialPayload);
  emitToAdmins('safety:alert:new', initialPayload);

  let notifiedContacts = [];

  try {
    notifiedContacts = await notifyEmergencyContacts({ alert, contacts, actorLabel, actorPhone });

    if (notifiedContacts.length) {
      const deliveredCount = notifiedContacts.filter((contact) => contact.delivered).length;
      await SafetyAlert.updateOne(
        { _id: alert._id },
        {
          $set: { notifiedContacts },
          $push: {
            logs: {
              actorRole: 'system',
              message: `Notified ${deliveredCount}/${notifiedContacts.length} emergency contacts`,
            },
          },
        },
      );
    }
  } catch (error) {
    console.error('[safetyController] emergency contact notification failed', {
      alertId: String(alert?._id || ''),
      error: cleanString(error?.message),
    });
  }

  const payload = notifiedContacts.length
    ? serializeSafetyAlert((await SafetyAlert.findById(alert._id).lean()) || alert)
    : initialPayload;

  if (notifiedContacts.length) {
    emitToAdmins('safety:alert:updated', payload);
  }

  res.json({ success: true, data: payload });
};

export const triggerUserSosAlert = asyncHandler(async (req, res) => {
  await dispatchSosAlert({ sourceApp: 'user', req, res });
});

export const triggerDriverSosAlert = asyncHandler(async (req, res) => {
  await dispatchSosAlert({ sourceApp: 'driver', req, res });
});

export const listSafetyAlerts = asyncHandler(async (req, res) => {
  const status = cleanString(req.query?.status || 'active').toLowerCase();
  const page = Math.max(1, Number(req.query?.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 25)));
  const query = {};

  if (status && status !== 'all') {
    query.status = status;
  }

  const [results, total] = await Promise.all([
    SafetyAlert.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SafetyAlert.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      results: results.map(serializeSafetyAlert),
      paginator: {
        current_page: page,
        last_page: Math.max(1, Math.ceil(total / limit)),
        total,
      },
    },
  });
});

export const resolveSafetyAlert = asyncHandler(async (req, res) => {
  const alert = await SafetyAlert.findById(req.params.id);

  if (!alert) {
    res.status(404).json({
      success: false,
      message: 'Safety alert not found',
    });
    return;
  }

  alert.status = 'resolved';
  alert.resolvedAt = new Date();
  alert.resolvedByAdminId = cleanString(req.auth?.sub);
  alert.logs.push({
    actorRole: 'admin',
    message: cleanString(req.body?.note) || 'Incident marked as resolved by admin',
  });

  await alert.save();

  const payload = serializeSafetyAlert(alert.toObject());
  emitToAdmins('safety:alert:updated', payload);

  res.json({ success: true, data: payload });
});
