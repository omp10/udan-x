// Run: node --test Backend/src/modules/taxi/common/utils/emergencyContacts.test.js
//
// These helpers decide who receives an SOS SMS. A phone that slips through
// malformed is a person who never gets the alert, so the validation, the
// max-count clamp and the dedupe are pinned here.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_EMERGENCY_CONTACTS,
  isValidEmergencyPhone,
  normalizeEmergencyContacts,
  sanitizeEmergencyPhone,
  validateEmergencyContact,
} from './emergencyContacts.js';

test('phone sanitisation strips formatting and country codes', () => {
  assert.equal(sanitizeEmergencyPhone('+91 98765-43210'), '9876543210');
  assert.equal(sanitizeEmergencyPhone('919876543210'), '9876543210');
  assert.equal(sanitizeEmergencyPhone(null), '');
});

test('only 10-digit Indian mobiles validate', () => {
  assert.equal(isValidEmergencyPhone('9876543210'), true);
  assert.equal(isValidEmergencyPhone('+91 9876543210'), true);
  assert.equal(isValidEmergencyPhone('1234567890'), false); // leading digit < 6
  assert.equal(isValidEmergencyPhone('98765'), false);
  assert.equal(isValidEmergencyPhone('abcdefghij'), false);
});

test('validateEmergencyContact rejects bad names and phones without throwing', () => {
  assert.match(validateEmergencyContact({ name: '', phone: '9876543210' }).error, /name is required/i);
  assert.match(validateEmergencyContact({ name: 'Rahul99', phone: '9876543210' }).error, /alphabets only/i);
  assert.match(validateEmergencyContact({ name: 'Rahul', phone: '123' }).error, /10-digit/);

  const { contact, error } = validateEmergencyContact({ name: '  Priya Sharma ', phone: '+91-91234-56789' });
  assert.equal(error, undefined);
  assert.deepEqual(contact, { name: 'Priya Sharma', phone: '9123456789', source: 'manual' });
});

test('source is clamped to the allowed enum', () => {
  assert.equal(validateEmergencyContact({ name: 'Asha', phone: '9876543210', source: 'DEVICE' }).contact.source, 'device');
  assert.equal(validateEmergencyContact({ name: 'Asha', phone: '9876543210', source: 'hacked' }).contact.source, 'manual');
});

test('normalizeEmergencyContacts drops invalid entries and dedupes by phone', () => {
  const normalized = normalizeEmergencyContacts([
    { name: 'Rahul Verma', phone: '9876543210' },
    { name: 'Rahul Dup', phone: '+91 9876543210' }, // same number, different formatting
    { name: 'Bad Number', phone: '123' },
    { name: '', phone: '9123456789' },
    { name: 'Priya', phone: '9123456789' },
  ]);

  assert.deepEqual(
    normalized.map((contact) => contact.phone),
    ['9876543210', '9123456789'],
  );
  assert.equal(normalized[0].name, 'Rahul Verma');
});

test('normalizeEmergencyContacts clamps to the max count', () => {
  const many = Array.from({ length: 12 }, (_, index) => ({
    name: 'Contact',
    phone: `98765432${String(index).padStart(2, '0')}`,
  }));

  assert.equal(normalizeEmergencyContacts(many).length, MAX_EMERGENCY_CONTACTS);
  assert.equal(normalizeEmergencyContacts(many, 2).length, 2);
  assert.equal(normalizeEmergencyContacts(many, 0).length, 0);
});

test('normalizeEmergencyContacts survives garbage input', () => {
  assert.deepEqual(normalizeEmergencyContacts(null), []);
  assert.deepEqual(normalizeEmergencyContacts('nope'), []);
  assert.deepEqual(normalizeEmergencyContacts([null, undefined, 42]), []);
});
