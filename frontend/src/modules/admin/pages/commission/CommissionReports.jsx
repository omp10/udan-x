import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Calendar,
  IndianRupee,
  TrendingUp,
  Users,
  Car,
  Briefcase,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

const TABS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

const money = (v) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MetricCard = ({ label, value, sub, icon: Icon, color = 'yellow' }) => {
  const colors = {
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-600',
    blue: 'border-blue-200 bg-blue-50 text-blue-600',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    purple: 'border-purple-200 bg-purple-50 text-purple-600',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color].split(' ').slice(0, 2).join(' ')}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={16} strokeWidth={2} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-black text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs font-semibold text-slate-400">{sub}</p>}
    </div>
  );
};

const EmptyRow = ({ cols }) => (
  <tr>
    <td colSpan={cols} className="py-16 text-center">
      <FileText size={40} className="mx-auto mb-3 text-slate-200" />
      <p className="text-sm font-semibold text-slate-400">No commission records found</p>
    </td>
  </tr>
);

const CommissionReports = () => {
  const [period, setPeriod] = useState('weekly');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [driverPayouts, setDriverPayouts] = useState([]);
  const [fleetPayouts, setFleetPayouts] = useState([]);
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'driver-payouts', label: 'Driver Payouts' },
    { id: 'fleet-payouts', label: 'Fleet Owner Payouts' },
  ];

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportRes, driverRes, fleetRes] = await Promise.all([
        adminService.getCommissionReport?.({ period }).catch(() => null),
        adminService.getDriverPayoutReport?.({ period }).catch(() => null),
        adminService.getFleetPayoutReport?.({ period }).catch(() => null),
      ]);

      setData(
        reportRes?.data || {
          total_commission: 0,
          total_trips: 0,
          driver_share: 0,
          fleet_share: 0,
          platform_share: 0,
          by_vehicle: [],
        },
      );
      setDriverPayouts(
        Array.isArray(driverRes?.data?.results) ? driverRes.data.results :
          Array.isArray(driverRes?.data) ? driverRes.data : [],
      );
      setFleetPayouts(
        Array.isArray(fleetRes?.data?.results) ? fleetRes.data.results :
          Array.isArray(fleetRes?.data) ? fleetRes.data : [],
      );
    } catch (err) {
      toast.error('Failed to load commission reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period]);

  const handleExport = () => {
    toast('CSV export initiated', { icon: '📥' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Finance</span>
            <ChevronRight size={12} />
            <span className="font-semibold text-slate-700">Commission Reports</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Commission Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Daily, weekly, and monthly commission collection analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-black text-black shadow-md transition hover:bg-yellow-500"
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPeriod(tab.id)}
            className={`rounded-lg px-5 py-2 text-sm font-black transition-all ${
              period === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <MetricCard
              label="Total Commission"
              value={money(data?.total_commission)}
              sub={`${period} collection`}
              icon={IndianRupee}
              color="yellow"
            />
            <MetricCard
              label="Total Trips"
              value={Number(data?.total_trips || 0).toLocaleString('en-IN')}
              sub="Completed trips"
              icon={Car}
              color="blue"
            />
            <MetricCard
              label="Driver Share"
              value={money(data?.driver_share)}
              sub="Disbursed to drivers"
              icon={Users}
              color="emerald"
            />
            <MetricCard
              label="Fleet Owner Share"
              value={money(data?.fleet_share)}
              sub="Disbursed to owners"
              icon={Briefcase}
              color="purple"
            />
            <MetricCard
              label="Platform Revenue"
              value={money(data?.platform_share)}
              sub="Admin earnings"
              icon={TrendingUp}
              color="slate"
            />
          </div>

          {/* Section Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={`rounded-full px-4 py-2 text-sm font-black transition-colors ${
                  activeSection === s.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* By Vehicle Type */}
          {activeSection === 'overview' && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
                <BarChart3 size={18} className="text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">Commission by Vehicle Type</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      {['Vehicle Type', 'Trips', 'Gross Revenue', 'Commission', 'Driver Share', 'Fleet Share', 'Platform'].map(
                        (h) => (
                          <th key={h} className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {!data?.by_vehicle?.length ? (
                      <EmptyRow cols={7} />
                    ) : (
                      data.by_vehicle.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-bold text-slate-800">
                            {row.vehicle_type || row.name || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-600">
                            {Number(row.trips || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-600">{money(row.gross)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-600">{money(row.commission)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-emerald-700">{money(row.driver_share)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-blue-700">{money(row.fleet_share)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-yellow-700">{money(row.platform)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Driver Payouts */}
          {activeSection === 'driver-payouts' && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
                <Users size={18} className="text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">Driver Payout Report</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      {['Driver', 'Trips', 'Gross Earned', 'Commission Deducted', 'Net Payout', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!driverPayouts.length ? (
                      <EmptyRow cols={6} />
                    ) : (
                      driverPayouts.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-bold text-slate-800">{row.driver_name || row.name || '—'}</p>
                            <p className="text-xs text-slate-400">{row.phone || ''}</p>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-600">{row.trips || 0}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-600">{money(row.gross)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-red-600">{money(row.commission_deducted)}</td>
                          <td className="px-4 py-3 text-sm font-black text-slate-900">{money(row.net_payout)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-3 py-1 text-[11px] font-black ${
                                row.status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : row.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {row.status || 'pending'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fleet Owner Payouts */}
          {activeSection === 'fleet-payouts' && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
                <Briefcase size={18} className="text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">Fleet Owner Payout Report</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      {['Fleet Owner', 'Vehicles', 'Trips', 'Total Earned', 'Commission Share', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!fleetPayouts.length ? (
                      <EmptyRow cols={6} />
                    ) : (
                      fleetPayouts.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-bold text-slate-800">{row.owner_name || row.name || '—'}</p>
                            <p className="text-xs text-slate-400">{row.business_name || ''}</p>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-600">{row.vehicles || 0}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-600">{row.trips || 0}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-600">{money(row.total_earned)}</td>
                          <td className="px-4 py-3 text-sm font-black text-slate-900">{money(row.commission_share)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-3 py-1 text-[11px] font-black ${
                                row.status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {row.status || 'pending'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CommissionReports;
