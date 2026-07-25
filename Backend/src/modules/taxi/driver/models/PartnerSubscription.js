import mongoose from 'mongoose';

const partnerSubscriptionSchema = new mongoose.Schema(
  {
    audience: {
      type: String,
      enum: ['driver', 'owner'],
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxiDriver',
      default: null,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxiOwner',
      default: null,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxiSubscriptionPlan',
      required: true,
      index: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    transport_type: {
      type: String,
      default: 'taxi',
      trim: true,
    },
    vehicle_type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxiVehicle',
      default: null,
      index: true,
    },
    billing_cycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', 'custom'],
      default: 'monthly',
    },
    coverage_scope: {
      type: String,
      enum: ['individual', 'vehicle', 'fleet'],
      default: 'individual',
    },
    commission_discount_percent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    priority_booking: {
      type: Boolean,
      default: false,
    },
    featured_listing: {
      type: Boolean,
      default: false,
    },
    premium_support: {
      type: Boolean,
      default: false,
    },
    booking_limit: {
      type: Number,
      default: 0,
      min: 0,
    },
    max_vehicles_covered: {
      type: Number,
      default: 0,
      min: 0,
    },
    recurring_enabled: {
      type: Boolean,
      default: false,
    },
    autoRenew: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'consumed'],
      default: 'active',
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    purchaseSource: {
      type: String,
      enum: ['wallet', 'admin'],
      default: 'wallet',
    },
    purchasedAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    nextBillingAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastRenewedAt: {
      type: Date,
      default: null,
    },
    // Written by services/subscriptionRenewalWorker.js
    renewalCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRenewalError: {
      type: String,
      default: '',
      trim: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

partnerSubscriptionSchema.index({ audience: 1, driverId: 1, status: 1, expiresAt: 1 });
partnerSubscriptionSchema.index({ audience: 1, ownerId: 1, status: 1, expiresAt: 1 });
partnerSubscriptionSchema.index({ audience: 1, active: 1, createdAt: -1 });

export const PartnerSubscription =
  mongoose.models.TaxiPartnerSubscription || mongoose.model('TaxiPartnerSubscription', partnerSubscriptionSchema);
