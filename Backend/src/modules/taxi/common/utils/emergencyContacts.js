// Shared normalisation for SOS emergency contacts (user + driver).
// Safety-critical: a contact that fails to normalise is a person who never
// gets the SOS SMS, so every read path runs through normalizeEmergencyContacts.
export const MAX_EMERGENCY_CONTACTS = 5;

const NAME_REGEX = /^[A-Za-z]+(?:[ .'-][A-Za-z]+)*$/;
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export const sanitizeEmergencyPhone = (value) =>
  String(value || '')
    .replace(/\D/g, '')
    .slice(-10);

export const isValidEmergencyPhone = (value) => INDIAN_MOBILE_REGEX.test(sanitizeEmergencyPhone(value));

export const normalizeEmergencyContactSource = (value) =>
  String(value || 'manual').toLowerCase() === 'device' ? 'device' : 'manual';

/**
 * Validates one contact payload. Returns { error } or { contact } — never throws,
 * so callers pick their own error type.
 */
export const validateEmergencyContact = (input) => {
  const { name, phone, source } = input && typeof input === 'object' ? input : {};
  const cleanName = String(name || '').trim().slice(0, 80);
  const cleanPhone = sanitizeEmergencyPhone(phone);

  if (!cleanName) {
    return { error: 'Contact name is required' };
  }

  if (!NAME_REGEX.test(cleanName)) {
    return { error: 'Contact name can contain alphabets only' };
  }

  if (!INDIAN_MOBILE_REGEX.test(cleanPhone)) {
    return { error: 'A valid 10-digit contact number is required' };
  }

  return {
    contact: {
      name: cleanName,
      phone: cleanPhone,
      source: normalizeEmergencyContactSource(source),
    },
  };
};

/**
 * Drops invalid entries, dedupes by phone (first wins) and clamps to `max`.
 */
export const normalizeEmergencyContacts = (list, max = MAX_EMERGENCY_CONTACTS) => {
  const cap = Math.max(0, Number(max) || 0);
  const seen = new Set();
  const normalized = [];

  for (const entry of Array.isArray(list) ? list : []) {
    if (normalized.length >= cap) {
      break;
    }

    const { contact } = validateEmergencyContact(entry);

    if (!contact || seen.has(contact.phone)) {
      continue;
    }

    seen.add(contact.phone);
    normalized.push({ ...contact, id: String(entry?._id || entry?.id || '') });
  }

  return normalized;
};

export const serializeEmergencyContact = (contact = {}) => ({
  id: String(contact._id || contact.id || ''),
  name: String(contact.name || '').trim(),
  phone: sanitizeEmergencyPhone(contact.phone),
  source: normalizeEmergencyContactSource(contact.source),
});
