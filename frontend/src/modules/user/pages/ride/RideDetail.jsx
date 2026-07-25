import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Bike, HelpCircle, Repeat, Share2, Star } from 'lucide-react';
import api from '../../../../shared/api/axiosInstance';
import { useSettings } from '../../../../shared/context/SettingsContext';
import { Button, Card, Skeleton } from '../../components/ui';

const MotionDiv = motion.div;

const unwrap = (response) => response?.data || response;

const formatLongDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Trip details';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const pickFirstString = (...values) => {
  for (const value of values) {
    const normalized = String(value || '').trim();

    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const coordLabel = (location, fallback) => {
  const [lng, lat] = location?.coordinates || [];
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
  }

  return fallback;
};

const RideDetail = () => {
  const { settings } = useSettings();
  const appName = settings.general?.app_name || 'App';
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [shareToast, setShareToast] = useState(false);
  const [ride, setRide] = useState(location.state?.ride || null);
  const [loading, setLoading] = useState(!location.state?.ride);
  const [error, setError] = useState('');
  const routePrefix = location.pathname.startsWith('/taxi/user') ? '/taxi/user' : '';

  useEffect(() => {
    if (ride || !id) return undefined;

    let active = true;

    const loadRide = async () => {
      try {
        const response = await api.get(`/rides/${id}`);
        const payload = unwrap(response);
        if (active) setRide(payload);
      } catch (loadError) {
        if (active) setError(loadError?.message || 'Could not load trip details.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadRide();

    return () => {
      active = false;
    };
  }, [id, ride]);

  const details = useMemo(() => {
    const driver = ride?.driver || ride?.driverId || {};
    const timeSource = ride?.completedAt || ride?.startedAt || ride?.acceptedAt || ride?.createdAt || ride?.updatedAt;
    const fare = Number(ride?.fare || 0);
    const taxes = Math.max(Math.round(fare * 0.18), 0);
    const status = String(ride?.status || ride?.liveStatus || 'trip').toLowerCase();
    const rideCode = String(ride?.rideId || ride?._id || ride?.id || id || 'ride');

    return {
      pickup: pickFirstString(
        ride?.pickupAddress,
        ride?.pickup?.address,
        ride?.pickup?.name,
      ) || coordLabel(ride?.pickupLocation || ride?.pickup, 'Pickup location'),
      drop: pickFirstString(
        ride?.dropAddress,
        ride?.drop?.address,
        ride?.drop?.name,
        ride?.destinationAddress,
      ) || coordLabel(ride?.dropLocation || ride?.drop, 'Drop location'),
      fare,
      taxes,
      baseFare: Math.max(fare - taxes, 0),
      timeSource,
      startTime: ride?.startedAt || ride?.acceptedAt || timeSource,
      endTime: ride?.completedAt || timeSource,
      statusLabel: status.charAt(0).toUpperCase() + status.slice(1),
      driverName: driver.name || 'Captain',
      rating: driver.rating || '4.9',
      plate: driver.vehicleNumber || 'Assigned',
      vehicle: driver.vehicleType || ride?.vehicleIconType || 'Taxi',
      paymentMethod: String(
        ride?.paymentMethod ||
        ride?.payment_method ||
        ride?.paymentType ||
        ride?.payment_type ||
        'cash',
      ).trim().toLowerCase() === 'cash' ? 'Cash' : 'Online',
      rideCode,
      shortRideCode: rideCode.length > 14 ? `${rideCode.slice(0, 6)}...${rideCode.slice(-4)}` : rideCode,
    };
  }, [ride]);

  const handleShare = async () => {
    const text = `My ${appName} trip #${details.shortRideCode} - ${details.pickup} to ${details.drop} | Rs ${details.fare}.00`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${appName} Trip`,
          text,
          url: window.location.href,
        });
        return;
      } catch {
        return;
      }
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard?.writeText(text).then(() => {
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2500);
      });
    }
  };

  return (
    <div className="relative flex min-h-screen max-w-lg mx-auto flex-col bg-surface-page font-sans text-ink">
      <AnimatePresence>
        {shareToast && (
          <MotionDiv
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-card bg-brand px-5 py-3 text-sm font-black text-white shadow-premium"
          >
            Trip details copied
          </MotionDiv>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-20 flex items-start justify-between gap-3 border-b border-line bg-surface p-5 shadow-soft">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Back"
            onClick={() => navigate(-1)}
            className="h-9 w-9 shrink-0 px-0"
          >
            <ArrowLeft size={18} strokeWidth={2.6} />
          </Button>
          <div className="min-w-0">
            <h1
              className="truncate text-[17px] font-black leading-none text-ink"
              title={`Trip ID: #${details.rideCode}`}
            >
              Trip ID: #{details.shortRideCode}
            </h1>
            <p className="mt-1 truncate text-2xs font-bold uppercase tracking-widest text-ink-faint">
              {details.statusLabel}: {formatLongDate(details.timeSource)}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" aria-label="Share trip" onClick={handleShare} className="shrink-0 px-2">
          <Share2 size={18} />
        </Button>
      </header>

      <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto p-5">
        {loading && <Skeleton className="h-20 rounded-card-lg" />}

        {error && (
          <Card className="border-rose-500/30 bg-rose-500/10 text-center">
            <p className="text-[13px] font-black text-rose-500">{error}</p>
          </Card>
        )}

        <div className="relative h-40 overflow-hidden rounded-card-lg border border-line bg-surface-sunken">
          <img src="/map image.avif" className="h-full w-full object-cover opacity-60" alt="Map View" />
        </div>

        <div className="relative space-y-6 pl-8">
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 border-l-2 border-dashed border-line" />

          <div className="relative">
            <div className="absolute -left-9 top-0.5 flex h-4 w-4 items-center justify-center rounded-pill border-2 border-emerald-500 bg-surface">
              <div className="h-1.5 w-1.5 rounded-pill bg-emerald-500" />
            </div>
            <h4 className="mb-1 text-2xs font-black uppercase tracking-widest text-ink-faint">Pickup</h4>
            <p className="text-[15px] font-black leading-tight text-ink">{details.pickup}</p>
            <span className="mt-1 block text-[11px] font-bold text-ink-faint">{formatTime(details.startTime)}</span>
          </div>

          <div className="relative">
            <div className="absolute -left-9 top-0.5 flex h-4 w-4 items-center justify-center rounded-pill border-2 border-brand bg-surface">
              <div className="h-1.5 w-1.5 rounded-pill bg-brand" />
            </div>
            <h4 className="mb-1 text-2xs font-black uppercase tracking-widest text-ink-faint">Drop</h4>
            <p className="text-[15px] font-black leading-tight text-ink">{details.drop}</p>
            <span className="mt-1 block text-[11px] font-bold text-ink-faint">{formatTime(details.endTime)}</span>
          </div>
        </div>

        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-control bg-surface-sunken text-ink">
              <Bike size={20} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-black text-ink">{details.vehicle} Ride</h3>
              <p className="text-2xs font-bold uppercase tracking-widest text-ink-faint">
                Payment by {details.paymentMethod}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-[13px] font-bold text-ink-soft">
              <span>Base Fare</span>
              <span className="text-ink">Rs {details.baseFare}.00</span>
            </div>
            <div className="flex items-center justify-between text-[13px] font-bold text-ink-soft">
              <span>Taxes &amp; Fees</span>
              <span className="text-ink">Rs {details.taxes}.00</span>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-3 text-base font-black text-ink">
              <span>Total Paid</span>
              <span>Rs {details.fare}.00</span>
            </div>
          </div>
        </Card>

        <Card className="flex items-center justify-between gap-3 p-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-card border border-line bg-surface-sunken p-0.5">
              <img
                src={`https://ui-avatars.com/api/?name=${String(details.driverName).replace(' ', '+')}&background=f0f0f0&color=000`}
                className="h-full w-full rounded-[12px]"
                alt={details.driverName}
              />
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-sm font-black text-ink">{details.driverName}</h4>
              <div className="mt-0.5 flex items-center gap-1">
                <Star size={12} className="fill-brand text-brand" />
                <span className="text-[11px] font-black text-brand">
                  {details.rating} - {details.plate}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0 rounded-pill"
            onClick={() => navigate(routePrefix ? `${routePrefix}/support` : '/ride/support')}
          >
            Support
          </Button>
        </Card>
      </div>

      <div className="flex gap-3 border-t border-line bg-surface p-5 pb-8">
        <Button
          size="lg"
          className="flex-[2] uppercase tracking-widest"
          leftIcon={<Repeat size={18} />}
          onClick={() => {
            const vehicleTypeStr = String(
              ride?.vehicleIconType || ride?.vehicle?.icon_types || ride?.driver?.vehicleType || '',
            ).toLowerCase();
            const rebookCategory = vehicleTypeStr.includes('bike') || vehicleTypeStr.includes('scooty')
              ? 'bike'
              : vehicleTypeStr.includes('auto')
                ? 'auto'
                : 'car';

            navigate(`${routePrefix}/ride/select-location`, {
              state: {
                pickup: details.pickup,
                drop: details.drop,
                pickupCoords: ride?.pickupLocation?.coordinates || ride?.pickup?.coordinates || null,
                dropCoords: ride?.dropLocation?.coordinates || ride?.drop?.coordinates || null,
                selectedCategory: rebookCategory,
              },
            });
          }}
        >
          Rebook Ride
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="flex-1 uppercase tracking-widest"
          leftIcon={<HelpCircle size={18} />}
          onClick={() => navigate(routePrefix ? `${routePrefix}/support` : '/ride/support')}
        >
          Help
        </Button>
      </div>
    </div>
  );
};

export default RideDetail;
