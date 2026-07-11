import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Loader2, Package, Save, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

const defaultSettings = {
  enable_fragile_option: true,
  enable_multi_stop: true,
  enable_helper_booking: true,
  enable_warehouse_pickup: true,
  enable_warehouse_drop: true,
  enable_weight_based_pricing: true,
  require_load_details: true,
  otp_delivery_verification: true,
  digital_signature: true,
  delivery_photo_upload: true,
  show_material_category: true,
  show_weight_field: true,
  show_fragile_toggle: true,
  max_stops: 5,
  max_helpers: 4,
  max_weight_kg: 10000,
};

const ToggleRow = ({ label, description, value, onChange }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
    <div><p className="text-sm font-bold text-slate-800">{label}</p><p className="mt-0.5 text-xs text-slate-500">{description}</p></div>
    <button type="button" aria-pressed={value} onClick={() => onChange(!value)}>
      {value ? <ToggleRight size={28} className="text-emerald-500" /> : <ToggleLeft size={28} className="text-slate-400" />}
    </button>
  </div>
);

const Section = ({ title, icon: Icon, children }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4"><Icon size={18} className="text-yellow-600" /><h2 className="text-sm font-black text-slate-900">{title}</h2></div>
    <div className="space-y-3 p-6">{children}</div>
  </section>
);

const GoodsSettings = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    adminService.getGoodsSettings().then((response) => {
      const saved = response?.data?.data?.settings || response?.data?.settings || {};
      if (active) setSettings((current) => ({ ...current, ...saved }));
    }).catch(() => toast.error('Could not load goods settings')).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const setField = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async () => {
    try { setSaving(true); await adminService.updateGoodsSettings(settings); toast.success('Goods settings saved'); }
    catch (error) { toast.error(error?.response?.data?.message || 'Could not save goods settings'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-yellow-500" /></div>;

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-1 text-xs text-slate-400">Goods Transport <ChevronRight size={12} /> Settings</div><h1 className="text-2xl font-black text-slate-900">Goods booking settings</h1><p className="mt-1 text-sm text-slate-500">Global delivery behavior only. Vehicle capabilities remain in Vehicle Types.</p></div>
      <button type="button" onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-black text-black disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save settings</button>
    </header>

    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
      <div><p className="text-sm font-black text-slate-900">One vehicle catalog, one source of truth</p><p className="mt-1 text-xs font-semibold text-slate-600">Delivery category, maximum weight/capacity, pricing and availability are configured on each existing vehicle type.</p></div>
      <button type="button" onClick={() => navigate('/admin/pricing/vehicle-type')} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white">Manage vehicle types</button>
    </div>

    <Section title="Booking features" icon={Settings}>
      <ToggleRow label="Multi-stop delivery" description="Allow multiple stops in a booking." value={settings.enable_multi_stop} onChange={(v) => setField('enable_multi_stop', v)} />
      <ToggleRow label="Helper booking" description="Allow loading and unloading helpers." value={settings.enable_helper_booking} onChange={(v) => setField('enable_helper_booking', v)} />
      <ToggleRow label="Warehouse pickup and drop" description="Expose configured warehouses in the address flow." value={settings.enable_warehouse_pickup && settings.enable_warehouse_drop} onChange={(v) => { setField('enable_warehouse_pickup', v); setField('enable_warehouse_drop', v); }} />
      <ToggleRow label="Require load details" description="Weight and goods details must be completed before vehicle selection." value={settings.require_load_details} onChange={(v) => setField('require_load_details', v)} />
      <ToggleRow label="Weight-based pricing" description="Allow delivery fare logic to use shipment weight." value={settings.enable_weight_based_pricing} onChange={(v) => setField('enable_weight_based_pricing', v)} />
      <ToggleRow label="Fragile goods" description="Let customers mark careful-handling shipments." value={settings.show_fragile_toggle} onChange={(v) => setField('show_fragile_toggle', v)} />
    </Section>

    <Section title="Proof of delivery" icon={CheckCircle2}>
      <ToggleRow label="OTP verification" description="Verify the recipient before completion." value={settings.otp_delivery_verification} onChange={(v) => setField('otp_delivery_verification', v)} />
      <ToggleRow label="Digital signature" description="Capture recipient confirmation." value={settings.digital_signature} onChange={(v) => setField('digital_signature', v)} />
      <ToggleRow label="Delivery photo" description="Capture photo proof at drop-off." value={settings.delivery_photo_upload} onChange={(v) => setField('delivery_photo_upload', v)} />
    </Section>

    <Section title="Booking limits" icon={Package}>
      <div className="grid gap-4 md:grid-cols-3">{[['max_stops','Maximum stops'],['max_helpers','Maximum helpers'],['max_weight_kg','Platform max weight (kg)']].map(([key,label]) => <label key={key} className="text-xs font-black uppercase tracking-wide text-slate-500">{label}<input type="number" min="1" value={settings[key]} onChange={(e) => setField(key, Number(e.target.value))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-yellow-400" /></label>)}</div>
    </Section>
  </div>;
};

export default GoodsSettings;
