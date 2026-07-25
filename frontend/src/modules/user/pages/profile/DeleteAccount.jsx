import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, AlertTriangle, X } from 'lucide-react';
import { clearLocalUserSession, userAuthService } from '../../services/authService';
import { clearCurrentRide } from '../../services/currentRideService';
import { socketService } from '../../../../shared/api/socket';
import { Button, Card, Modal } from '../../components/ui';

const MotionDiv = motion.div;

const REASONS = [
  'I use another app',
  'Too expensive',
  'Privacy concerns',
  'Technical issues',
  'Taking a break',
  'Other',
];

const CONSEQUENCES = [
  'An admin will review your deletion request',
  'Your account stays active until the request is approved',
  'After approval, ride history, addresses, and preferences may be removed',
  'Active bookings may be cancelled after approval',
  'Rejected requests keep your account unchanged',
];

const DeleteAccount = () => {
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await userAuthService.requestAccountDeletion(reason);
      clearCurrentRide();
      socketService.disconnect();
      clearLocalUserSession();
      setSuccess('Your account deletion request has been sent to admin for review. Logging you out...');
      setLoading(false);
      setShowConfirm(false);
      navigate('/taxi/user/login', { replace: true });
    } catch (requestError) {
      setError(requestError?.message || 'Something went wrong. Please try again.');
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="relative min-h-screen max-w-lg mx-auto overflow-hidden bg-surface-page pb-12 font-sans text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-surface px-5 pt-10 pb-4 shadow-soft">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Back"
            onClick={() => navigate('/taxi/user/profile')}
            className="h-9 w-9 px-0"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </Button>
          <div className="flex-1">
            <p className="text-3xs font-black uppercase tracking-[0.26em] text-rose-400">Danger zone</p>
            <h1 className="text-[19px] font-black tracking-tight text-rose-500">Delete Account</h1>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-5 pt-4">
        <AnimatePresence>
          {success && (
            <MotionDiv
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-control border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
            >
              <p className="flex-1 text-xs font-black text-emerald-500">{success}</p>
              <button type="button" aria-label="Dismiss" onClick={() => setSuccess(null)}>
                <X size={13} className="text-emerald-500" />
              </button>
            </MotionDiv>
          )}
          {error && (
            <MotionDiv
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-control border border-rose-500/30 bg-rose-500/10 px-4 py-3"
            >
              <AlertTriangle size={14} className="shrink-0 text-rose-500" strokeWidth={2.5} />
              <p className="flex-1 text-xs font-black text-rose-500">{error}</p>
              <button type="button" aria-label="Dismiss" onClick={() => setError(null)}>
                <X size={13} className="text-rose-500" />
              </button>
            </MotionDiv>
          )}
        </AnimatePresence>

        <Card className="border-rose-500/30 bg-rose-500/10 p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-rose-500/20">
              <AlertTriangle size={18} className="text-rose-500" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-sm font-black leading-tight text-rose-500">Delete account</p>
              <p className="text-[11px] font-bold text-rose-400">Admin approval is required</p>
            </div>
          </div>
          <ul className="space-y-2">
            {CONSEQUENCES.map((consequence) => (
              <li key={consequence} className="flex items-start gap-2">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-rose-400" />
                <p className="text-xs font-bold leading-relaxed text-rose-500">{consequence}</p>
              </li>
            ))}
          </ul>
        </Card>

        <div>
          <p className="mb-2 text-2xs font-black uppercase tracking-[0.26em] text-ink-faint">
            Why are you leaving?
          </p>
          <Card padded={false} className="divide-y divide-line overflow-hidden">
            {REASONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setReason(option)}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                  reason === option ? 'bg-rose-500/10' : 'active:bg-surface-sunken'
                }`}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border-2 transition-all ${
                    reason === option ? 'border-rose-500 bg-rose-500' : 'border-line'
                  }`}
                >
                  {reason === option && <div className="h-2 w-2 rounded-pill bg-white" />}
                </div>
                <span className={`text-[13px] font-black ${reason === option ? 'text-rose-500' : 'text-ink-soft'}`}>
                  {option}
                </span>
              </button>
            ))}
          </Card>
        </div>

        <div className="space-y-2.5 pt-2">
          <Button
            block
            size="lg"
            variant="danger"
            disabled={!reason}
            leftIcon={<AlertTriangle size={15} strokeWidth={2.5} />}
            onClick={() => setShowConfirm(true)}
            className="uppercase tracking-widest"
          >
            Delete My Account
          </Button>
          <Button
            block
            size="lg"
            variant="secondary"
            onClick={() => navigate('/taxi/user/profile')}
            className="uppercase tracking-widest"
          >
            Cancel
          </Button>
        </div>
      </div>

      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-card-lg bg-rose-500/12">
          <AlertTriangle size={30} className="text-rose-500" strokeWidth={2.2} />
        </div>
        <h3 className="mb-2 text-lg font-black text-ink">Send deletion request?</h3>
        <p className="mb-1 text-[13px] font-bold leading-relaxed text-ink-soft">
          Admin will review this request before your account is deleted.
        </p>
        <p className="mb-6 text-xs font-bold text-rose-400">Your account remains active until approval.</p>
        <div className="space-y-2.5">
          <Button
            block
            variant="danger"
            loading={loading}
            onClick={handleDelete}
            className="uppercase tracking-widest"
          >
            Yes, Send Request
          </Button>
          <Button
            block
            variant="ghost"
            onClick={() => setShowConfirm(false)}
            className="uppercase tracking-widest"
          >
            No, Keep My Account
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default DeleteAccount;
