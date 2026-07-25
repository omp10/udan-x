import mongoose from 'mongoose';

// Loading/unloading labour a customer can add to a goods booking. Field names
// match the admin form (admin/pages/goods/HelperManagement.jsx) and the customer
// helper picker (user/pages/parcel/SenderReceiverDetails.jsx).
const helperSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    helper_type: {
      type: String,
      enum: ['loading', 'unloading', 'both'],
      default: 'both',
      lowercase: true,
      trim: true,
    },
    loading_charge: {
      type: Number,
      default: 0,
      min: 0,
    },
    unloading_charge: {
      type: Number,
      default: 0,
      min: 0,
    },
    available: {
      type: Boolean,
      default: true,
    },
    // Credited when a booking that included this helper completes.
    total_earnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_jobs: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

helperSchema.index({ available: 1, helper_type: 1 });

export const Helper = mongoose.models.TaxiHelper || mongoose.model('TaxiHelper', helperSchema);
