import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Bell, Trash2, AlertCircle, RefreshCw, Megaphone, CheckCircle2 } from 'lucide-react';
import { userAuthService } from '../services/authService';
import { Badge, Button, Card, EmptyState, Skeleton } from '../components/ui';
import {
  USER_NOTIFICATIONS_UPDATED_EVENT,
  clearRealtimeNotifications,
  getRealtimeNotifications,
  isRealtimeNotification,
  removeRealtimeNotification,
} from '../utils/realtimeNotificationStore';
import toast from 'react-hot-toast';

const MotionDiv = motion.div;

const formatNotificationTime = (value) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const SkeletonCard = () => (
  <Card className="flex items-start gap-3">
    <Skeleton className="h-10 w-10 shrink-0 rounded-control" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-3 w-2/3" />
      <Skeleton lines={2} />
    </div>
  </Card>
);

const Notifications = () => {
  const navigate = useNavigate();
  const [serverNotifications, setServerNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clearing, setClearing] = useState(false);

  const notifications = useMemo(() => {
    const merged = [...serverNotifications, ...getRealtimeNotifications()];

    return merged
      .filter((notification) => notification?.id)
      .sort((left, right) => {
        const leftTime = new Date(left.sentAt || 0).getTime();
        const rightTime = new Date(right.sentAt || 0).getTime();
        return rightTime - leftTime;
      });
  }, [serverNotifications]);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await userAuthService.getNotifications();
      setServerNotifications(response?.data?.results || []);
    } catch (err) {
      setError(err?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  useEffect(() => {
    const handleRealtimeNotificationsUpdated = () => {
      setServerNotifications((current) => [...current]);
    };

    window.addEventListener(USER_NOTIFICATIONS_UPDATED_EVENT, handleRealtimeNotificationsUpdated);

    return () => {
      window.removeEventListener(USER_NOTIFICATIONS_UPDATED_EVENT, handleRealtimeNotificationsUpdated);
    };
  }, []);

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (!window.confirm('Are you sure you want to clear all notifications?')) return;

    setClearing(true);
    try {
      await userAuthService.clearAllNotifications();
      clearRealtimeNotifications();
      setServerNotifications([]);
      toast.success('All notifications cleared', {
        icon: <CheckCircle2 size={18} className="text-emerald-500" />,
      });
    } catch (err) {
      toast.error(err?.message || 'Failed to clear notifications');
    } finally {
      setClearing(false);
    }
  };

  const handleRemoveSingle = async (id) => {
    if (isRealtimeNotification(id)) {
      removeRealtimeNotification(id);
      toast.success('Notification removed');
      return;
    }

    try {
      await userAuthService.deleteNotification(id);
      setServerNotifications((prev) => prev.filter((notification) => notification.id !== id));
      toast.success('Notification removed');
    } catch {
      toast.error('Failed to remove notification');
    }
  };

  const totalCount = notifications.length;

  return (
    <div className="relative min-h-screen max-w-lg mx-auto overflow-hidden bg-surface-page pb-28 font-sans text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-surface px-5 pt-10 pb-4 shadow-soft backdrop-blur-md">
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
          <div className="min-w-0 flex-1">
            <p className="text-3xs font-black uppercase tracking-[0.26em] text-ink-faint">Inbox</p>
            <h1 className="text-[19px] font-black leading-tight tracking-tight text-ink">Notifications</h1>
          </div>
          <Badge tone="brand">{totalCount}</Badge>
        </div>
      </header>

      <div className="space-y-2.5 px-5 pt-4">
        <div className="flex items-center justify-between px-1">
          <p className="text-2xs font-black uppercase tracking-[0.26em] text-ink-faint">Admin &amp; system alerts</p>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                disabled={clearing || loading}
                leftIcon={<Trash2 size={12} strokeWidth={2.5} />}
                className="text-2xs uppercase tracking-widest text-rose-500 hover:text-rose-600"
              >
                Clear all
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchNotifications}
              leftIcon={<RefreshCw size={12} strokeWidth={2.5} className={loading ? 'animate-spin' : ''} />}
              className="text-2xs uppercase tracking-widest"
            >
              Refresh
            </Button>
          </div>
        </div>

        {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}

        {error && !loading && (
          <EmptyState
            icon={AlertCircle}
            title={error}
            description="We could not reach the notification service."
            action={
              <Button
                onClick={fetchNotifications}
                leftIcon={<RefreshCw size={14} strokeWidth={2.5} />}
                className="rounded-pill"
              >
                Retry
              </Button>
            }
          />
        )}

        {!loading && !error && notifications.length === 0 && (
          <EmptyState
            icon={Bell}
            title="You're all caught up"
            description="No new notifications right now"
          />
        )}

        <AnimatePresence>
          {!loading && !error && notifications.map((n) => (
            <MotionDiv
              key={n.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Card className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft">
                  <Megaphone size={16} className="text-brand" strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-black leading-tight text-ink">{n.title || 'Notification'}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="mt-0.5 text-3xs font-bold text-ink-faint">
                        {formatNotificationTime(n.sentAt)}
                      </span>
                      <button
                        type="button"
                        aria-label="Remove notification"
                        onClick={() => handleRemoveSingle(n.id)}
                        className="p-1.5 text-ink-faint transition-colors hover:text-rose-500"
                      >
                        <Trash2 size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[11px] font-bold leading-relaxed text-ink-soft">
                    {n.body || 'No message'}
                  </p>

                  {n.image && (
                    <div className="mt-3 overflow-hidden rounded-card border border-line bg-surface-sunken">
                      <img
                        src={n.image}
                        alt="Notification content"
                        className="h-auto max-h-[180px] w-full object-cover"
                      />
                    </div>
                  )}

                  {n.serviceLocationName && (
                    <p className="mt-2 text-3xs font-black uppercase tracking-widest text-ink-faint">
                      {n.serviceLocationName}
                    </p>
                  )}
                </div>
              </Card>
            </MotionDiv>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Notifications;
