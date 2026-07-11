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
  Warehouse,
  MapPin,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Package,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100';
const labelClass = 'mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-slate-500';

const defaultForm = {
  name: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  contact_name: '',
  contact_phone: '',
  is_pickup: true,
  is_drop: true,
  active: true,
  capacity_notes: '',
  zone: '',
};

const WarehouseCard = ({ warehouse, onEdit, onDelete, onToggle }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-10 w-10 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
          <Warehouse size={20} className="text-yellow-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900 truncate">{warehouse.name}</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{warehouse.address}</p>
          {warehouse.city && (
            <p className="text-xs text-slate-400">{warehouse.city}{warehouse.state ? `, ${warehouse.state}` : ''}{warehouse.pincode ? ` - ${warehouse.pincode}` : ''}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          title={warehouse.active ? 'Deactivate' : 'Activate'}
          onClick={() => onToggle(warehouse)}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors"
        >
          {warehouse.active ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
        </button>
        <button
          type="button"
          onClick={() => onEdit(warehouse)}
          className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <Edit2 size={15} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(warehouse)}
          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>

    {/* Pickup / Drop Badges */}
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {warehouse.is_pickup && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700">
          <ArrowRight size={10} /> Pickup Point
        </span>
      )}
      {warehouse.is_drop && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black text-blue-700">
          <ArrowLeft size={10} /> Drop Point
        </span>
      )}
      <span
        className={`ml-auto inline-block rounded-full px-3 py-1 text-[11px] font-black ${
          warehouse.active ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-600'
        }`}
      >
        {warehouse.active ? 'Active' : 'Inactive'}
      </span>
    </div>

    {/* Contact */}
    {warehouse.contact_name && (
      <div className="mt-3 rounded-xl bg-slate-50 px-4 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Contact</p>
          <p className="text-xs font-bold text-slate-700">{warehouse.contact_name}</p>
        </div>
        {warehouse.contact_phone && (
          <p className="text-xs font-semibold text-slate-500">{warehouse.contact_phone}</p>
        )}
      </div>
    )}

    {warehouse.zone && (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
        <MapPin size={11} /> Zone: <span className="font-semibold text-slate-600">{warehouse.zone}</span>
      </div>
    )}
  </motion.div>
);

