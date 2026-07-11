import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Check, 
  ChevronRight, 
  Loader2, 
  PackageCheck, 
  ShieldCheck, 
  Info, 
  Sparkles,
  Truck,
  Scale,
  Maximize2
} from 'lucide-react';
import api from '../../../../shared/api/axiosInstance';
import { useUserTheme } from '../../../../shared/context/UserThemeContext';

const CATEGORY_TOKENS = {
  trucks: ['truck', 'lcv', 'hcv', 'mcv', 'loader', 'pickup', 'ace'],
  '2wheeler': ['bike', 'scooter', 'cycle', '2wheel', 'two-wheeler'],
  auto: ['auto', 'rickshaw', 'three wheeler', 'three-wheeler'],
  movers: ['mover', 'truck', 'lcv', 'pickup', 'packers'],
};

const readWeightKg = (value) => {
  const text = String(value || '').toLowerCase();
  if (text.includes('under 5')) return 5;
  if (text.includes('5kg - 20') || text.includes('5 kg - 20')) return 20;
  if (text.includes('20kg - 100') || text.includes('20 kg - 100')) return 100;
  if (text.includes('100kg - 500') || text.includes('100 kg - 500')) return 500;
  if (text.includes('above 500')) return 1500;
  const numeric = Number(text.replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
};

const compatibleCategory = (vehicle, category) => {
  const configured = String(vehicle?.delivery_category || '').trim().toLowerCase();
  if (configured) return configured === category;
  const haystack = `${vehicle?.name || ''} ${vehicle?.icon_types || ''}`.toLowerCase();
  return (CATEGORY_TOKENS[category] || []).some((token) => haystack.includes(token));
};

const estimateFare = (vehicle, distanceKm, helperCharge = 0) => {
  const pricing = vehicle?.delivery_distance_pricing || {};
  const base = Number(pricing.base_price || 0);
  const included = Number(pricing.base_distance ?? pricing.free_distance ?? 0);
  const perKm = Number(pricing.distance_price || 0);
  
  const distanceFare = base + Math.max(Number(distanceKm || 0) - included, 0) * perKm;
  const subtotal = distanceFare + helperCharge;
  const tax = subtotal * (Number(vehicle?.service_tax || 0) / 100);
  return Math.round((subtotal + tax) * 100) / 100;
};

const ParcelVehicleSelect = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useUserTheme();
  const isDark = theme === 'dark';
  
  const booking = location.state || {};
  const routePrefix = location.pathname.startsWith('/taxi/user') ? '/taxi/user' : '';
  
  const [vehicles, setVehicles] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  
  const parcelWeightStr = booking?.parcel?.weight || booking.goodsWeight || booking.weight || 'Under 5kg';
  const weightKg = Number(booking?.parcel?.maxWeightKg || booking?.maxWeightKg || 0) || readWeightKg(parcelWeightStr);
  const category = String(booking?.parcel?.deliveryCategory || booking.deliveryCategory || booking.category || '').toLowerCase();
  
  const helperCharge = Number(booking?.estimatedFare?.helperCharge || booking?.parcel?.loadingCharge || 0) + Number(booking?.parcel?.unloadingCharge || 0);

  useEffect(() => {
    let active = true;
    
    const fetchVehicles = async () => {
      try {
        setLoading(true);
        const response = await api.get('/users/vehicle-types', {
          params: {
            transport_type: 'delivery',
            min_capacity: weightKg > 0 ? weightKg : undefined,
            delivery_category: category || undefined,
          },
        });
        const payload = response?.data?.data || response?.data || {};
        const items = payload.results || (Array.isArray(payload) ? payload : []);
        
        if (active) {
          // Filter to delivery active vehicles
          const deliveryList = items.filter(
            (item) => 
              item.active !== false && 
              Number(item.status ?? 1) !== 0 && 
              ['delivery', 'both'].includes(String(item.transport_type).toLowerCase())
          );
          setVehicles(deliveryList);
        }
      } catch (err) {
        console.error('Failed to load vehicle types:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    
    fetchVehicles();
    return () => {
      active = false;
    };
  }, [category, weightKg]);

  const compatible = useMemo(() => {
    return vehicles
      .filter((vehicle) => {
        const capacity = Number(vehicle.capacity || 0);
        // If capacity is 0, treat it as unlimited/compatible fallback
        const supportsWeight = capacity <= 0 || capacity >= weightKg;
        const supportsCategory = !category || compatibleCategory(vehicle, category);
        return supportsWeight && supportsCategory;
      })
      .sort((a, b) => {
        // Sort by capacity ascend to suggest the smallest fitting vehicle first
        return Number(a.capacity || 99999) - Number(b.capacity || 99999);
      });
  }, [category, vehicles, weightKg]);

  useEffect(() => {
    if (!selectedId && compatible[0]) {
      setSelectedId(String(compatible[0]._id || compatible[0].id));
    }
  }, [compatible, selectedId]);

  const proceed = () => {
    const selected = compatible.find((item) => String(item._id || item.id) === selectedId);
    if (!selected) return;
    
    const fare = estimateFare(selected, booking.estimatedDistanceKm || 0, helperCharge);
    
    const updatedState = {
      ...booking,
      selectedVehicle: selected,
      selectedVehicles: [selected],
      selectedVehicleId: selected._id || selected.id,
      selectedVehicleIds: [selected._id || selected.id],
      vehicleTypeId: selected._id || selected.id,
      vehicleTypeIds: [selected._id || selected.id],
      fare: fare || booking.fare,
      searchNonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };

    if (booking.estimatedFare) {
      updatedState.estimatedFare = {
        ...booking.estimatedFare,
        approx: Math.round(fare),
        min: fare,
        max: fare,
        subtotal: fare - (fare * (selected.service_tax || 0) / (100 + (selected.service_tax || 0))),
      };
    }

    navigate(`${routePrefix}/parcel/searching`, { state: updatedState });
  };

  return (
    <div className={`min-h-screen w-full max-w-lg mx-auto flex flex-col font-sans relative overflow-x-hidden ${isDark ? 'bg-[#05070D]' : 'bg-[#F5F8FF]'}`}>
      
      {/* Sticky Header */}
      <header className={`sticky top-0 z-30 flex items-center gap-4 border-b px-6 py-4 backdrop-blur-md transition-colors ${
        isDark ? 'bg-[#090D16]/90 border-zinc-800/80 text-white' : 'bg-white/95 border-slate-100 text-slate-800'
      }`}>
        <button 
          onClick={() => navigate(-1)} 
          className={`flex h-10 w-10 items-center justify-center rounded-full border transition active:scale-95 ${
            isDark ? 'border-zinc-850 bg-zinc-900/60 hover:bg-zinc-800 text-white' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
          }`}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Step 3 of 3</p>
          <h1 className="text-base font-black">Choose delivery vehicle</h1>
        </div>
      </header>

      <main className="flex-1 p-5 space-y-5 pb-28">
        
        {/* Requirement Summary Card */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[24px] p-4 flex items-center gap-4 shadow-sm border ${
            isDark ? 'bg-[#111827] border-zinc-850 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}
        >
          <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
            isDark ? 'bg-yellow-400/10 text-yellow-400' : 'bg-yellow-50 text-yellow-600'
          }`}>
            <PackageCheck size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Shipment Weight Class</p>
            <p className="text-sm font-black mt-0.5 truncate">
              {`${parcelWeightStr} | ${booking.parcelType || booking?.parcel?.category || booking?.selectedGoodsType?.name || 'General Cargo'}`}
            </p>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin text-yellow-500" size={32} />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Scanning compatible fleet...</p>
          </div>
        ) : compatible.length > 0 ? (
          <div className="space-y-3">
            {compatible.map((vehicle, idx) => {
              const id = String(vehicle._id || vehicle.id);
              const isSelected = selectedId === id;
              const fare = estimateFare(vehicle, booking.estimatedDistanceKm || 0, helperCharge);
              
              return (
                <motion.button
                  key={id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  onClick={() => setSelectedId(id)}
                  className={`w-full rounded-[28px] border-2 p-4 text-left transition-all duration-300 relative overflow-hidden group ${
                    isSelected
                      ? (isDark ? 'border-yellow-400 bg-yellow-950/10' : 'border-yellow-400 bg-yellow-50/30 ring-4 ring-yellow-100')
                      : (isDark ? 'border-zinc-850 bg-[#111827] hover:border-zinc-800' : 'border-transparent bg-white shadow-sm hover:shadow-md')
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Vehicle Image */}
                    <div className={`h-16 w-20 rounded-2xl flex items-center justify-center p-1 shrink-0 ${
                      isDark ? 'bg-zinc-900/60' : 'bg-slate-50'
                    }`}>
                      <img 
                        src={vehicle.image || vehicle.icon || vehicle.map_icon} 
                        alt={vehicle.name} 
                        className="h-12 w-16 object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105" 
                      />
                    </div>

                    {/* Specifications */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-[15px] font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {vehicle.name}
                        </p>
                        {idx === 0 && (
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black tracking-wide ${
                            isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            BEST MATCH
                          </span>
                        )}
                      </div>

                      {/* Weight and Capacity details */}
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] font-bold text-slate-400">
                        <span className="flex items-center gap-1">
                          <Scale size={11} /> Max {Number(vehicle.capacity || 0)} kg
                        </span>
                        {vehicle.size && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-zinc-700 shrink-0" />
                            <span className="flex items-center gap-1">
                              <Maximize2 size={11} /> {vehicle.size}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Pricing Info */}
                      <p className={`mt-2 text-base font-black ${isDark ? 'text-yellow-400' : 'text-slate-900'}`}>
                        {fare > 0 ? `₹${Math.round(fare)}` : 'Fare pending'}
                      </p>
                    </div>

                    {/* Radio Selector */}
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 border transition-all ${
                      isSelected 
                        ? 'border-yellow-450 bg-yellow-400 text-black' 
                        : (isDark ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-white')
                    }`}>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                  </div>

                  {/* Expandable pricing breakdown detail */}
                  {isSelected && (
                    <div className={`mt-3.5 pt-3 border-t text-[11px] font-bold space-y-1.5 ${
                      isDark ? 'border-zinc-850 text-slate-400' : 'border-slate-100 text-slate-500'
                    }`}>
                      <div className="flex justify-between">
                        <span>Distance Base Charge:</span>
                        <span>₹{vehicle.delivery_distance_pricing?.base_price || 0} (covers first {vehicle.delivery_distance_pricing?.free_distance ?? vehicle.delivery_distance_pricing?.base_distance ?? 0} km)</span>
                      </div>
                      {helperCharge > 0 && (
                        <div className="flex justify-between text-yellow-600 dark:text-yellow-450">
                          <span>Helper Labour Charge:</span>
                          <span>+ ₹{helperCharge}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Tax & Regulatory Fees:</span>
                        <span>+ {vehicle.service_tax || 0}%</span>
                      </div>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-[28px] border p-6 text-center ${
              isDark ? 'border-zinc-850 bg-[#111827] text-white' : 'border-orange-100 bg-orange-50/40 text-slate-800'
            }`}
          >
            <ShieldCheck className="mx-auto text-orange-500" size={36} />
            <h2 className="mt-3 font-black text-base">No compatible vehicle configured</h2>
            <p className="mt-2 text-xs font-semibold text-slate-400 leading-relaxed">
              The weight limit exceeds all configured delivery vehicles on the platform. Try adjusting the weight band.
            </p>
            <button 
              onClick={() => navigate(-2)} 
              className="mt-5 rounded-2xl bg-slate-900 dark:bg-white dark:text-slate-950 px-5 py-3 text-xs font-black text-white active:scale-95 transition-transform"
            >
              Adjust weight category
            </button>
          </motion.div>
        )}
      </main>

      {/* Sticky Proceed Button Bar */}
      {compatible.length > 0 && (
        <div className={`fixed bottom-0 left-0 right-0 z-30 p-5 ${
          isDark ? 'bg-gradient-to-t from-[#05070D] via-[#05070D]/95 to-transparent' : 'bg-gradient-to-t from-[#F5F8FF] via-[#F5F8FF]/95 to-transparent'
        }`}>
          <div className="mx-auto max-w-lg">
            <button 
              onClick={proceed} 
              disabled={!selectedId} 
              className="flex h-16 w-full items-center justify-center gap-2 rounded-[24px] bg-slate-900 text-sm font-black text-white shadow-xl hover:bg-slate-800 transition disabled:opacity-50 active:scale-98"
            >
              <span>Confirm & Book</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ParcelVehicleSelect;
