import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  ChevronRight,
  Crown,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
  IndianRupee,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

const money = (v) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

const MetricCard = ({ label, value, sub, icon: Icon, color = 'yellow', trend }) => {
  const colors = {
    yellow: { wrap: 'border-yellow-200 bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600', val: 'text-yellow-700' },
    blue: { wrap: 'border-blue-200 bg-blue-50', icon: 'bg-blue-100 text-blue-600', val: 'text-blue-700' },
    emerald: { wrap: 'border-emerald-200 bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-700' },
    red: { wrap: 'border-red-200 bg-red-50', icon: 'bg-red-100 text-red-600', val: 'text-red-700' },
    purple: { wrap: 'border-purple-200 bg-purple-50', icon: 'bg-purple-100 text-purple-600', val: 'text-purple-700' },
  };
  const c = colors[color];
  return (
    <div className={`rounded-2xl border p-5 ${c.wrap}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${c.icon}`}>
          <Icon size={17} strokeWidth={2} />
        </div>
      </div>
      <p className={`mt-3 text-2xl font-black ${c.val}`}>{value}</p>
      {sub && <p className="mt-1 text-xs font-semibold text-slate-400">{sub}</p>}
      {trend !== undefined && (
        <p className={`mt-1.5 text-xs font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last period
        </p>
      )}
    </div>
  );
};

const ProgressBar = ({ value, max, color = 'bg-yellow-400' }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`absolute left-0 top-0 h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const SubscriptionAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [expiringPlans, setExpiringPlans] = useState([]);
  const [recentSubscriptions, setRecentSubscriptions] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, expiringRes, recentRes] = await Promise.all([
        adminService.getPartnerSubscriptionAnalytics(),
        adminService.getExpiringSubscriptions(),
        adminService.getRecentSubscriptions(),
      ]);

      setAnalytics(analyticsRes?.data || null);
      setExpiringPlans(
        Array.isArray(expiringRes?.data?.results)
          ? expiringRes.data.results
          : Array.isArray(expiringRes?.data)
            ? expiringRes.data
            : [],
      );
      setRecentSubscriptions(
        Array.isArray(recentRes?.data?.results)
          ? recentRes.data.results
          : Array.isArray(recentRes?.data)
            ? recentRes.data
            : [],
      );
    } catch (err) {
      toast.error('Failed to load subscription analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  const totalActive =
    (analytics?.byAudience?.user?.activeCount || 0) +
    (analytics?.byAudience?.driver?.activeCount || 0) +
    (analytics?.byAudience?.fleet_owner?.activeCount || 0);

  const totalRevenue =
    (analytics?.byAudience?.user?.revenue || 0) +
    (analytics?.byAudience?.driver?.revenue || 0) +
    (analytics?.byAudience?.fleet_owner?.revenue || 0);

  const audienceBreakdown = [
    {
      id: 'driver',
      label: 'Driver Plans',
      active: analytics?.byAudience?.driver?.activeCount || 0,
      revenue: analytics?.byAudience?.driver?.revenue || 0,
      total: analytics?.byAudience?.driver?.planCount || 0,
      color: 'bg-blue-400',
    },
    {
      id: 'user',
      label: 'Customer Plans',
      active: analytics?.byAudience?.user?.activeCount || 0,
      revenue: analytics?.byAudience?.user?.revenue || 0,
      total: analytics?.byAudience?.user?.planCount || 0,
      color: 'bg-yellow-400',
    },
    {
      id: 'fleet_owner',
      label: 'Fleet Owner Plans',
      active: analytics?.byAudience?.fleet_owner?.activeCount || 0,
      revenue: analytics?.byAudience?.fleet_owner?.revenue || 0,
      total: analytics?.byAudience?.fleet_owner?.planCount || 0,
      color: 'bg-purple-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Finance</span>
            <ChevronRight size={12} />
            <span className="font-semibold text-slate-700">Subscription Analytics</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Subscription Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Active subscribers, revenue, renewals, and expiry trends
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          label="Total Active Subscriptions"
          value={totalActive.toLocaleString('en-IN')}
          sub="Across all plans"
          icon={Crown}
          color="yellow"
        />
        <MetricCard
          label="Total Revenue"
          value={money(totalRevenue)}
          sub="All subscription income"
          icon={IndianRupee}
          color="emerald"
        />
        <MetricCard
          label="Expiring Soon"
          value={(expiringPlans.length).toLocaleString('en-IN')}
          sub="Within next 7 days"
          icon={AlertCircle}
          color="red"
        />
        <MetricCard
          label="Total Plans"
          value={(analytics?.totalPlans || 0).toLocaleString('en-IN')}
          sub="Active plan offerings"
          icon={BarChart3}
          color="blue"
        />
      </div>

      {/* Audience Breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
          <Users size={18} className="text-slate-600" />
          <h3 className="text-sm font-bold text-slate-900">Subscription Breakdown by Audience</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {audienceBreakdown.map((row) => (
            <div key={row.id} className="px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-black text-slate-800">{row.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {row.active} active subscribers · {row.total} plans available
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-slate-900">{money(row.revenue)}</p>
                  <p className="text-xs text-slate-400">revenue collected</p>
                </div>
              </div>
              <ProgressBar value={row.active} max={Math.max(totalActive, 1)} color={row.color} />
              <div className="flex justify-between mt-1">
                <p className="text-[11px] font-semibold text-slate-400">0</p>
                <p className="text-[11px] font-semibold text-slate-400">
                  {Math.min(100, Math.round((row.active / Math.max(totalActive, 1)) * 100))}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Expiring Soon */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-red-50 px-6 py-4">
            <AlertCircle size={18} className="text-red-500" />
            <h3 className="text-sm font-bold text-slate-900">Expiring Within 7 Days</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {expiringPlans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 size={36} className="mb-3 text-emerald-200" />
                <p className="text-sm font-semibold text-slate-400">No subscriptions expiring soon</p>
              </div>
            ) : (
              expiringPlans.map((sub, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{sub.name || sub.subscriber_name || 'Subscriber'}</p>
                    <p className="text-xs text-slate-400">{sub.plan_name || 'Subscription Plan'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                      <Clock size={11} /> {sub.days_remaining ?? '?'}d left
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {sub.expiry_date ? new Date(sub.expiry_date).toLocaleDateString('en-IN') : '—'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Subscriptions */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
            <TrendingUp size={18} className="text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Recent Subscriptions</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {recentSubscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Crown size={36} className="mb-3 text-slate-200" />
                <p className="text-sm font-semibold text-slate-400">No recent subscriptions</p>
              </div>
            ) : (
              recentSubscriptions.map((sub, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{sub.subscriber_name || sub.name || '—'}</p>
                    <p className="text-xs text-slate-400">{sub.plan_name || 'Plan'} · {sub.audience || ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{money(sub.amount)}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {sub.created_at ? new Date(sub.created_at).toLocaleDateString('en-IN') : '—'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionAnalytics;
