import mongoose from 'mongoose';

const withdrawalRequestSchema = new mongoose.Schema({
  transactionId: String,
  driver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TaxiDriver' },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TaxiOwner' },
  amount: Number,
  payment_method: String,
  bank_details_snapshot: {
    accountHolderName: {
      type: String,
      default: '',
      trim: true,
    },
    upiId: {
      type: String,
      default: '',
      trim: true,
    },
    qrCodeImage: {
      type: String,
      default: '',
      trim: true,
    },
    accountNumber: {
      type: String,
      default: '',
      trim: true,
    },
    ifsc: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
    },
    branchName: {
      type: String,
      default: '',
      trim: true,
    },
    updatedAt: {
      type: Date,
      default: null,
    },
  },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  // Who settled it. Owner payouts move no money at approval time (the amount was
  // already held out of the wallet at request time), so without this the approver
  // of a fleet payout was recorded nowhere.
  actioned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'TaxiAdmin', default: null },
  actioned_at: { type: Date, default: null }
}, { timestamps: true });

export const WithdrawalRequest = mongoose.models.TaxiWithdrawalRequest || mongoose.model('TaxiWithdrawalRequest', withdrawalRequestSchema);
