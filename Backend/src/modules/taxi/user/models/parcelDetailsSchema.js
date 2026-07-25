// Shared parcel/goods sub-document, used by both Ride.parcel and Delivery.parcel
// (Delivery is a denormalized mirror of a serviceType:'parcel' Ride — see
// syncDeliveryWithRide in services/rideService.js). Defined once so the two
// cannot drift apart.
export const parcelDetailsDefinition = {
  category: {
    type: String,
    default: '',
    trim: true,
  },
  // Free-text weight band kept for backwards compatibility with existing rows
  // ("Under 5kg", "Above 500kg", ...). weightKg below is the numeric truth.
  weight: {
    type: String,
    default: '',
    trim: true,
  },
  weightKg: {
    type: Number,
    default: 0,
    min: 0,
  },
  // What the customer actually typed, before normalisation to kg.
  weightUnit: {
    type: String,
    enum: ['kg', 'ton'],
    default: 'kg',
    lowercase: true,
    trim: true,
  },
  materialName: {
    type: String,
    default: '',
    trim: true,
  },
  dimensions: {
    length: { type: Number, default: 0, min: 0 },
    width: { type: Number, default: 0, min: 0 },
    height: { type: Number, default: 0, min: 0 },
    unit: {
      type: String,
      enum: ['cm', 'inch', 'ft'],
      default: 'cm',
      lowercase: true,
      trim: true,
    },
  },
  packageCount: {
    type: Number,
    default: 1,
    min: 1,
  },
  isFragile: {
    type: Boolean,
    default: false,
  },
  handlingInstructions: {
    type: String,
    default: '',
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  deliveryCategory: {
    type: String,
    default: '',
    trim: true,
  },
  goodsTypeFor: {
    type: String,
    default: '',
    trim: true,
  },
  deliveryScope: {
    type: String,
    enum: ['city', 'outstation'],
    default: 'city',
    lowercase: true,
    trim: true,
  },
  isOutstation: {
    type: Boolean,
    default: false,
  },
  // Loading/unloading labour. Charges are resolved server-side from the Helper
  // collection at booking time (goodsLogisticsService.resolveHelperCharge), never
  // taken from the client.
  helper: {
    type: {
      type: String,
      enum: ['none', 'loading', 'unloading', 'both'],
      default: 'none',
      lowercase: true,
      trim: true,
    },
    loadingCharge: { type: Number, default: 0, min: 0 },
    unloadingCharge: { type: Number, default: 0, min: 0 },
    totalCharge: { type: Number, default: 0, min: 0 },
  },
  warehouse: {
    pickupId: { type: String, default: '' },
    dropId: { type: String, default: '' },
  },
  senderName: {
    type: String,
    default: '',
    trim: true,
  },
  senderMobile: {
    type: String,
    default: '',
    trim: true,
  },
  receiverName: {
    type: String,
    default: '',
    trim: true,
  },
  receiverMobile: {
    type: String,
    default: '',
    trim: true,
  },
  // Proof of delivery. deliveryOtp is separate from Ride.otp (which gates trip
  // start) and is verified against the receiver when the parcel is handed over.
  deliveryOtp: {
    type: String,
    default: '',
    trim: true,
  },
  proofOfDelivery: {
    photoUrl: { type: String, default: '', trim: true },
    signatureUrl: { type: String, default: '', trim: true },
    receivedBy: { type: String, default: '', trim: true },
    deliveredAt: { type: Date, default: null },
  },
};
