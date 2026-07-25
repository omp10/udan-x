import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Car,
  Download,
  FileText,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import DriverBottomNav from '../../shared/components/DriverBottomNav';
import { uploadService } from '../../../shared/services/uploadService';
import {
  cancelOwnerPayoutRequest,
  createOwnerPayoutRequest,
  downloadOwnerReport,
  getOwnerEarningsReport,
  getOwnerFleetCompliance,
  getOwnerPayoutRequests,
  getOwnerShipmentReport,
  updateOwnerVehicleCompliance,
} from '../services/ownerReportsService';

const TABS = [
  { key: 'earnings', label: 'Earnings', icon: TrendingUp },
  { key: 'shipments', label: 'Shipments', icon: Package },
  { key: 'payouts', label: 'Payouts', icon: Banknote },
  { key: 'compliance', label: 'Documents', icon: ShieldCheck },
];

const money = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const unwrap = (response) => response?.data?.data || response?.data || response;

const readError = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const toDateInput = (date) => date.toISOString().slice(0, 10);

const statusTone = (value = '') => {
  const normalized = String(value || '').toLowerCase();
  if (['approved', 'completed', 'active', 'delivered'].includes(normalized)) {
    return 'bg-emerald-50 text-emerald-600';
  }
  if (['pending', 'accepted', 'ongoing', 'searching'].includes(normalized)) {
    return 'bg-amber-50 text-amber-600';
  }
  if (['cancelled', 'rejected', 'inactive'].includes(normalized)) {
    return 'bg-rose-50 text-rose-600';
  }
  return 'bg-slate-100 text-slate-600';
};

const Metric = ({ label, value, sub }) => (
  <div className="rounded-2xl bg-slate-50 px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-2 text-[18px] font-black text-slate-900">{value}</p>
    {sub ? <p className="mt-1 text-[10px] font-bold text-slate-500">{sub}</p> : null}
  </div>
);

