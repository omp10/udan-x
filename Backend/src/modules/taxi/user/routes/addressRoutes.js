import { Router } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../../../../utils/ApiError.js';
import { asyncHandler } from '../../../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/authMiddleware.js';
import { SavedAddress } from '../models/SavedAddress.js';

export const addressRouter = Router();

addressRouter.use(authenticate(['user']));

const KINDS = new Set(['home', 'work', 'landmark']);
const MAX_LANDMARKS = 50;

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

const toPublic = (doc) => ({
  id: String(doc._id),
  kind: doc.kind,
  label: doc.label || '',
  address: doc.address || '',
  landmark: doc.landmark || '',
  notes: doc.notes || '',
});

const requireObjectId = (value) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new ApiError(400, 'Invalid address id');
  }
  return value;
};

addressRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await SavedAddress.find({ userId: req.auth.sub }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rows.map(toPublic) });
  }),
);

// Upsert. home/work are keyed by (userId, kind); landmarks are created unless `id` is sent.
addressRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const { id, kind, label, address, landmark, notes } = req.body || {};

    if (!KINDS.has(kind)) {
      throw new ApiError(400, 'kind must be one of home, work, landmark');
    }

    const fixedLabel = kind === 'home' ? 'Home' : kind === 'work' ? 'Work' : clean(label, 60);
    const payload = {
      label: fixedLabel,
      address: clean(address, 500),
      landmark: clean(landmark, 200),
      notes: clean(notes, 300),
    };

    if (!payload.address) {
      throw new ApiError(400, 'address is required');
    }
    if (kind === 'landmark' && !payload.label) {
      throw new ApiError(400, 'label is required for a landmark');
    }

    if (kind !== 'landmark') {
      const doc = await SavedAddress.findOneAndUpdate(
        { userId: req.auth.sub, kind },
        { $set: payload },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      return res.json({ success: true, data: toPublic(doc) });
    }

    if (id) {
      const doc = await SavedAddress.findOneAndUpdate(
        { _id: requireObjectId(id), userId: req.auth.sub, kind: 'landmark' },
        { $set: payload },
        { new: true },
      );
      if (!doc) {
        throw new ApiError(404, 'Address not found');
      }
      return res.json({ success: true, data: toPublic(doc) });
    }

    const existing = await SavedAddress.countDocuments({ userId: req.auth.sub, kind: 'landmark' });
    if (existing >= MAX_LANDMARKS) {
      throw new ApiError(409, `You can save up to ${MAX_LANDMARKS} landmarks`);
    }

    const doc = await SavedAddress.create({ userId: req.auth.sub, kind: 'landmark', ...payload });
    return res.status(201).json({ success: true, data: toPublic(doc) });
  }),
);

addressRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await SavedAddress.findOneAndDelete({
      _id: requireObjectId(req.params.id),
      userId: req.auth.sub,
    });
    if (!doc) {
      throw new ApiError(404, 'Address not found');
    }
    res.json({ success: true, data: { id: String(doc._id) } });
  }),
);
