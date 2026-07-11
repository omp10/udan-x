import React, { useEffect, useRef, useState } from 'react';
import {
  Save,
  Upload,
  Loader2,
  ChevronRight,
  Paintbrush,
  Image,
  Smartphone,
  Type,
  RefreshCw,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings } from '../../../../shared/context/SettingsContext';
import { adminService } from '../../services/adminService';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100';
const labelClass = 'mb-1.5 block text-[12px] font-bold uppercase tracking-wide text-slate-500';

const SectionCard = ({ title, subtitle, icon: Icon, children, accent = 'yellow' }) => {
  const accents = {
    yellow: 'bg-yellow-100 text-yellow-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${accents[accent]}`}>
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
};

const ColorPicker = ({ label, description, value, onChange }) => (
  <div>
    <label className={labelClass}>{label}</label>
    <div className="flex items-center gap-3">
      <div className="relative">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-12 cursor-pointer rounded-xl border border-slate-200 p-0.5"
        />
      </div>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#RRGGBB"
        maxLength={7}
        className={`${inputClass} font-mono uppercase`}
      />
    </div>
    {description && (
      <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1">
        <Info size={11} /> {description}
      </p>
    )}
  </div>
);

const LogoUploader = ({ label, description, currentUrl, onFile, preview }) => {
  const fileRef = useRef(null);

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div
        className="relative cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition-all hover:border-yellow-400 hover:bg-yellow-50"
        onClick={() => fileRef.current?.click()}
      >
        {preview || currentUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={preview || currentUrl}
              alt={label}
              className="h-20 max-w-[200px] rounded-xl object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <p className="text-xs font-bold text-yellow-600">Click to change</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-slate-200 flex items-center justify-center">
              <Upload size={22} className="text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Click to upload</p>
              <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, SVG (max 2MB)</p>
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] || null)}
        />
      </div>
      {description && <p className="mt-1.5 text-xs text-slate-400">{description}</p>}
    </div>
  );
};

const defaultBranding = {
  app_name: '',
  tagline: '',
  logo_light: '',
  logo_dark: '',
  app_icon: '',
  favicon: '',
  primary_color: '#FFC400',
  secondary_color: '#0F172A',
  accent_color: '#3B82F6',
  admin_theme_color: '#405189',
  sidebar_text_color: '#475569',
  app_logo_alt: '',
};

