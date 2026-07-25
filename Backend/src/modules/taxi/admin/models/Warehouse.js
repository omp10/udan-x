import mongoose from 'mongoose';

// Pickup/drop hubs offered during goods booking. Field names match what the
// admin form (admin/pages/goods/WarehouseManagement.jsx) and the customer
// picker (user/pages/parcel/SenderReceiverDetails.jsx) already expect.
const warehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    state: {
      type: String,
      default: '',
      trim: true,
    },
    pincode: {
      type: String,
      default: '',
      trim: true,
    },
    zone: {
      type: String,
      default: '',
      trim: true,
    },
    contact_name: {
      type: String,
      default: '',
      trim: true,
    },
    contact_phone: {
      type: String,
      default: '',
      trim: true,
    },
    // [longitude, latitude] to match the rest of the codebase (utils/geo.js).
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },
    is_pickup: {
      type: Boolean,
      default: true,
    },
    is_drop: {
      type: Boolean,
      default: true,
    },
    capacity_notes: {
      type: String,
      default: '',
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

warehouseSchema.index({ active: 1, is_pickup: 1 });
warehouseSchema.index({ active: 1, is_drop: 1 });
warehouseSchema.index({ location: '2dsphere' }, { sparse: true });

export const Warehouse = mongoose.models.TaxiWarehouse || mongoose.model('TaxiWarehouse', warehouseSchema);
