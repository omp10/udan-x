import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  UserPlus,
  Mail,
  Phone,
  MapPin,
  IndianRupee,
  Trash2,
  Edit3,
  Briefcase,
  Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getOwnerFleetDrivers,
  getOwnerFleetVehicles,
  updateOwnerFleetDriver,
} from "../../services/registrationService";
import DriverBottomNav from "../../../shared/components/DriverBottomNav";

const vehicleLabel = (vehicle = {}) =>
  [
    [vehicle.car_brand, vehicle.car_model].filter(Boolean).join(" ") ||
      vehicle.vehicle_type_name,
    vehicle.license_plate_number,
  ]
    .filter(Boolean)
    .join(" • ") || "Vehicle";

const ManageDrivers = () => {
  const navigate = useNavigate();
  const routePrefix = String(localStorage.getItem("role") || "driver").toLowerCase() === "owner"
    ? "/taxi/owner"
    : "/taxi/driver";
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingDriverId, setSavingDriverId] = useState("");

  const unwrap = (response) =>
    response?.data?.data || response?.data || response;

  const mapDriver = (item) => ({
    id: item.id || item._id,
    name: item.name || "-",
    phone: item.phone || "-",
    email: item.email || "-",
    address: item.city || "-",
    salary: Number(item.salary || 0),
    assignedVehicle: item.assignedVehicle || null,
    assignedVehicleId: String(item.assignedVehicle?.vehicleId || ""),
    // PATCH /fleet/drivers/:id rewrites zoneId from the payload, so the current
    // zone has to be echoed back or the assignment would silently clear it.
    zoneId: String(item.zone?.zoneId || ""),
    status:
      item.approve === true ||
      item.approve === 1 ||
      String(item.status || "").toLowerCase() === "approved"
        ? "Active"
        : "Pending",
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError("");

      try {
        const [driverResponse, vehicleResponse] = await Promise.all([
          getOwnerFleetDrivers(),
          getOwnerFleetVehicles().catch(() => null),
        ]);

        if (!active) return;

        setDrivers((unwrap(driverResponse)?.results || []).map(mapDriver));
        setVehicles(
          (unwrap(vehicleResponse)?.results || []).filter(
            (vehicle) => vehicle.active !== false,
          ),
        );
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load fleet drivers");
        setDrivers([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  // The backend owns the owner-scope and duplicate-assignment guards
  // (PATCH /drivers/fleet/drivers/:driverId), so a rejected change is surfaced
  // as-is rather than pre-validated here.
  const assignVehicle = async (driver, vehicleId) => {
    setSavingDriverId(driver.id);
    setError("");

    try {
      const response = await updateOwnerFleetDriver(driver.id, {
        name: driver.name,
        phone: driver.phone,
        email: driver.email === "-" ? "" : driver.email,
        salary: driver.salary,
        city: driver.address === "-" ? "" : driver.address,
        zoneId: driver.zoneId,
        assignedFleetVehicleId: vehicleId,
      });
      const updated = unwrap(response);

      setDrivers((current) =>
        current.map((item) =>
          item.id === driver.id && updated?.id ? mapDriver(updated) : item,
        ),
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not update vehicle assignment",
      );
    } finally {
      setSavingDriverId("");
    }
  };

  const deleteDriver = (id) => {
    setDrivers((d) => d.filter((item) => item.id !== id));
  };

  const activeCount = useMemo(
    () => drivers.filter((d) => d.status === "Active").length,
    [drivers],
  );

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-sans p-6 pt-10 pb-32 overflow-x-hidden">
      <header className="flex items-center gap-4 mb-8 text-slate-900 uppercase">
        <button
          onClick={() => navigate(`${routePrefix}/profile`)}
          className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-black tracking-tight tracking-tighter uppercase">
          Manage Drivers
        </h1>
      </header>

      <main className="space-y-6">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[2rem] text-white relative overflow-hidden group shadow-2xl">
          <div className="absolute top-[-30%] right-[-10%] w-48 h-48 bg-sky-500/10 rounded-full blur-3xl" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-[12px] font-black uppercase tracking-widest text-sky-500/60">
                  Total Active
                </h3>
                <p className="text-[28px] font-black tracking-tight leading-none italic">
                  {activeCount} Drivers
                </p>
                <p className="text-[11px] font-bold tracking-widest opacity-40 uppercase">
                  Managing your fleet team
                </p>
              </div>
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-sky-500 border border-white/10 shadow-lg">
                <Briefcase size={28} />
              </div>
            </div>
            <button
              onClick={() => navigate(`${routePrefix}/add-driver`)}
              className="bg-white/10 hover:bg-white/20 border border-white/10 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all">
              + Add New Driver
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">
              Team List
            </h3>
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">
              Status Overview
            </p>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="bg-white p-5 rounded-2xl border border-white shadow-sm text-[12px] font-bold text-slate-400">
                Loading drivers...
              </div>
            ) : error ? (
              <div className="bg-white p-5 rounded-2xl border border-white shadow-sm text-[12px] font-bold text-rose-500">
                {error}
              </div>
            ) : drivers.length === 0 ? (
              <div className="bg-white p-5 rounded-2xl border border-white shadow-sm text-[12px] font-bold text-slate-400">
                No drivers found.
              </div>
            ) : (
              drivers.map((d) => (
                <div
                  key={d.id}
                  className="bg-white p-5 rounded-2xl border border-white shadow-sm flex flex-col gap-4 group active:scale-98 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center border border-slate-50 transition-colors ${d.status === "Active" ? "bg-emerald-50 text-emerald-500 shadow-sm" : "bg-amber-50 text-amber-500 shadow-sm"}`}>
                        <UserPlus size={18} />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-[14px] font-black text-slate-900 leading-tight uppercase tracking-tighter">
                          {d.name}
                        </h4>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${d.status === "Active" ? "bg-emerald-500" : "bg-amber-500"}`}
                          />
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            {d.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          navigate(`${routePrefix}/edit-driver/${d.id}`, {
                            state: {
                              driver: d,
                              returnTo: `${routePrefix}/manage-drivers`,
                            },
                          })
                        }
                        className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-slate-900 transition-colors">
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => deleteDriver(d.id)}
                        className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-rose-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone size={12} strokeWidth={2.5} />
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
                        {d.phone}
                      </span>
                    </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Mail size={12} strokeWidth={2.5} />
                        <span className="text-[10px] font-bold text-slate-600 truncate">
                          {d.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <IndianRupee size={12} strokeWidth={2.5} />
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
                          Monthly Salary Rs {Number(d.salary || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="col-span-2 space-y-2">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Briefcase size={12} strokeWidth={2.5} />
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
                            {d.assignedVehicle?.number
                              ? `${d.assignedVehicle.name || "Assigned Vehicle"} ${d.assignedVehicle.number}`
                              : "No vehicle assigned"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={d.assignedVehicleId}
                            disabled={savingDriverId === d.id}
                            onChange={(event) => assignVehicle(d, event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 outline-none focus:border-slate-400 disabled:opacity-60">
                            <option value="">Unassigned</option>
                            {vehicles.map((vehicle) => {
                              const id = String(vehicle.id || vehicle._id);
                              return (
                                <option key={id} value={id}>
                                  {vehicleLabel(vehicle)}
                                </option>
                              );
                            })}
                          </select>
                          {d.assignedVehicleId ? (
                            <button
                              type="button"
                              disabled={savingDriverId === d.id}
                              onClick={() => assignVehicle(d, "")}
                              className="shrink-0 rounded-xl bg-slate-50 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-rose-500 disabled:opacity-60">
                              Unassign
                            </button>
                          ) : null}
                        </div>
                        {savingDriverId === d.id ? (
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Saving assignment...
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 col-span-2">
                        <MapPin size={12} strokeWidth={2.5} />
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
                        {d.address}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <div className="fixed bottom-24 right-6">
        <button
          onClick={() => navigate(`${routePrefix}/add-driver`)}
          className="w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center active:scale-95 transition-transform">
          <Plus size={24} strokeWidth={3} />
        </button>
      </div>

      <DriverBottomNav />
    </div>
  );
};

export default ManageDrivers;