const Card = ({ eyebrow, title, action, children }) => (
  <section className="mt-5 rounded-[30px] bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{eyebrow}</p>
        <h2 className="mt-1 text-[20px] font-black text-slate-950">{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const EmptyRow = ({ children }) => (
  <div className="rounded-2xl bg-slate-50 px-4 py-5 text-[12px] font-bold text-slate-400">{children}</div>
);

// Horizontal bar list; the widest row anchors the scale so a single big day does
// not flatten the rest.
const BreakdownList = ({ rows, labelKey, subFn }) => {
  const max = Math.max(...rows.map((row) => Number(row.ownerEarnings || 0)), 1);

  return (
    <div className="mt-4 space-y-3">
      {rows.length === 0 ? (
        <EmptyRow>No data in this range.</EmptyRow>
      ) : (
        rows.map((row, index) => (
          <div key={`${row[labelKey] || index}`} className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[13px] font-black text-slate-900">{row[labelKey] || '-'}</p>
              <p className="shrink-0 text-[12px] font-black text-emerald-600">{money(row.ownerEarnings)}</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.max((Number(row.ownerEarnings || 0) / max) * 100, 2)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] font-bold text-slate-500">{subFn(row)}</p>
          </div>
        ))
      )}
    </div>
  );
};

const OwnerReports = () => {
  const navigate = useNavigate();
  const { reportTab } = useParams();
  const [tab, setTab] = useState(() =>
    TABS.some((item) => item.key === reportTab) ? reportTab : 'earnings',
  );
  const [groupBy, setGroupBy] = useState('day');
  const [range, setRange] = useState(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    return { from: toDateInput(from), to: toDateInput(now) };
  });

  const [earnings, setEarnings] = useState(null);
  const [shipments, setShipments] = useState(null);
  const [payouts, setPayouts] = useState(null);
  const [compliance, setCompliance] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [complianceDraft, setComplianceDraft] = useState({});

  // Deliberately does no state update before its first await: the effect below
  // calls it directly, and a synchronous setState in an effect body is both a lint
  // error here and a cascading render. Callers own the spinner they want to show.
  const load = useCallback(
    async (activeTab) => {
      const params = { from: range.from, to: range.to, groupBy };

      try {
        if (activeTab === 'earnings') {
          setEarnings(unwrap(await getOwnerEarningsReport(params)));
        } else if (activeTab === 'shipments') {
          setShipments(unwrap(await getOwnerShipmentReport(params)));
        } else if (activeTab === 'payouts') {
          setPayouts(unwrap(await getOwnerPayoutRequests()));
        } else {
          setCompliance(unwrap(await getOwnerFleetCompliance()));
        }
        setError('');
      } catch (requestError) {
        setError(readError(requestError, 'Unable to load owner report'));
      } finally {
        setIsLoading(false);
        setIsBusy(false);
      }
    },
    [groupBy, range.from, range.to],
  );

  // Kicked off a microtask later so the fetch's state writes land outside the
  // effect body (react-hooks/set-state-in-effect). Each tab writes its own slice,
  // so a fast tab switch cannot cross-contaminate results.
  useEffect(() => {
    Promise.resolve().then(() => load(tab));
  }, [load, tab]);

  const refresh = (activeTab) => {
    setIsBusy(true);
    load(activeTab);
  };

  const exportReport = async (type, format) => {
    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      await downloadOwnerReport({ type, format, from: range.from, to: range.to, groupBy });
      setNotice(`${type} report downloaded as ${format.toUpperCase()}`);
    } catch (requestError) {
      setError(readError(requestError, 'Export failed'));
    } finally {
      setIsBusy(false);
    }
  };

  const submitPayout = async () => {
    const amount = Number(payoutAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid payout amount.');
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      await createOwnerPayoutRequest({ amount });
      setPayoutAmount('');
      setNotice('Payout request sent to admin.');
      await load('payouts');
    } catch (requestError) {
      setError(readError(requestError, 'Could not send payout request'));
    } finally {
      setIsBusy(false);
    }
  };

  const cancelPayout = async (requestId) => {
    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      await cancelOwnerPayoutRequest(requestId);
      setNotice('Payout request cancelled, amount refunded to wallet.');
      await load('payouts');
    } catch (requestError) {
      setError(readError(requestError, 'Could not cancel payout request'));
    } finally {
      setIsBusy(false);
    }
  };

  const draftFor = (vehicleId, key, item) =>
    complianceDraft[`${vehicleId}:${key}`] ?? item.expiryDate ?? '';

  const setDraft = (vehicleId, key, value) =>
    setComplianceDraft((current) => ({ ...current, [`${vehicleId}:${key}`]: value }));

  const saveCompliance = async (vehicleId, key, expiryDate, documentUrl) => {
    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      await updateOwnerVehicleCompliance(vehicleId, {
        [key]: { expiryDate, ...(documentUrl ? { previewUrl: documentUrl } : {}) },
      });
      setNotice(`${key.toUpperCase()} details saved.`);
      await load('compliance');
    } catch (requestError) {
      setError(readError(requestError, 'Could not save vehicle document'));
    } finally {
      setIsBusy(false);
    }
  };

  const uploadDocument = async (vehicleId, key, file) => {
    if (!file) return;

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const uploaded = await uploadService.uploadImage(dataUrl, 'fleet-documents');
      const url = uploaded?.data?.url || uploaded?.url || '';

      if (!url) {
        throw new Error('Upload did not return a document URL');
      }

      await saveCompliance(vehicleId, key, complianceDraft[`${vehicleId}:${key}`] || '', url);
    } catch (requestError) {
      setError(readError(requestError, 'Document upload failed'));
      setIsBusy(false);
    }
  };

  const earningTotals = earnings?.totals || {};
  const shipmentTotals = shipments?.totals || {};
  const payoutRules = payouts?.rules || {};

  const bucketLabel = useMemo(
    () => (groupBy === 'month' ? 'Monthly trend' : 'Daily trend'),
    [groupBy],
  );

  return (
    <div className="min-h-screen bg-[#f8f9fb] pb-32">
      <div className="mx-auto max-w-lg px-5 pt-10">
        <header className="rounded-[32px] bg-slate-900 px-5 py-6 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate('/taxi/owner/dashboard')}
                className="mb-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60"
              >
                <ArrowLeft size={14} />
                Dashboard
              </button>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-400">Fleet Reports</p>
              <h1 className="mt-2 text-[28px] font-black leading-none tracking-tight">Business Insights</h1>
            </div>
            <button
              type="button"
              onClick={() => refresh(tab)}
              disabled={isBusy}
              className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-white disabled:opacity-60"
              aria-label="Refresh report"
            >
              <RefreshCw size={18} className={isBusy ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <label className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="block text-[9px] font-black uppercase tracking-widest text-white/50">From</span>
              <input
                type="date"
                value={range.from}
                max={range.to}
                onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
                className="mt-1 w-full bg-transparent text-[11px] font-black text-white outline-none"
              />
            </label>
            <label className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="block text-[9px] font-black uppercase tracking-widest text-white/50">To</span>
              <input
                type="date"
                value={range.to}
                min={range.from}
                onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
                className="mt-1 w-full bg-transparent text-[11px] font-black text-white outline-none"
              />
            </label>
            <label className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="block text-[9px] font-black uppercase tracking-widest text-white/50">Bucket</span>
              <select
                value={groupBy}
                onChange={(event) => setGroupBy(event.target.value)}
                className="mt-1 w-full bg-transparent text-[11px] font-black text-white outline-none [&>option]:text-slate-900"
              >
                <option value="day">Daily</option>
                <option value="month">Monthly</option>
              </select>
            </label>
          </div>
        </header>

        <nav className="mt-4 grid grid-cols-4 gap-2">
          {TABS.map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[9px] font-black uppercase tracking-widest transition-colors ${
                  isActive ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 shadow-sm'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {error ? (
          <div className="mt-4 rounded-3xl border border-rose-100 bg-rose-50 px-4 py-4 text-[12px] font-bold text-rose-600">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mt-4 rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-[12px] font-bold text-emerald-600">
            {notice}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : null}

        {!isLoading && tab === 'earnings' ? (
          <>
            <Card
              eyebrow={earnings?.range ? `${earnings.range.from} → ${earnings.range.to}` : 'Range'}
              title="Earnings summary"
              action={
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => exportReport('trips', 'csv')}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded-2xl bg-slate-900 px-3 py-2 text-[10px] font-black text-white disabled:opacity-60"
                  >
                    <Download size={12} />
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => exportReport('trips', 'xlsx')}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded-2xl bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-700 disabled:opacity-60"
                  >
                    <FileText size={12} />
                    XLSX
                  </button>
                </div>
              }
            >
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Owner Earnings" value={money(earningTotals.ownerEarnings)} sub={`${earningTotals.completedTrips || 0} completed trips`} />
                <Metric label="Gross Revenue" value={money(earningTotals.grossRevenue)} sub={`${money(earningTotals.commission)} commission`} />
                <Metric label="Avg / Trip" value={money(earningTotals.averageOwnerEarningsPerTrip)} sub={`${money(earningTotals.averageFare)} avg fare`} />
                <Metric label="Wallet" value={money(earnings?.walletBalance)} sub={`${earningTotals.cancelledTrips || 0} cancelled`} />
              </div>
              {earningTotals.unsettledTrips ? (
                <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[11px] font-bold text-amber-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {earningTotals.unsettledTrips} completed trips ({money(earningTotals.unsettledGross)} fare) are not settled to your wallet yet, so they are excluded from owner earnings.
                </div>
              ) : null}
            </Card>

            <Card eyebrow="Trend" title={bucketLabel}>
              <BreakdownList
                rows={earnings?.buckets || []}
                labelKey="key"
                subFn={(row) => `${row.trips} trips • ${row.completedTrips} completed • ${money(row.grossRevenue)} gross`}
              />
            </Card>

            <Card
              eyebrow="Vehicle wise"
              title="Earnings by vehicle"
              action={
                <button
                  type="button"
                  onClick={() => exportReport('vehicles', 'csv')}
                  disabled={isBusy}
                  className="inline-flex shrink-0 items-center gap-1 rounded-2xl bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-700 disabled:opacity-60"
                >
                  <Car size={12} />
                  Export
                </button>
              }
            >
              <BreakdownList
                rows={earnings?.byVehicle || []}
                labelKey="label"
                subFn={(row) => `${row.trips} trips • ${row.driverCount} driver(s) • ${money(row.grossRevenue)} gross`}
              />
            </Card>

            <Card
              eyebrow="Driver wise"
              title="Earnings by driver"
              action={
                <button
                  type="button"
                  onClick={() => exportReport('drivers', 'csv')}
                  disabled={isBusy}
                  className="inline-flex shrink-0 items-center gap-1 rounded-2xl bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-700 disabled:opacity-60"
                >
                  <Users size={12} />
                  Export
                </button>
              }
            >
              <BreakdownList
                rows={earnings?.byDriver || []}
                labelKey="name"
                subFn={(row) => `${row.vehicle} • ${row.trips} trips • ${money(row.grossRevenue)} gross`}
              />
            </Card>
          </>
        ) : null}

        {!isLoading && tab === 'shipments' ? (
          <>
            <Card
              eyebrow={shipments?.range ? `${shipments.range.from} → ${shipments.range.to}` : 'Range'}
              title="Shipment monitoring"
              action={
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => exportReport('shipments', 'csv')}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded-2xl bg-slate-900 px-3 py-2 text-[10px] font-black text-white disabled:opacity-60"
                  >
                    <Download size={12} />
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => exportReport('shipments', 'xlsx')}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded-2xl bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-700 disabled:opacity-60"
                  >
                    <FileText size={12} />
                    XLSX
                  </button>
                </div>
              }
            >
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Shipments" value={shipmentTotals.trips || 0} sub={`${shipmentTotals.completedTrips || 0} delivered`} />
                <Metric label="In Transit" value={shipmentTotals.inTransit || 0} sub={`${shipmentTotals.awaitingPickup || 0} awaiting pickup`} />
                <Metric label="Parcel Revenue" value={money(shipmentTotals.grossRevenue)} sub={`${money(shipmentTotals.ownerEarnings)} owner earnings`} />
                <Metric
                  label="Total Load"
                  value={`${Number(shipmentTotals.totalWeightKg || 0).toLocaleString('en-IN')} kg`}
                  sub={`${shipmentTotals.totalPackages || 0} packages • ${shipmentTotals.fragileShipments || 0} fragile`}
                />
              </div>
            </Card>

            <Card eyebrow="Goods mix" title="Shipments by category">
              <div className="mt-4 space-y-3">
                {(shipments?.byCategory || []).length === 0 ? (
                  <EmptyRow>No shipments in this range.</EmptyRow>
                ) : (
                  shipments.byCategory.map((row) => (
                    <div key={row.category} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black capitalize text-slate-900">{row.category}</p>
                        <p className="mt-1 text-[11px] font-bold text-slate-500">
                          {row.shipments} shipments • {row.delivered} delivered • {Number(row.weightKg || 0).toLocaleString('en-IN')} kg
                        </p>
                      </div>
                      <p className="shrink-0 text-[12px] font-black text-emerald-600">{money(row.revenue)}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card eyebrow="Live" title="Recent shipments">
              <div className="mt-4 space-y-3">
                {(shipments?.recent || []).length === 0 ? (
                  <EmptyRow>No shipments found yet.</EmptyRow>
                ) : (
                  shipments.recent.map((shipment) => (
                    <div key={shipment.id} className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-black capitalize text-slate-900">
                            {shipment.category || 'Parcel'} • {shipment.materialName || 'Goods'}
                          </p>
                          <p className="mt-1 line-clamp-1 text-[11px] font-bold text-slate-500">Pickup: {shipment.pickupAddress || '-'}</p>
                          <p className="mt-1 line-clamp-1 text-[11px] font-bold text-slate-500">Drop: {shipment.dropAddress || '-'}</p>
                          <p className="mt-1 text-[11px] font-bold text-slate-500">
                            {shipment.driver?.name || 'Unassigned'} • {shipment.driver?.vehicle || 'No vehicle'}
                          </p>
                          <p className="mt-1 text-[10px] font-bold text-slate-400">
                            {Number(shipment.weightKg || 0).toLocaleString('en-IN')} kg • {shipment.packageCount || 0} pkg • {shipment.deliveryScope}
                            {shipment.isFragile ? ' • fragile' : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${statusTone(shipment.status)}`}>
                            {shipment.liveStatus || shipment.status || 'pending'}
                          </span>
                          <p className="mt-2 text-[12px] font-black text-emerald-600">{money(shipment.fare)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </>
        ) : null}

        {!isLoading && tab === 'payouts' ? (
          <>
            <Card eyebrow="Wallet" title="Request a payout">
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Available" value={money(payouts?.wallet?.balance)} sub="owner wallet balance" />
                <Metric
                  label="Minimum"
                  value={money(payoutRules.minimumTransferAmount)}
                  sub={payoutRules.transferEnabled ? 'payouts enabled' : 'payouts disabled by admin'}
                />
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payout to</p>
                <p className="mt-1 text-[13px] font-black text-slate-900">
                  {payouts?.bankDetails?.bankName || 'Bank account not added'}
                </p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  {payouts?.bankDetails?.accountNumber || '-'} • {payouts?.bankDetails?.ifsc || '-'}
                </p>
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={payoutAmount}
                  onChange={(event) => setPayoutAmount(event.target.value)}
                  placeholder="Amount"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-bold text-slate-800 outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={submitPayout}
                  disabled={isBusy || payoutRules.transferEnabled === false}
                  className="shrink-0 rounded-2xl bg-slate-900 px-4 py-3 text-[11px] font-black text-white disabled:opacity-60"
                >
                  Request
                </button>
              </div>
              <p className="mt-2 text-[10px] font-bold text-slate-400">
                The amount is held from your wallet immediately. Cancel a pending request to get it back.
              </p>
            </Card>

            <Card eyebrow="History" title="Payout requests">
              <div className="mt-4 space-y-3">
                {(payouts?.requests || []).length === 0 ? (
                  <EmptyRow>No payout requests yet.</EmptyRow>
                ) : (
                  payouts.requests.map((request) => (
                    <div key={request.id} className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-black text-slate-900">{money(request.amount)}</p>
                          <p className="mt-1 text-[11px] font-bold text-slate-500 capitalize">
                            {String(request.payment_method || '').replace(/_/g, ' ')} • {request.transactionId}
                          </p>
                          <p className="mt-1 text-[10px] font-bold text-slate-400">
                            {request.createdAt ? new Date(request.createdAt).toLocaleString('en-IN') : '-'}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${statusTone(request.status)}`}>
                            {request.status}
                          </span>
                          {request.status === 'pending' ? (
                            <button
                              type="button"
                              onClick={() => cancelPayout(request.id)}
                              disabled={isBusy}
                              className="mt-2 block rounded-xl bg-white px-3 py-1.5 text-[10px] font-black text-rose-500 shadow-sm disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </>
        ) : null}

        {!isLoading && tab === 'compliance' ? (
          <>
            <Card eyebrow="Compliance" title="Vehicle documents">
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Metric label="Expired" value={compliance?.totals?.expired || 0} />
                <Metric label="Due Soon" value={compliance?.totals?.expiringSoon || 0} sub={`${compliance?.warnDays || 30} days`} />
                <Metric label="Missing" value={compliance?.totals?.missing || 0} />
              </div>
            </Card>

            {(compliance?.vehicles || []).length === 0 ? (
              <Card eyebrow="Fleet" title="No vehicles">
                <div className="mt-4">
                  <EmptyRow>Add a fleet vehicle to track insurance and RC expiry.</EmptyRow>
                </div>
              </Card>
            ) : (
              compliance.vehicles.map((vehicle) => (
                <Card
                  key={vehicle.id}
                  eyebrow={vehicle.number || 'Vehicle'}
                  title={vehicle.label}
                  action={
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${statusTone(vehicle.status)}`}>
                      {vehicle.status}
                    </span>
                  }
                >
                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    {vehicle.assignedDriver?.name ? `Driver: ${vehicle.assignedDriver.name}` : 'No driver assigned'}
                  </p>
                  <div className="mt-4 space-y-3">
                    {vehicle.items.map((item) => (
                      <div key={item.key} className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[12px] font-black uppercase tracking-widest text-slate-700">{item.label}</p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${
                              item.expired
                                ? 'bg-rose-50 text-rose-600'
                                : item.expiringSoon
                                  ? 'bg-amber-50 text-amber-600'
                                  : item.expiryDate
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.expired
                              ? 'Expired'
                              : item.expiringSoon
                                ? `${item.daysRemaining}d left`
                                : item.expiryDate
                                  ? 'Valid'
                                  : 'No date'}
                          </span>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <input
                            type="date"
                            value={draftFor(vehicle.id, item.key, item)}
                            onChange={(event) => setDraft(vehicle.id, item.key, event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              saveCompliance(vehicle.id, item.key, draftFor(vehicle.id, item.key, item), '')
                            }
                            disabled={isBusy}
                            className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-black text-white disabled:opacity-60"
                          >
                            Save
                          </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                            {item.uploaded ? 'Replace document' : 'Upload document'}
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(event) => uploadDocument(vehicle.id, item.key, event.target.files?.[0])}
                            />
                          </label>
                          {item.documentUrl ? (
                            <a
                              href={item.documentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-black uppercase tracking-widest text-slate-400"
                            >
                              View
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </>
        ) : null}
      </div>

      <DriverBottomNav />
    </div>
  );
};

export default OwnerReports;
