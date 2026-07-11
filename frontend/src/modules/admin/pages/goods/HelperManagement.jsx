import React, { useEffect, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  ChevronRight,
  Loader2,
  X,
  Save,
  Users,
  MapPin,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  AlertCircle,
  IndianRupee,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100';
const labelClass = 'mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-slate-500';

const HELPER_TYPES = [
  { id: 'loading', label: 'Loading Helper' },
  { id: 'unloading', label: 'Unloading Helper' },
  { id: 'both', label: 'Loading & Unloading' },
];

const defaultForm = {
  name: '',
  phone: '',
  email: '',
  service_area: '',
  helper_type: 'both',
  loading_charge: '',
  unloading_charge: '',
  available: true,
  notes: '',
};

const HelperCard = ({ helper, onEdit, onDelete, onToggle }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="h-9 w-9 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
            <Users size={18} className="text-yellow-600" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">{helper.name}</p>
            <p className="text-xs text-slate-400">{helper.phone || '—'}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          title={helper.available ? 'Mark Unavailable' : 'Mark Available'}
          onClick={() => onToggle(helper)}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors"
        >
          {helper.available
            ? <ToggleRight size={18} className="text-emerald-500" />
            : <ToggleLeft size={18} />}
        </button>
        <button
          type="button"
          onClick={() => onEdit(helper)}
          className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <Edit2 size={15} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(helper)}
          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</p>
        <p className="mt-0.5 text-xs font-black capitalize text-slate-700">
          {helper.helper_type?.replace('_', ' ') || 'Both'}
        </p>
      </div>
      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Area</p>
        <p className="mt-0.5 text-xs font-black text-slate-700 truncate">
          {helper.service_area || 'All areas'}
        </p>
      </div>
      <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Loading</p>
        <p className="mt-0.5 text-sm font-black text-emerald-700">
          ₹{Number(helper.loading_charge || 0).toLocaleString('en-IN')}
        </p>
      </div>
      <div className="rounded-xl bg-blue-50 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Unloading</p>
        <p className="mt-0.5 text-sm font-black text-blue-700">
          ₹{Number(helper.unloading_charge || 0).toLocaleString('en-IN')}
        </p>
      </div>
    </div>

    <div className="mt-3 flex items-center justify-between">
      <span
        className={`inline-block rounded-full px-3 py-1 text-[11px] font-black ${
          helper.available
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-red-100 text-red-600'
        }`}
      >
        {helper.available ? '● Available' : '● Unavailable'}
      </span>
      {helper.notes && (
        <p className="text-xs text-slate-400 truncate max-w-[140px]">{helper.notes}</p>
      )}
    </div>
  </motion.div>
);

