import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, Crown, Loader2, RefreshCw, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import DriverBottomNav from '../../shared/components/DriverBottomNav';
import {
  getCurrentDriver,
  getMyPartnerSubscriptionPlans,
  getMyPartnerSubscriptions,
  purchaseMyPartnerSubscription,
} from '../services/registrationService';

const unwrap = (payload) => payload?.data?.data || payload?.data || payload || {};
const toArray = (value) => (Array.isArray(value) ? value : []);
const money = (value) => `Rs ${Number(value || 0).toFixed(2)}`;

const TIER_BADGE_CLASS = {
  basic: 'bg-slate-100 text-slate-700',
  standard: 'bg-blue-50 text-blue-700',
  business: 'bg-purple-50 text-purple-700',
  premium: 'bg-yellow-100 text-yellow-800',
};

const TierBadge = ({ tier }) => {
  const key = String(tier || 'basic').toLowerCase();
  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
        TIER_BADGE_CLASS[key] || TIER_BADGE_CLASS.basic
      }`}
    >
      {key}
    </span>
  );
};

const benefitBadges = (plan = {}) => {
  const items = [];
  if (Number(plan.commission_discount_percent || 0) > 0) {
    items.push(`${Number(plan.commission_discount_percent || 0)}% lower commission`);
  }
  if (plan.priority_booking) items.push('Priority booking');
  if (plan.featured_listing) items.push('Featured profile');
  if (plan.premium_support) items.push('Premium support');
  if (Number(plan.booking_limit || 0) > 0) items.push(`${plan.booking_limit} booking limit`);
  if (Number(plan.max_vehicles_covered || 0) > 0) items.push(`${plan.max_vehicles_covered} vehicles covered`);
  return items;
};

const Subscriptions = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState('');
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState({
    activeCount: 0,
    autoRenewCount: 0,
    expiresSoonCount: 0,
    premiumSupportCount: 0,
    activePlans: [],
    history: [],
    mode: 'commissionOnly',
  });
  const [walletBalance, setWalletBalance] = useState(0);
  const [role, setRole] = useState('driver');

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansResponse, summaryResponse, profileResponse] = await Promise.all([
        getMyPartnerSubscriptionPlans(),
        getMyPartnerSubscriptions(),
        getCurrentDriver(),
      ]);

      const nextPlans = unwrap(plansResponse);
      const nextSummary = unwrap(summaryResponse);
      const profile = unwrap(profileResponse);
      const nextRole = String(profile?.onboarding?.role || localStorage.getItem('role') || 'driver').toLowerCase() === 'owner'
        ? 'owner'
        : 'driver';

      setRole(nextRole);
      setPlans(toArray(nextPlans?.results));
      setSummary({
        activeCount: Number(nextSummary?.activeCount || 0),
        autoRenewCount: Number(nextSummary?.autoRenewCount || 0),
        expiresSoonCount: Number(nextSummary?.expiresSoonCount || 0),
        premiumSupportCount: Number(nextSummary?.premiumSupportCount || 0),
        activePlans: toArray(nextSummary?.activePlans),
        history: toArray(nextSummary?.history),
        mode: String(nextSummary?.mode || 'commissionOnly'),
      });
      setWalletBalance(Number(profile?.wallet?.balance || profile?.walletBalance || 0));
    } catch (error) {
      toast.error(error?.message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const routePrefix = role === 'owner' ? '/taxi/owner' : '/taxi/driver';
  const title = role === 'owner' ? 'Fleet Subscription' : 'Driver Subscription';
  const activeCoverage = useMemo(
    () => new Set(toArray(summary.activePlans).map((item) => String(item.id || item.planId || ''))),
    [summary.activePlans],
  );

  const handleBuy = async (planId, autoRenew) => {
    try {
      setBuyingId(planId);
      const response = await purchaseMyPartnerSubscription({ planId, autoRenew });
      toast.success(response?.message || 'Subscription purchased');
      await loadData();
    } catch (error) {
      toast.error(error?.message || 'Unable to purchase subscription');
    } finally {
      setBuyingId('');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <div className="mx-auto max-w-4xl px-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(`${routePrefix}/profile`)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <div className="mt-5 rounded-[30px] bg-slate-950 px-6 py-6 text-white shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/55">{role === 'owner' ? 'Fleet growth' : 'Driver growth'}</p>
              <h1 className="mt-2 text-[28px] font-black">{title}</h1>
              <p className="mt-2 max-w-xl text-sm font-medium text-slate-300">
                Buy a plan to unlock lower commission, better visibility, and premium support without leaving the app.
              </p>
            </div>
            <div className="rounded-3xl bg-white/10 p-4">
              <Crown size={28} className="text-amber-300" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/55">Wallet</p>
              <p className="mt-2 text-lg font-black">{money(walletBalance)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/55">Active Plans</p>
              <p className="mt-2 text-lg font-black">{summary.activeCount}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/55">Auto Renew</p>
              <p className="mt-2 text-lg font-black">{summary.autoRenewCount}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/55">Premium Support</p>
              <p className="mt-2 text-lg font-black">{summary.premiumSupportCount}</p>
            </div>
          </div>
        </div>

        {summary.mode === 'commissionOnly' ? (
          <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold text-amber-800">
            Admin has currently set the business model to commission only. Plans are visible, but purchase is disabled until subscriptions are enabled.
          </div>
        ) : null}

        <div className="mt-6 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <BadgeCheck className="text-emerald-600" size={20} />
            <div>
              <h2 className="text-lg font-black text-slate-950">Your active coverage</h2>
              <p className="text-sm font-medium text-slate-500">Everything currently protecting your account and visibility.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {summary.activePlans.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500">
                No active plan yet.
              </div>
            ) : (
              summary.activePlans.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-100 px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-900">{item.name}</p>
                        <TierBadge tier={item.tier} />
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Ends {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : 'later'} • {item.coverage_scope}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {benefitBadges(item).slice(0, 3).map((badge) => (
                        <span key={badge} className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {plans.map((plan) => {
            const isBuying = buyingId === plan.id;
            const isActive = activeCoverage.has(String(plan.id || ''));
            const canBuy = summary.mode !== 'commissionOnly' && walletBalance >= Number(plan.amount || 0);

            return (
              <div key={plan.id} className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black text-slate-950">{plan.name}</h3>
                      <TierBadge tier={plan.tier} />
                      {isActive ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                          Active
                        </span>
                      ) : null}
                      {plan.recurring_enabled ? (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-700">
                          Recurring
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      {plan.description || plan.how_it_works || 'Subscription benefits for your account.'}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {plan.billing_cycle}
                      </span>
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                        {plan.duration} days
                      </span>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                        {plan.coverage_scope}
                      </span>
                      {plan.vehicle_type?.name ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          {plan.vehicle_type.name}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {benefitBadges(plan).map((badge) => (
                        <span key={badge} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-black text-slate-700">
                          <Sparkles size={12} />
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="md:min-w-[200px] md:text-right">
                    <p className="text-3xl font-black text-slate-950">{money(plan.amount)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {plan.auto_renew_default ? 'Auto renew suggested' : 'Manual renewal'}
                    </p>

                    <button
                      type="button"
                      disabled={isBuying || !canBuy}
                      onClick={() => handleBuy(plan.id, plan.auto_renew_default)}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBuying ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                      Buy with wallet
                    </button>

                    {!canBuy ? (
                      <p className="mt-2 text-xs font-bold text-rose-500">
                        {summary.mode === 'commissionOnly' ? 'Subscriptions are disabled by admin.' : 'Not enough wallet balance.'}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {summary.history.length > 0 ? (
          <div className="mt-6 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-slate-900" size={18} />
              <h2 className="text-lg font-black text-slate-950">History</h2>
            </div>

            <div className="mt-4 space-y-3">
              {summary.history.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {item.expiresAt ? `Ends ${new Date(item.expiresAt).toLocaleDateString()}` : 'No expiry'}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${item.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <DriverBottomNav />
    </div>
  );
};

export default Subscriptions;
