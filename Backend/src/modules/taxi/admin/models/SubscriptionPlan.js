import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema({
  audience: {
    type: String,
    enum: ['driver', 'user', 'owner'],
    default: 'driver',
    index: true,
  },
  // SOW membership tiers. Drives what the plan is marketed as; the actual
  // entitlements still live in the benefit fields below.
  tier: {
    type: String,
    enum: ['basic', 'standard', 'business', 'premium'],
    default: 'basic',
    index: true,
  },
  name: String,
  description: String,
  amount: Number,
  duration: Number, // in days
  transport_type: String,
  vehicle_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TaxiVehicle' },
  benefit_type: {
    type: String,
    enum: ['standard', 'limited', 'unlimited'],
    default: 'standard',
  },
  ride_limit: {
    type: Number,
    default: 0,
    min: 0,
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
  recurring_enabled: {
    type: Boolean,
    default: false,
  },
  auto_renew_default: {
    type: Boolean,
    default: false,
  },
  renewal_reminder_days: {
    type: Number,
    default: 5,
    min: 0,
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
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  how_it_works: String,
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const SubscriptionPlan = mongoose.models.TaxiSubscriptionPlan || mongoose.model('TaxiSubscriptionPlan', subscriptionPlanSchema);