const HelperFormModal = ({ form, setForm, onClose, onSave, saving, editId }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-black text-slate-900">{editId ? 'Edit Helper' : 'Add Labour/Helper'}</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage helper details, charges, and availability</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100">
          <X size={20} className="text-slate-500" />
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Basic Info */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Full Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Helper's full name"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Phone Number</label>
            <input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+91 XXXXX XXXXX"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Service Area / Zone</label>
          <div className="relative">
            <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={form.service_area}
              onChange={(e) => setForm((p) => ({ ...p, service_area: e.target.value }))}
              placeholder="e.g. North Delhi, Sector 5"
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>

        {/* Helper Type */}
        <div>
          <label className={labelClass}>Helper Type</label>
          <div className="flex flex-wrap gap-2">
            {HELPER_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setForm((p) => ({ ...p, helper_type: t.id }))}
                className={`rounded-xl border-2 px-4 py-2.5 text-sm font-black transition-all ${
                  form.helper_type === t.id
                    ? 'border-yellow-400 bg-yellow-50 text-yellow-800'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Charges */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Loading Charge (₹ per job)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
              <input
                type="number"
                min="0"
                step="10"
                value={form.loading_charge}
                onChange={(e) => setForm((p) => ({ ...p, loading_charge: e.target.value }))}
                placeholder="0"
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Unloading Charge (₹ per job)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
              <input
                type="number"
                min="0"
                step="10"
                value={form.unloading_charge}
                onChange={(e) => setForm((p) => ({ ...p, unloading_charge: e.target.value }))}
                placeholder="0"
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Any special skills, language preferences, etc."
            rows={2}
            className={inputClass}
          />
        </div>

        {/* Availability Toggle */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-slate-800">Availability Status</p>
            <p className="text-xs text-slate-400 mt-0.5">Unavailable helpers won't be shown to customers</p>
          </div>
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, available: !p.available }))}
            className="flex items-center gap-2"
          >
            {form.available
              ? <ToggleRight size={30} className="text-emerald-500" />
              : <ToggleLeft size={30} className="text-slate-400" />}
            <span className={`text-sm font-black ${form.available ? 'text-emerald-600' : 'text-slate-400'}`}>
              {form.available ? 'Available' : 'Unavailable'}
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
          disabled={saving || !form.name}
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-2.5 text-sm font-black text-black shadow-md hover:bg-yellow-500 disabled:opacity-60"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving...' : editId ? 'Update Helper' : 'Add Helper'}
        </button>
      </div>
    </motion.div>
  </div>
);

const HelperManagement = () => {
  const [helpers, setHelpers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterAvailable, setFilterAvailable] = useState('all');

  const loadHelpers = async () => {
    try {
      setLoading(true);
      const res = await adminService.getHelpers?.().catch(() => ({ data: [] }));
      const list = res?.data?.results || res?.data?.data || res?.data || [];
      setHelpers(Array.isArray(list) ? list : []);
    } catch {
      toast.error('Failed to load helpers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHelpers();
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...defaultForm });
    setShowModal(true);
  };

  const openEdit = (h) => {
    setEditId(h.id || h._id);
    setForm({
      name: h.name || '',
      phone: h.phone || '',
      email: h.email || '',
      service_area: h.service_area || '',
      helper_type: h.helper_type || 'both',
      loading_charge: String(h.loading_charge || ''),
      unloading_charge: String(h.unloading_charge || ''),
      available: Boolean(h.available !== false),
      notes: h.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (h) => {
    if (!window.confirm(`Remove helper "${h.name}"?`)) return;
    try {
      await adminService.deleteHelper?.(h.id || h._id);
      toast.success('Helper removed');
      setHelpers((prev) => prev.filter((x) => (x.id || x._id) !== (h.id || h._id)));
    } catch {
      toast.error('Failed to remove helper');
    }
  };

  const handleToggle = async (h) => {
    try {
      const id = h.id || h._id;
      await adminService.updateHelper?.(id, { available: !h.available });
      setHelpers((prev) =>
        prev.map((x) => ((x.id || x._id) === id ? { ...x, available: !x.available } : x)),
      );
      toast.success(`Helper marked as ${h.available ? 'unavailable' : 'available'}`);
    } catch {
      toast.error('Failed to update helper status');
    }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('Helper name is required'); return; }
    try {
      setSaving(true);
      const payload = {
        ...form,
        loading_charge: Number(form.loading_charge || 0),
        unloading_charge: Number(form.unloading_charge || 0),
      };
      if (editId) {
        await adminService.updateHelper?.(editId, payload);
        toast.success('Helper updated');
      } else {
        await adminService.createHelper?.(payload);
        toast.success('Helper added');
      }
      setShowModal(false);
      loadHelpers();
    } catch (err) {
      toast.error(err?.message || 'Failed to save helper');
    } finally {
      setSaving(false);
    }
  };

  const filtered = helpers
    .filter((h) => `${h.name} ${h.phone || ''} ${h.service_area || ''}`.toLowerCase().includes(search.toLowerCase()))
    .filter((h) => filterAvailable === 'all' || (filterAvailable === 'available' ? h.available : !h.available));

  const availableCount = helpers.filter((h) => h.available).length;
  const unavailableCount = helpers.length - availableCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Goods Transport</span>
            <ChevronRight size={12} />
            <span className="font-semibold text-slate-700">Helper Management</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Labour & Helper Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage loading/unloading helpers, set per-helper charges, and control availability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadHelpers}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-black text-black shadow-md hover:bg-yellow-500"
          >
            <Plus size={16} /> Add Helper
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Total</p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">{helpers.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Available</p>
          <p className="mt-1.5 text-3xl font-black text-emerald-700">{availableCount}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-red-400">Unavailable</p>
          <p className="mt-1.5 text-3xl font-black text-red-700">{unavailableCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search helpers..."
            className="w-64 rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'available', label: 'Available' },
            { id: 'unavailable', label: 'Unavailable' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterAvailable(f.id)}
              className={`rounded-lg px-4 py-2 text-sm font-black transition-all ${
                filterAvailable === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <Users size={48} className="mb-4 text-slate-200" />
          <h3 className="text-lg font-black text-slate-700">No Helpers Found</h3>
          <p className="mt-1 text-sm text-slate-400">Add your first helper to enable labour booking</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-black text-black shadow-md hover:bg-yellow-500"
          >
            <Plus size={16} /> Add Helper
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {filtered.map((h) => (
              <HelperCard
                key={h.id || h._id}
                helper={h}
                onEdit={openEdit}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <HelperFormModal
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

export default HelperManagement;
