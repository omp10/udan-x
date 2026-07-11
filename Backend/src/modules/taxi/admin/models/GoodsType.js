import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const goodsTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: '',
      trim: true,
    },
    goods_type_name: {
      type: String,
      required: true,
      trim: true,
    },
    translation_dataset: {
      type: String,
      default: '',
    },
    goods_types_for: {
      type: String,
      default: 'both',
      trim: true,
    },
    goods_type_vehicle_ids: {
      type: [ObjectId],
      ref: 'TaxiVehicle',
      default: [],
    },
    company_key: {
      type: String,
      default: null,
    },
    external_id: {
      type: Number,
      default: null,
    },
    active: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      default: 'active',
      trim: true,
    },
    goods_type_translation_words: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    icon: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    image: {
      type: String,
      default: '',
      trim: true,
    },
    delivery_category: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    min_weight_kg: {
      type: Number,
      default: 0,
      min: 0,
    },
    max_weight_kg: {
      type: Number,
      default: 0,
      min: 0,
    },
    weight_label: {
      type: String,
      default: '',
      trim: true,
    },
    sort_order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

goodsTypeSchema.pre('save', function syncName() {
  if (!this.name && this.goods_type_name) {
    this.name = this.goods_type_name;
  }
});

goodsTypeSchema.index({ name: 1 });
goodsTypeSchema.index({ goods_types_for: 1, status: 1 });
goodsTypeSchema.index({ active: 1, sort_order: 1, createdAt: -1 });

export const GoodsType = mongoose.models.TaxiGoodsType || mongoose.model('TaxiGoodsType', goodsTypeSchema);
