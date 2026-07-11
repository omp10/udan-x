import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Crown, Loader2, Plus, RefreshCw, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

const TABS = [
  { id: 'driver', label: 'Driver Plans' },
  { id: 'owner', label: 'Owner Plans' },
];

const money = (value) => `Rs ${Number(value || 0).toFixed(2)}`;

const DriverSubscriptions = () => {
  const navigate = useNavigate();
  const [audience, setAudience] = useState('driver');
  const [searchTerm, setSearchTerm] = useState('');
  const [config, setConfig] = useState({ mode: 'commissionOnly' });
  const [analytics, setAnalytics] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);

  const loadData = async ({ nextAudience = audience } = {}) => {
    try {
      setLoading(true);
      const [plansResponse, settingsResponse, analyticsResponse] = await Promise.all([
        adminService.getSubscriptionPlans({ audience: nextAudience }),
        adminService.getSubscriptionSettings(),
        adminService.getPartnerSubscriptionAnalytics(),
      ]);

      setPlans(Array.isArray(plansResponse?.data?.results) ? plansResponse.data.results : []);
      setConfig({
        mode: settingsResponse?.data?.mode || 'commissionOnly',
      });
      setAnalytics(analyticsResponse?.data || null);
    } catch (error) {
      toast.error(error?.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadData({ nextAudience: audience });
  }, [audience]);

  const filteredPlans = useMemo(
    () =>
      plans.filter((item) =>
        `${item.name || ''} ${item.description || ''} ${item.vehicle_type?.name || ''}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      ),
    [plans, searchTerm],
  );

  const currentStats = analytics?.byAudience?.[audience] || {};

  const handleModeChange = async (mode) => {
    try {
      setSavingMode(true);
      const response = await adminService.updateSubscriptionSettings({ mode });
      setConfig({ mode: response?.data?.mode || mode });
      toast.success('Subscription mode updated');
      await loadData({ nextAudience: audience });
    } catch (error) {
      toast.error(error?.message || 'Failed to update subscription mode');
    } finally {
      setSavingMode(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs text-gray-400">
            <span>Partners</span>
            <ChevronRight size={12} />
            <span className="text-gray-700">Subscriptions</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Partner Subscription Management</h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin/drivers/subscription/create', { state: { audience } })}
          className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-bold text-black shadow-sm transition hover:bg-yellow-500"
        >
          <Plus size={16} />
          Add Plan
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Mode" value={config.mode} helper="Business model" icon={<ShieldCheck size={18} />} />
        <MetricCard label="Plans" value={currentStats.planCount || 0} helper={`${audience} plans`} icon={<Crown size={18} />} />
        <MetricCard label="Active Subs" value={currentStats.activeCount || 0} helper="Live subscriptions" icon={<Sparkles size={18} />} />
        <MetricCard label="Revenue" value={money(currentStats.revenue || 0)} helper="Collected so far" icon={<RefreshCw size={18} />} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {[
            { id: 'commissionOnly', label: 'Commission Only' },
            { id: 'subscriptionOnly', label: 'Subscription Only' },
            { id: 'both', label: 'Hybrid' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={savingMode}
              onClick={() => handleModeChange(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-black transition-colors ${
                config.mode === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAudience(tab.id)}
                className={`rounded-full px-4 py-2 text-sm font-black transition-colors ${
                  audience === tab.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search plans..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none focus:border-yellow-400"
            />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-bold text-gray-600">
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Coverage</th>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Benefits</th>
                <th className="px-4 py-3">Price</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-16 text-center">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-indigo-600" />
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-16 text-center text-sm font-semibold text-slate-400">
                    No plans found.
                  </td>
                </tr>
              ) : (
                filteredPlans.map((item) => (
                  <tr key={item.id || item._id} className="border-b border-gray-50 align-top">
                    <td className="px-4 py-4">
                      <p className="text-sm font-bold text-gray-900">{item.name}</p>
                      <p className="mt-1 text-xs font-medium text-gray-500">{item.description || item.how_it_works || 'Partner plan'}</p>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-600">
                      <div>{item.coverage_scope || 'individual'}</div>
                      <div className="mt-1 text-xs text-gray-400">{item.vehicle_type?.name || item.transport_type || 'All vehicles'}</div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-600">
                      <div>{item.billing_cycle || 'monthly'}</div>
                      <div className="mt-1 text-xs text-gray-400">{item.duration} days</div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-600">
                      <div className="flex flex-wrap gap-2">
                        {item.priority_booking ? <Badge text="Priority" /> : null}
                        {item.featured_listing ? <Badge text="Featured" /> : null}
                        {item.premium_support ? <Badge text="Support" /> : null}
                        {Number(item.commission_discount_percent || 0) > 0 ? <Badge text={`${item.commission_discount_percent}% off`} /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-gray-900">{money(item.amount || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, helper, icon }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">{label}</p>
      <div className="text-emerald-600">{icon}</div>
    </div>
    <p className="mt-3 text-2xl font-black text-gray-900 capitalize">{value}</p>
    <p className="mt-1 text-xs font-semibold text-gray-500">{helper}</p>
  </div>
);

const Badge = ({ text }) => (
  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">
    {text}
  </span>
);

export default DriverSubscriptions;