const AppBranding = () => {
  const { settings, reloadSettings } = useSettings();
  const [branding, setBranding] = useState(defaultBranding);
  const [previews, setPreviews] = useState({});
  const [fileUploads, setFileUploads] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadBranding = async () => {
      try {
        setLoading(true);
        const res = await adminService.getGeneralSettings?.().catch(() => null);
        const cust = res?.data?.customization || res?.data || {};
        const general = res?.data?.general || {};

        setBranding((prev) => ({
          ...prev,
          app_name: general.app_name || settings?.general?.app_name || '',
          tagline: general.tagline || settings?.general?.tagline || '',
          logo_light: cust.logo_light || cust.app_logo || settings?.customization?.app_logo || '',
          logo_dark: cust.logo_dark || settings?.customization?.logo_dark || '',
          app_icon: cust.app_icon || settings?.customization?.app_icon || '',
          favicon: cust.favicon || settings?.customization?.favicon || '',
          primary_color: cust.primary_color || settings?.customization?.primary_color || '#FFC400',
          secondary_color: cust.secondary_color || settings?.customization?.secondary_color || '#0F172A',
          accent_color: cust.accent_color || settings?.customization?.accent_color || '#3B82F6',
          admin_theme_color: cust.admin_theme_color || settings?.customization?.admin_theme_color || '#405189',
          sidebar_text_color: cust.sidebar_text_color || settings?.customization?.sidebar_text_color || '#475569',
          app_logo_alt: cust.app_logo_alt || '',
        }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadBranding();
  }, []);

  const setField = (key, value) => setBranding((prev) => ({ ...prev, [key]: value }));

  const handleFile = (key, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreviews((prev) => ({ ...prev, [key]: reader.result }));
    };
    reader.readAsDataURL(file);
    setFileUploads((prev) => ({ ...prev, [key]: file }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // If there are file uploads, handle them via FormData
      const hasFiles = Object.keys(fileUploads).length > 0;
      if (hasFiles) {
        const formData = new FormData();
        Object.entries(fileUploads).forEach(([key, file]) => {
          formData.append(key, file);
        });
        Object.entries(branding).forEach(([key, value]) => {
          if (typeof value === 'string') formData.append(key, value);
        });
        await adminService.updateBrandingWithFiles?.(formData) ??
          adminService.updateCustomizationSettings?.({ ...branding });
      } else {
        await adminService.updateCustomizationSettings?.({ ...branding }) ??
          adminService.updateGeneralSettings?.({ general: { app_name: branding.app_name, tagline: branding.tagline }, customization: branding });
      }

      toast.success('Branding settings saved successfully');
      reloadSettings?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Settings</span>
            <ChevronRight size={12} />
            <span>Business Settings</span>
            <ChevronRight size={12} />
            <span className="font-semibold text-slate-700">App Branding</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">App Branding & Logo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your app name, logos, icons, and brand color palette.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-black text-black shadow-md hover:bg-yellow-500 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Branding'}
        </button>
      </div>

      {/* App Identity */}
      <SectionCard title="App Identity" subtitle="Your app's name, tagline, and alt text" icon={Type} accent="yellow">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className={labelClass}>App Name *</label>
            <input
              value={branding.app_name}
              onChange={(e) => setField('app_name', e.target.value)}
              placeholder="e.g. Udaan-X"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Tagline / Slogan</label>
            <input
              value={branding.tagline}
              onChange={(e) => setField('tagline', e.target.value)}
              placeholder="e.g. Your city, your ride"
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Logo Alt Text (for accessibility)</label>
            <input
              value={branding.app_logo_alt}
              onChange={(e) => setField('app_logo_alt', e.target.value)}
              placeholder="Descriptive text for your logo"
              className={inputClass}
            />
          </div>
        </div>
      </SectionCard>

      {/* Logos */}
      <SectionCard title="Logos & Icons" subtitle="Upload light mode logo, dark mode logo, app icon, and favicon" icon={Image} accent="blue">
        <div className="grid gap-6 md:grid-cols-2">
          <LogoUploader
            label="Light Mode Logo"
            description="Used on white/light backgrounds. Recommended: PNG with transparency, 300×100px"
            currentUrl={branding.logo_light}
            preview={previews.logo_light}
            onFile={(file) => handleFile('logo_light', file)}
          />
          <LogoUploader
            label="Dark Mode Logo"
            description="Used on dark backgrounds. Recommended: PNG with transparency, 300×100px"
            currentUrl={branding.logo_dark}
            preview={previews.logo_dark}
            onFile={(file) => handleFile('logo_dark', file)}
          />
          <LogoUploader
            label="App Icon"
            description="Square icon for mobile app. Recommended: 512×512px PNG"
            currentUrl={branding.app_icon}
            preview={previews.app_icon}
            onFile={(file) => handleFile('app_icon', file)}
          />
          <LogoUploader
            label="Favicon"
            description="Browser tab icon. Recommended: 32×32px ICO or PNG"
            currentUrl={branding.favicon}
            preview={previews.favicon}
            onFile={(file) => handleFile('favicon', file)}
          />
        </div>
      </SectionCard>

      {/* Brand Colors */}
      <SectionCard title="Brand Colors" subtitle="Define the core color palette used across your app" icon={Paintbrush} accent="purple">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <ColorPicker
            label="Primary Color"
            description="Main action buttons, highlights (CTA elements)"
            value={branding.primary_color}
            onChange={(v) => setField('primary_color', v)}
          />
          <ColorPicker
            label="Secondary Color"
            description="Text, backgrounds, secondary elements"
            value={branding.secondary_color}
            onChange={(v) => setField('secondary_color', v)}
          />
          <ColorPicker
            label="Accent Color"
            description="Links, badges, secondary buttons"
            value={branding.accent_color}
            onChange={(v) => setField('accent_color', v)}
          />
          <ColorPicker
            label="Admin Theme Color"
            description="Admin panel sidebar and header background"
            value={branding.admin_theme_color}
            onChange={(v) => setField('admin_theme_color', v)}
          />
          <ColorPicker
            label="Sidebar Text Color"
            description="Text color for admin sidebar nav items"
            value={branding.sidebar_text_color}
            onChange={(v) => setField('sidebar_text_color', v)}
          />
        </div>

        {/* Color Preview */}
        <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ backgroundColor: branding.admin_theme_color || '#405189' }}
          >
            <span className="text-sm font-black" style={{ color: branding.sidebar_text_color || '#fff' }}>
              {branding.app_name || 'App'} Admin
            </span>
            <div
              className="rounded-lg px-3 py-1.5 text-xs font-black"
              style={{ backgroundColor: branding.primary_color || '#FFC400', color: branding.secondary_color || '#0F172A' }}
            >
              Preview Button
            </div>
          </div>
          <div className="bg-white px-5 py-4">
            <p className="text-xs text-slate-400">
              <Info size={11} className="inline mr-1" />
              Color preview — how your brand colors appear on the admin sidebar
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Save Footer */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <CheckCircle2 size={16} className="text-emerald-500" />
          Changes take effect immediately after saving and refreshing the app
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-black text-white shadow-md hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Branding'}
        </button>
      </div>
    </div>
  );
};

export default AppBranding;
