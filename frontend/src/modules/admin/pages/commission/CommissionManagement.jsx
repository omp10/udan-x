import React, { useEffect, useState } from 'react';
import {
  Save,
  RefreshCw,
  Loader2,
  IndianRupee,
  Percent,
  Car,
  Briefcase,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:bg-slate-50 disabled:text-slate-400';
const labelClass = 'mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-slate-500';

const SectionCard = ({ title, subtitle, icon: Icon, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
    <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600">
        <Icon size={18} strokeWidth={2} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const MetricCard = ({ label, value, sub, color = 'yellow' }) => {
  const colors = {
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <p className="text-[11px] font-bold uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      {sub && <p className="mt-1 text-xs font-semibold opacity-60">{sub}</p>}
    </div>
  );
};

const VehicleCommissionRow = ({ vehicle, commissionType, onChange }) => (
  <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-yellow-400" />
        <span className="text-sm font-semibold text-slate-800">{vehicle.name}</span>
      </div>
      {vehicle.description && (
        <p className="mt-0.5 pl-4 text-xs text-slate-400">{vehicle.description}</p>
      )}
    </td>
    <td className="px-4 py-3">
      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
        {vehicle.category || 'Standard'}
      </span>
    </td>
    <td className="px-4 py-3">
      <div className="relative w-32">
        <input
          type="number"
          min="0"
          max={commissionType === 'percentage' ? 100 : undefined}
          step="0.1"
          value={vehicle.commission ?? ''}
          onChange={(e) => onChange(vehicle.id || vehicle._id, e.target.value)}
          className="w-full rounded-lg border border-slate-200 py-2 pl-3 pr-8 text-sm font-bold text-slate-800 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
          placeholder="0"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
          {commissionType === 'percentage' ? '%' : '₹'}
        </span>
      </div>
    </td>
    <td className="px-4 py-3">
      <span
        className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${
          Number(vehicle.commission) > 0
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-100 text-slate-500'
        }`}
      >
        {Number(vehicle.commission) > 0
          ? commissionType === 'percentage'
            ? `${vehicle.commission}%`
            : `₹${vehicle.commission}`
          : 'Default'}
      </span>
    </td>
  </tr>
);

const defaultConfig = {
  commission_type: 'percentage',
  driver_commission: '20',
  fleet_owner_commission: '15',
  admin_share: '10',
  vehicle_overrides: [],
  auto_payout: false,
  payout_threshold: '500',
  payout_frequency: 'weekly',
};

const CommissionManagement = () => {
  const [config, setConfig] = useState(defaultConfig);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleOverrides, setVehicleOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [commissionRes, vehicleRes] = await Promise.all([
        adminService.getCommissionSettings().catch(() => null),
        adminService.getVehicleTypes().catch(() => null),
      ]);

      if (commissionRes?.data) {
        const d = commissionRes.data;
        setConfig((prev) => ({
          ...prev,
          commission_type: d.commission_type || 'percentage',
          driver_commission: String(d.driver_commission ?? '20'),
          fleet_owner_commission: String(d.fleet_owner_commission ?? '15'),
          admin_share: String(d.admin_share ?? '10'),
          auto_payout: Boolean(d.auto_payout),
          payout_threshold: String(d.payout_threshold ?? '500'),
          payout_frequency: d.payout_frequency || 'weekly',
        }));
        if (d.vehicle_overrides) {
          const overrides = {};
          (Array.isArray(d.vehicle_overrides) ? d.vehicle_overrides : []).forEach((o) => {
            overrides[o.vehicle_type_id || o.id] = String(o.commission ?? '');
          });
          setVehicleOverrides(overrides);
        }
      }

      const vData = vehicleRes?.data?.results || vehicleRes?.data?.data || vehicleRes?.data || [];
      setVehicles(Array.isArray(vData) ? vData : []);

      setAnalytics({
        total_commission_collected: commissionRes?.data?.analytics?.total_collected || 0,
        driver_payouts_pending: commissionRes?.data?.analytics?.driver_payouts_pending || 0,
        fleet_payouts_pending: commissionRes?.data?.analytics?.fleet_payouts_pending || 0,
        avg_commission_rate: commissionRes?.data?.analytics?.avg_rate || 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const overrideArray = vehicles.map((v) => ({
        vehicle_type_id: v.id || v._id,
        commission: vehicleOverrides[v.id || v._id] ?? null,
      }));
      await adminService.updateCommissionSettings({
        ...config,
        driver_commission: Number(config.driver_commission),
        fleet_owner_commission: Number(config.fleet_owner_commission),
        admin_share: Number(config.admin_share),
        payout_threshold: Number(config.payout_threshold),
        vehicle_overrides: overrideArray,
      });
      toast.success('Commission settings saved successfully');
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const setField = (key, value) => setConfig((prev) => ({ ...prev, [key]: value }));

  const handleVehicleOverride = (vehicleId, value) => {
    setVehicleOverrides((prev) => ({ ...prev, [vehicleId]: value }));
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  const isPercentage = config.commission_type === 'percentage';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Finance</span>
            <ChevronRight size={12} />
            <span className="text-slate-700 font-semibold">Commission Management</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Commission Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure driver &amp; fleet owner commissions, per-vehicle overrides, and payout rules.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-black text-black shadow-md transition hover:bg-yellow-500 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Analytics Row */}
      {analytics && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard
            label="Total Collected"
            value={`₹${Number(analytics.total_commission_collected).toLocaleString('en-IN')}`}
            sub="All time"
            color="yellow"
          />
          <MetricCard
            label="Driver Payouts Pending"
            value={`₹${Number(analytics.driver_payouts_pending).toLocaleString('en-IN')}`}
            sub="Awaiting disbursement"
            color="blue"
          />
          <MetricCard
            label="Fleet Payouts Pending"
            value={`₹${Number(analytics.fleet_payouts_pending).toLocaleString('en-IN')}`}
            sub="Awaiting disbursement"
            color="emerald"
          />
          <MetricCard
            label="Avg Commission Rate"
            value={`${Number(analytics.avg_commission_rate).toFixed(1)}%`}
            sub="Platform average"
            color="purple"
          />
        </div>
      )}

      {/* Commission Type Toggle */}
      <SectionCard
        title="Commission Type"
        subtitle="Choose between percentage-based or fixed amount commission"
        icon={Percent}
      >
        <div className="flex flex-wrap gap-3">
          {[
            { id: 'percentage', label: 'Percentage (%)', desc: 'Charge a % of each fare' },
            { id: 'fixed', label: 'Fixed Amount (₹)', desc: 'Charge a flat amount per trip' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setField('commission_type', opt.id)}
              className={`flex flex-col items-start rounded-2xl border-2 px-5 py-4 text-left transition-all ${
                config.commission_type === opt.id
                  ? 'border-yellow-400 bg-yellow-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="text-sm font-black text-slate-900">{opt.label}</span>
              <span className="mt-0.5 text-xs text-slate-500">{opt.desc}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Global Rates */}
      <SectionCard
        title="Global Commission Rates"
        subtitle="Default rates applied platform-wide unless overridden per vehicle type"
        icon={IndianRupee}
      >
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <label className={labelClass}>
              Driver Commission{' '}
              <span className="normal-case font-semibold text-slate-400">
                ({isPercentage ? '%' : '₹ per trip'})
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max={isPercentage ? 100 : undefined}
                step="0.1"
                value={config.driver_commission}
                onChange={(e) => setField('driver_commission', e.target.value)}
                className={inputClass}
                placeholder="20"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                {isPercentage ? '%' : '₹'}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1">
              <Info size={11} /> Amount/% the driver keeps per trip
            </p>
          </div>

          <div>
            <label className={labelClass}>
              Fleet Owner Commission{' '}
              <span className="normal-case font-semibold text-slate-400">
                ({isPercentage ? '%' : '₹ per trip'})
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max={isPercentage ? 100 : undefined}
                step="0.1"
                value={config.fleet_owner_commission}
                onChange={(e) => setField('fleet_owner_commission', e.target.value)}
                className={inputClass}
                placeholder="15"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                {isPercentage ? '%' : '₹'}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1">
              <Info size={11} /> Share for fleet owners on driver earnings
            </p>
          </div>

          <div>
            <label className={labelClass}>
              Admin Share / Platform Fee{' '}
              <span className="normal-case font-semibold text-slate-400">
                ({isPercentage ? '%' : '₹ per trip'})
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max={isPercentage ? 100 : undefined}
                step="0.1"
                value={config.admin_share}
                onChange={(e) => setField('admin_share', e.target.value)}
                className={inputClass}
                placeholder="10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                {isPercentage ? '%' : '₹'}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1">
              <Info size={11} /> Platform's cut from each transaction
            </p>
          </div>
        </div>

        {isPercentage && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-yellow-600" />
            <p className="text-xs font-semibold text-yellow-700">
              Ensure Driver Commission + Fleet Owner Commission + Admin Share ≤ 100%. Current total:{' '}
              <strong>
                {(
                  Number(config.driver_commission || 0) +
                  Number(config.fleet_owner_commission || 0) +
                  Number(config.admin_share || 0)
                ).toFixed(1)}
                %
              </strong>
            </p>
          </div>
        )}
      </SectionCard>

      {/* Per-Vehicle-Type Overrides */}
      {vehicles.length > 0 && (
        <SectionCard
          title="Per-Vehicle-Type Commission Overrides"
          subtitle="Override the global rate for specific vehicle categories. Leave blank to use the global rate."
          icon={Car}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Vehicle Type
                  </th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Category
                  </th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Override Rate
                  </th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Effective
                  </th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <VehicleCommissionRow
                    key={v.id || v._id}
                    vehicle={{
                      ...v,
                      commission: vehicleOverrides[v.id || v._id] ?? '',
                    }}
                    commissionType={config.commission_type}
                    onChange={handleVehicleOverride}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Payout Settings */}
      <SectionCard
        title="Payout Configuration"
        subtitle="Control automatic payout rules for drivers and fleet owners"
        icon={Briefcase}
      >
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <label className={labelClass}>Payout Frequency</label>
            <select
              value={config.payout_frequency}
              onChange={(e) => setField('payout_frequency', e.target.value)}
              className={inputClass}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="manual">Manual only</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Minimum Payout Threshold (₹)</label>
            <input
              type="number"
              min="0"
              step="50"
              value={config.payout_threshold}
              onChange={(e) => setField('payout_threshold', e.target.value)}
              className={inputClass}
              placeholder="500"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Minimum balance required to trigger payout
            </p>
          </div>

          <div>
            <label className={labelClass}>Auto Payout</label>
            <button
              type="button"
              onClick={() => setField('auto_payout', !config.auto_payout)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:bg-slate-50"
            >
              {config.auto_payout ? (
                <ToggleRight size={24} className="text-emerald-500" />
              ) : (
                <ToggleLeft size={24} className="text-slate-400" />
              )}
              <span className="text-sm font-bold text-slate-700">
                {config.auto_payout ? 'Enabled' : 'Disabled'}
              </span>
            </button>
            <p className="mt-1.5 text-xs text-slate-400">
              Automatically process payouts on schedule
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Save Footer */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <CheckCircle2 size={16} className="text-emerald-500" />
          Changes only take effect after saving
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-black text-white shadow-md transition hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
};

export default CommissionManagement;