const WarehouseFormModal = ({ form, setForm, onClose, onSave, saving, editId }) => {
  const toggleBool = (key) => setForm((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-black text-slate-900">{editId ? 'Edit Warehouse' : 'Add Warehouse'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage pickup and drop warehouse locations</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Name & Zone */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Warehouse Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. North Hub Warehouse"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Zone / Service Area</label>
              <input
                value={form.zone}
                onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))}
                placeholder="e.g. North Delhi Zone"
                className={inputClass}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className={labelClass}>Full Address *</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Building no., street, locality..."
              rows={2}
              className={inputClass}
            />
          </div>

          {/* City / State / Pincode */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelClass}>City</label>
              <input
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                placeholder="City"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input
                value={form.state}
                onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                placeholder="State"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Pincode</label>
              <input
                value={form.pincode}
                onChange={(e) => setForm((p) => ({ ...p, pincode: e.target.value }))}
                placeholder="110001"
                maxLength={6}
                className={inputClass}
              />
            </div>
          </div>

          {/* Contact */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Contact Person</label>
              <input
                value={form.contact_name}
                onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))}
                placeholder="Manager name"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Contact Phone</label>
              <input
                value={form.contact_phone}
                onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value }))}
                placeholder="+91 XXXXX XXXXX"
                className={inputClass}
              />
            </div>
          </div>

          {/* Warehouse Role Toggles */}
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => toggleBool('is_pickup')}
              className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3.5 text-left transition-all ${
                form.is_pickup ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <ArrowRight size={16} className={form.is_pickup ? 'text-emerald-600' : 'text-slate-400'} />
                <div>
                  <p className="text-sm font-black text-slate-800">Pickup Point</p>
                  <p className="text-[11px] text-slate-400">Goods collected from here</p>
                </div>
              </div>
              {form.is_pickup ? <ToggleRight size={22} className="text-emerald-500" /> : <ToggleLeft size={22} className="text-slate-400" />}
            </button>

            <button
              type="button"
              onClick={() => toggleBool('is_drop')}
              className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3.5 text-left transition-all ${
                form.is_drop ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <ArrowLeft size={16} className={form.is_drop ? 'text-blue-600' : 'text-slate-400'} />
                <div>
                  <p className="text-sm font-black text-slate-800">Drop Point</p>
                  <p className="text-[11px] text-slate-400">Goods delivered here</p>
                </div>
              </div>
              {form.is_drop ? <ToggleRight size={22} className="text-blue-500" /> : <ToggleLeft size={22} className="text-slate-400" />}
            </button>
          </div>

          {/* Capacity Notes */}
          <div>
            <label className={labelClass}>Capacity / Notes (optional)</label>
            <input
              value={form.capacity_notes}
              onChange={(e) => setForm((p) => ({ ...p, capacity_notes: e.target.value }))}
              placeholder="e.g. Max 5 tons, cold storage available"
              className={inputClass}
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div>
              <p className="text-sm font-bold text-slate-800">Active Status</p>
              <p className="text-xs text-slate-400 mt-0.5">Inactive warehouses won't be shown in booking</p>
            </div>
            <button type="button" onClick={() => toggleBool('active')} className="flex items-center gap-2">
              {form.active ? <ToggleRight size={30} className="text-emerald-500" /> : <ToggleLeft size={30} className="text-slate-400" />}
              <span className={`text-sm font-black ${form.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                {form.active ? 'Active' : 'Inactive'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !form.name || !form.address}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-2.5 text-sm font-black text-black shadow-md hover:bg-yellow-500 disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : editId ? 'Update' : 'Add Warehouse'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const WarehouseManagement = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const res = await adminService.getWarehouses?.().catch(() => ({ data: [] }));
      const list = res?.data?.results || res?.data?.data || res?.data || [];
      setWarehouses(Array.isArray(list) ? list : []);
    } catch {
      toast.error('Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadWarehouses(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...defaultForm });
    setShowModal(true);
  };

  const openEdit = (w) => {
    setEditId(w.id || w._id);
    setForm({
      name: w.name || '',
      address: w.address || '',
      city: w.city || '',
      state: w.state || '',
      pincode: w.pincode || '',
      contact_name: w.contact_name || '',
      contact_phone: w.contact_phone || '',
      is_pickup: Boolean(w.is_pickup !== false),
      is_drop: Boolean(w.is_drop !== false),
      active: Boolean(w.active !== false),
      capacity_notes: w.capacity_notes || '',
      zone: w.zone || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (w) => {
    if (!window.confirm(`Remove warehouse "${w.name}"?`)) return;
    try {
      await adminService.deleteWarehouse?.(w.id || w._id);
      toast.success('Warehouse removed');
      setWarehouses((prev) => prev.filter((x) => (x.id || x._id) !== (w.id || w._id)));
    } catch { toast.error('Failed to remove warehouse'); }
  };

  const handleToggle = async (w) => {
    try {
      const id = w.id || w._id;
      await adminService.updateWarehouse?.(id, { active: !w.active });
      setWarehouses((prev) => prev.map((x) => ((x.id || x._id) === id ? { ...x, active: !x.active } : x)));
      toast.success('Warehouse status updated');
    } catch { toast.error('Failed to update status'); }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('Warehouse name required'); return; }
    if (!form.address?.trim()) { toast.error('Address required'); return; }
    try {
      setSaving(true);
      if (editId) {
        await adminService.updateWarehouse?.(editId, form);
        toast.success('Warehouse updated');
      } else {
        await adminService.createWarehouse?.(form);
        toast.success('Warehouse added');
      }
      setShowModal(false);
      loadWarehouses();
    } catch (err) {
      toast.error(err?.message || 'Failed to save warehouse');
    } finally {
      setSaving(false);
    }
  };

  const filtered = warehouses.filter((w) =>
    `${w.name} ${w.address || ''} ${w.city || ''} ${w.zone || ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Goods Transport</span>
            <ChevronRight size={12} />
            <span className="font-semibold text-slate-700">Warehouse Management</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Warehouse Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure pickup and drop warehouse locations for goods transportation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={loadWarehouses} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm hover:bg-slate-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-black text-black shadow-md hover:bg-yellow-500">
            <Plus size={16} /> Add Warehouse
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Total</p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">{warehouses.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Pickup Points</p>
          <p className="mt-1.5 text-3xl font-black text-emerald-700">{warehouses.filter((w) => w.is_pickup).length}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-400">Drop Points</p>
          <p className="mt-1.5 text-3xl font-black text-blue-700">{warehouses.filter((w) => w.is_drop).length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search warehouses..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100" />
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-yellow-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <Warehouse size={48} className="mb-4 text-slate-200" />
          <h3 className="text-lg font-black text-slate-700">No Warehouses Yet</h3>
          <p className="mt-1 text-sm text-slate-400">Add warehouse locations to enable pickup/drop options</p>
          <button type="button" onClick={openCreate} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-black text-black shadow-md hover:bg-yellow-500">
            <Plus size={16} /> Add Warehouse
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {filtered.map((w) => (
              <WarehouseCard key={w.id || w._id} warehouse={w} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggle} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showModal && <WarehouseFormModal form={form} setForm={setForm} onClose={() => setShowModal(false)} onSave={handleSave} saving={saving} editId={editId} />}
      </AnimatePresence>
    </div>
  );
};

export default WarehouseManagement;
