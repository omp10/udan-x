import React, { useEffect, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  Crown,
  Loader2,
  Search,
  Save,
  X,
  Check,
  Sparkles,
  Star,
  Zap,
  Shield,
  Clock,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100';
const labelClass = 'mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-slate-500';

const TIERS = [
  { id: 'basic', label: 'Basic', icon: Shield, color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { id: 'standard', label: 'Standard', icon: Star, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'business', label: 'Business', icon: Zap, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'premium', label: 'Premium', icon: Crown, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
];

const AUDIENCE_TABS = [
  { id: 'user', label: 'Customer Plans' },
  { id: 'driver', label: 'Driver Plans' },
  { id: 'fleet_owner', label: 'Fleet Owner Plans' },
];

const BILLING_CYCLES = [
  { id: 'monthly', label: 'Monthly', days: 30 },
  { id: 'quarterly', label: 'Quarterly', days: 90 },
  { id: 'yearly', label: 'Yearly', days: 365 },
];

const FEATURES = [
  { key: 'priority_booking', label: 'Priority Booking Allocation' },
  { key: 'lower_commission', label: 'Reduced Commission Rates' },
  { key: 'featured_listing', label: 'Featured Profile Listing' },
  { key: 'higher_visibility', label: 'Higher Order Visibility' },
  { key: 'unlimited_bookings', label: 'Unlimited Bookings' },
  { key: 'premium_support', label: 'Premium Customer Support' },
  { key: 'auto_renewal', label: 'Auto Renewal Support' },
];

const defaultForm = {
  name: '',
  description: '',
  audience: 'driver',
  tier: 'basic',
  billing_cycle: 'monthly',
  amount: '',
  commission_discount_percent: '',
  duration: 30,
  active: true,
  priority_booking: false,
  lower_commission: false,
  featured_listing: false,
  higher_visibility: false,
  unlimited_bookings: false,
  premium_support: false,
  auto_renewal: false,
};

const TierBadge = ({ tier }) => {
  const t = TIERS.find((x) => x.id === tier) || TIERS[0];
  const Icon = t.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${t.color}`}>
      <Icon size={11} />
      {t.label}
    </span>
  );
};

const PlanCard = ({ plan, onEdit, onDelete, onToggle }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-base font-black text-slate-900">{plan.name}</p>
          <TierBadge tier={plan.tier} />
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-black ${
              plan.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {plan.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">{plan.description || 'Subscription plan'}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onToggle(plan)}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          title={plan.active ? 'Deactivate' : 'Activate'}
        >
          {plan.active ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
        </button>
        <button
          type="button"
          onClick={() => onEdit(plan)}
          className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <Edit2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(plan)}
          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>

    <div className="mt-4 grid grid-cols-3 gap-3">
      <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Price</p>
        <p className="mt-1 text-lg font-black text-slate-900">₹{Number(plan.amount || 0).toLocaleString('en-IN')}</p>
      </div>
      <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cycle</p>
        <p className="mt-1 text-sm font-black capitalize text-slate-700">{plan.billing_cycle || 'monthly'}</p>
      </div>
      <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Duration</p>
        <p className="mt-1 text-sm font-black text-slate-700">{plan.duration || 30}d</p>
      </div>
    </div>

    {/* Features */}
    <div className="mt-4 flex flex-wrap gap-1.5">
      {FEATURES.filter((f) => plan[f.key]).map((f) => (
        <span key={f.key} className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-[11px] font-bold text-yellow-700">
          <Check size={10} /> {f.label}
        </span>
      ))}
      {plan.commission_discount_percent > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">
          <Check size={10} /> {plan.commission_discount_percent}% Commission Discount
        </span>
      )}
    </div>
  </motion.div>
);

const PlanFormModal = ({ form, setForm, onClose, onSave, saving, editId }) => {
  const setBool = (k) => setForm((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-black text-slate-900">{editId ? 'Edit Plan' : 'Create Subscription Plan'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Configure plan details, pricing, and features</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100 transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Audience & Tier */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Audience / Who is this for?</label>
              <select
                value={form.audience}
                onChange={(e) => setForm((p) => ({ ...p, audience: e.target.value }))}
                className={inputClass}
              >
                {AUDIENCE_TABS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Plan Tier</label>
              <div className="flex flex-wrap gap-2">
                {TIERS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, tier: t.id }))}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-black transition-all ${
                        form.tier === t.id ? t.color : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      <Icon size={13} /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Name & Description */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Plan Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Business Monthly"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Brief plan description"
                className={inputClass}
              />
            </div>
          </div>

          {/* Billing */}
          <div>
            <label className={labelClass}>Billing Cycle</label>
            <div className="flex flex-wrap gap-2">
              {BILLING_CYCLES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, billing_cycle: c.id, duration: c.days }))}
                  className={`flex flex-col items-center rounded-2xl border-2 px-5 py-3 text-sm font-black transition-all ${
                    form.billing_cycle === c.id
                      ? 'border-yellow-400 bg-yellow-50 text-yellow-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span>{c.label}</span>
                  <span className="mt-0.5 text-[11px] font-semibold opacity-60">{c.days} days</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Plan Price (₹) *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                  className={`${inputClass} pl-8`}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Commission Discount (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={form.commission_discount_percent}
                  onChange={(e) => setForm((p) => ({ ...p, commission_discount_percent: e.target.value }))}
                  placeholder="0"
                  className={`${inputClass} pr-8`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span>
              </div>
              <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                <Info size={11} /> % reduction on platform commission for subscribers
              </p>
            </div>
          </div>

          {/* Features */}
          <div>
            <label className={labelClass}>Included Features</label>
            <div className="grid gap-2 md:grid-cols-2">
              {FEATURES.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setBool(f.key)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                    form[f.key]
                      ? 'border-yellow-400 bg-yellow-50 text-yellow-800'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      form[f.key] ? 'border-yellow-400 bg-yellow-400' : 'border-slate-300'
                    }`}
                  >
                    {form[f.key] && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div>
              <p className="text-sm font-bold text-slate-800">Plan Status</p>
              <p className="text-xs text-slate-500 mt-0.5">Inactive plans won't be shown to users</p>
            </div>
            <button type="button" onClick={() => setBool('active')} className="flex items-center gap-2">
              {form.active ? (
                <ToggleRight size={30} className="text-emerald-500" />
              ) : (
                <ToggleLeft size={30} className="text-slate-400" />
              )}
              <span className={`text-sm font-black ${form.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                {form.active ? 'Active' : 'Inactive'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !form.name || !form.amount}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-2.5 text-sm font-black text-black shadow-md transition hover:bg-yellow-500 disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : editId ? 'Update Plan' : 'Create Plan'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const SubscriptionPlans = () => {
  const [audience, setAudience] = useState('driver');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const res = await adminService.getSubscriptionPlans({ audience });
      const list = res?.data?.results || res?.data?.data || res?.data || [];
      setPlans(Array.isArray(list) ? list : []);
    } catch {
      toast.error('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [audience]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...defaultForm, audience });
    setShowModal(true);
  };

  const openEdit = (plan) => {
    setEditId(plan.id || plan._id);
    setForm({
      name: plan.name || '',
      description: plan.description || '',
      audience: plan.audience || audience,
      tier: plan.tier || 'basic',
      billing_cycle: plan.billing_cycle || 'monthly',
      amount: String(plan.amount || ''),
      commission_discount_percent: String(plan.commission_discount_percent || ''),
      duration: plan.duration || 30,
      active: Boolean(plan.active !== false),
      priority_booking: Boolean(plan.priority_booking),
      lower_commission: Boolean(plan.lower_commission),
      featured_listing: Boolean(plan.featured_listing),
      higher_visibility: Boolean(plan.higher_visibility),
      unlimited_bookings: Boolean(plan.unlimited_bookings),
      premium_support: Boolean(plan.premium_support),
      auto_renewal: Boolean(plan.auto_renewal),
    });
    setShowModal(true);
  };

  const handleDelete = async (plan) => {
    if (!window.confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    try {
      await adminService.deleteSubscriptionPlan(plan.id || plan._id);
      toast.success('Plan deleted');
      setPlans((prev) => prev.filter((p) => (p.id || p._id) !== (plan.id || plan._id)));
    } catch (err) {
      toast.error(err?.message || 'Failed to delete plan');
    }
  };

  const handleToggle = async (plan) => {
    try {
      const id = plan.id || plan._id;
      await adminService.updateSubscriptionPlan(id, { active: !plan.active });
      setPlans((prev) =>
        prev.map((p) => ((p.id || p._id) === id ? { ...p, active: !p.active } : p)),
      );
      toast.success(`Plan ${plan.active ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Failed to update plan status');
    }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('Plan name is required'); return; }
    if (!form.amount) { toast.error('Plan price is required'); return; }

    try {
      setSaving(true);
      const payload = {
        ...form,
        amount: Number(form.amount),
        commission_discount_percent: Number(form.commission_discount_percent || 0),
      };

      if (editId) {
        await adminService.updateSubscriptionPlan(editId, payload);
        toast.success('Plan updated successfully');
      } else {
        await adminService.createSubscriptionPlan(payload);
        toast.success('Plan created successfully');
      }
      setShowModal(false);
      loadPlans();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const filtered = plans.filter((p) =>
    `${p.name} ${p.description || ''} ${p.tier || ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Finance</span>
            <ChevronRight size={12} />
            <span className="font-semibold text-slate-700">Subscription Plans</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Subscription Plans</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and manage customer, driver, and fleet owner subscription plans.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadPlans}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-black text-black shadow-md transition hover:bg-yellow-500"
          >
            <Plus size={16} /> Add Plan
          </button>
        </div>
      </div>

      {/* Audience Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        {AUDIENCE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setAudience(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-black transition-all ${
              audience === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plans..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
        />
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <Sparkles size={48} className="mb-4 text-slate-200" />
          <h3 className="text-lg font-black text-slate-700">No Plans Yet</h3>
          <p className="mt-1 text-sm text-slate-400">Create your first subscription plan to get started</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-black text-black shadow-md hover:bg-yellow-500"
          >
            <Plus size={16} /> Create Plan
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {filtered.map((plan) => (
              <PlanCard
                key={plan.id || plan._id}
                plan={plan}
                onEdit={openEdit}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <PlanFormModal
            form={form}
            setForm={setForm}
            onClose={() => setShowModal(false)}
            onSave={handleSave}
            saving={saving}
            editId={editId}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubscriptionPlans;
