import mongoose from 'mongoose';

const savedAddressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxiUser',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ['home', 'work', 'landmark'],
      default: 'landmark',
    },
    label: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    landmark: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true },
);

// A user has at most one home and one work; landmarks are unlimited.
savedAddressSchema.index(
  { userId: 1, kind: 1 },
  { unique: true, partialFilterExpression: { kind: { $in: ['home', 'work'] } } },
);

export const SavedAddress =
  mongoose.models.TaxiUserSavedAddress || mongoose.model('TaxiUserSavedAddress', savedAddressSchema);
