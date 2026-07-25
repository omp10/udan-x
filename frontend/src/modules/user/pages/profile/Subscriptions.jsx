import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, PackageCheck, Ticket, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { userAuthService } from '../../services/authService';
import { Badge, Button, Card, EmptyState, Skeleton } from '../../components/ui';

const safeArray = (value) => (Array.isArray(value) ? value : []);

const unwrapResults = (payload) =>
  safeArray(payload?.data?.results || payload?.results || payload?.data);

const formatCurrency = (value) => `₹${Number(value || 0).toFixed(2)}`;

const StatTile = ({ label, value }) => (
  <Card className="flex-1 px-4 py-3.5">
    <p className="text-3xs font-black uppercase tracking-[0.2em] text-ink-faint">{label}</p>
    <p className="mt-1.5 text-lg font-black tracking-tight text-ink">{value}</p>
  </Card>
);

const Subscriptions = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState('');
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState({
    activeCount: 0,
    availableRideCredits: 0,
    hasUnlimitedPlan: false,
    activePlans: [],
    history: [],
  });
  const [walletBalance, setWalletBalance] = useState(0);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansResponse, subscriptionsResponse, walletResponse] = await Promise.all([
        userAuthService.getSubscriptionPlans(),
        userAuthService.getMySubscriptions(),
        userAuthService.getWallet(),
      ]);

      setPlans(unwrapResults(plansResponse));
      setSummary({
        activeCount: Number(subscriptionsResponse?.data?.activeCount || 0),
        availableRideCredits: Number(subscriptionsResponse?.data?.availableRideCredits || 0),
        hasUnlimitedPlan: Boolean(subscriptionsResponse?.data?.hasUnlimitedPlan),
        activePlans: safeArray(subscriptionsResponse?.data?.activePlans),
        history: safeArray(subscriptionsResponse?.data?.history),
      });
      setWalletBalance(Number(walletResponse?.data?.balance || 0));
    } catch (error) {
      toast.error(error?.message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeVehicleIds = useMemo(
    () => new Set(safeArray(summary.activePlans).map((item) => String(item.vehicle_type_id || '')).filter(Boolean)),
    [summary.activePlans],
  );

  const handleBuy = async (planId) => {
    try {
      setBuyingId(planId);
      const response = await userAuthService.buySubscription(planId);
      toast.success(response?.message || 'Subscription purchased');
      await loadData();
    } catch (error) {
      toast.error(error?.message || 'Unable to purchase subscription');
    } finally {
      setBuyingId('');
    }
  };

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-surface-page pb-28 font-sans">
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
          <div className="min-w-0">
            <p className="text-3xs font-black uppercase tracking-[0.26em] text-ink-faint">Ride passes</p>
            <h1 className="text-[19px] font-black leading-tight tracking-tight text-ink">Subscriptions</h1>
          </div>
        </div>
      </header>

      <div className="space-y-5 px-5 pt-5">
        {loading ? (
          <>
            <div className="flex gap-3">
              <Skeleton className="h-[74px] flex-1 rounded-card-lg" />
              <Skeleton className="h-[74px] flex-1 rounded-card-lg" />
              <Skeleton className="h-[74px] flex-1 rounded-card-lg" />
            </div>
            <Skeleton className="h-32 rounded-card-lg" />
            <Skeleton className="h-44 rounded-card-lg" />
            <Skeleton className="h-44 rounded-card-lg" />
          </>
        ) : (
          <>
            <div className="flex gap-3">
              <StatTile label="Wallet" value={formatCurrency(walletBalance)} />
              <StatTile label="Active" value={summary.activeCount} />
              <StatTile
                label="Credits"
                value={summary.hasUnlimitedPlan ? '∞' : summary.availableRideCredits}
              />
            </div>

            <Card className="p-5">
              <div className="flex items-center gap-2.5">
                <PackageCheck size={18} className="text-brand" strokeWidth={2.6} />
                <h2 className="text-sm font-black tracking-tight text-ink">Your active coverage</h2>
              </div>

              {summary.activePlans.length === 0 ? (
                <p className="mt-3 text-xs font-bold leading-relaxed text-ink-faint">
                  No active subscription yet. Buy one below to start using included rides.
                </p>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {summary.activePlans.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-card bg-surface-sunken px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black text-ink">{item.name}</p>
                        <p className="mt-0.5 truncate text-2xs font-bold text-ink-faint">
                          {item.vehicle_type?.name || 'Vehicle plan'}
                        </p>
                      </div>
                      <Badge tone="success" className="shrink-0">
                        {item.isUnlimited ? 'Unlimited' : `${item.rides_remaining} left`}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div>
              <p className="mb-3 ml-1 text-2xs font-black uppercase tracking-[0.26em] text-ink-faint">
                Available plans
              </p>

              {plans.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title="No plans available"
                  description="Subscription plans will show up here once published."
                />
              ) : (
                <div className="space-y-3">
                  {plans.map((plan) => {
                    const hasSameVehicleActivePlan = activeVehicleIds.has(String(plan.vehicle_type_id || ''));
                    const notEnoughBalance = walletBalance < Number(plan.amount || 0);

                    return (
                      <Card key={plan.id} className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-[15px] font-black leading-tight tracking-tight text-ink">
                              {plan.name}
                            </h3>
                            <p className="mt-1 text-xs font-bold leading-relaxed text-ink-soft">
                              {plan.description || plan.how_it_works || 'Subscription ride plan'}
                            </p>
                          </div>
                          <p className="shrink-0 text-xl font-black tracking-tight text-ink">
                            {formatCurrency(plan.amount)}
                          </p>
                        </div>

                        <div className="mt-3.5 flex flex-wrap gap-1.5">
                          <Badge>{plan.vehicle_type?.name || 'Vehicle category'}</Badge>
                          <Badge tone="brand">{plan.duration} days</Badge>
                          <Badge tone="warning">
                            {plan.benefit_type === 'unlimited'
                              ? 'Unlimited rides'
                              : `${plan.ride_limit} rides`}
                          </Badge>
                          {hasSameVehicleActivePlan && <Badge tone="success">Already active</Badge>}
                        </div>

                        <Button
                          block
                          className="mt-4"
                          loading={buyingId === plan.id}
                          disabled={notEnoughBalance}
                          leftIcon={<Wallet size={16} strokeWidth={2.5} />}
                          onClick={() => handleBuy(plan.id)}
                        >
                          Buy with wallet
                        </Button>

                        {notEnoughBalance && (
                          <p className="mt-2 text-center text-2xs font-bold text-rose-500">
                            Not enough wallet balance for this plan.
                          </p>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {summary.history.length > 0 && (
              <div>
                <p className="mb-3 ml-1 text-2xs font-black uppercase tracking-[0.26em] text-ink-faint">
                  History
                </p>
                <Card padded={false} className="divide-y divide-line">
                  {summary.history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black text-ink">{item.name}</p>
                        <p className="mt-0.5 truncate text-2xs font-bold text-ink-faint">
                          {item.vehicle_type?.name || 'Vehicle plan'} •{' '}
                          {item.isUnlimited ? 'Unlimited' : `${item.rides_used}/${item.ride_limit} used`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.status === 'active' ? (
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          ) : (
                            <AlertCircle size={14} className="text-amber-500" />
                          )}
                          <span className="text-2xs font-black uppercase tracking-wider text-ink-soft">
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-1 text-3xs font-bold text-ink-faint">
                          {item.expiresAt
                            ? `Ends ${new Date(item.expiresAt).toLocaleDateString()}`
                            : 'No expiry'}
                        </p>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Subscriptions;
