// Fleet-owner reporting, shipment monitoring, payout requests and vehicle
// document-compliance endpoints. Kept out of driverController.js (already ~10k
// lines) so the owner surface is readable on its own.
//
// Scoping rule used everywhere here: a ride belongs to an owner when it was run
// by one of the owner's drivers (Ride.driverId in the owner's driver ids) or when
// settlement already stamped Ride.ownerId. Both are matched so pre-settlement and
// post-settlement rows are visible.
import mongoose from "mongoose";
import ExcelJS from "exceljs";

import { ApiError } from "../../../../utils/ApiError.js";
import { Driver } from "../models/Driver.js";
import { Owner } from "../../admin/models/Owner.js";
import { FleetVehicle } from "../../admin/models/FleetVehicle.js";
import { OwnerWalletTransaction } from "../../admin/models/OwnerWalletTransaction.js";
import { WithdrawalRequest } from "../../admin/models/WithdrawalRequest.js";
import { Ride } from "../../user/models/Ride.js";
import { RIDE_STATUS } from "../../constants/index.js";
import { getWalletSettings } from "../../services/appSettingsService.js";

const REPORT_TIMEZONE = "Asia/Kolkata";
const MAX_BUCKET_DAYS = 366;
const MAX_EXPORT_ROWS = 5000;
const DOCUMENT_EXPIRY_WARN_DAYS = 30;

const isTruthyFlag = (value) =>
  ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

/* ------------------------------------------------------------------ *
 * Pure helpers (unit tested in ownerReportsController.test.js)
 * ------------------------------------------------------------------ */

// Normalises ?from/?to/?groupBy into a half-open [start, end) window.
// Defaults to the last 30 days (day buckets) / last 12 months (month buckets),
// and clamps the window so one request can never fan out past MAX_BUCKET_DAYS.
export const resolveReportRange = ({ from, to, groupBy } = {}, now = new Date()) => {
  const mode = String(groupBy || "day").trim().toLowerCase() === "month" ? "month" : "day";

  const parse = (value) => {
    if (!value) return null;
    const parsed = new Date(String(value).length <= 10 ? `${value}T00:00:00.000Z` : value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const parsedTo = parse(to);
  const parsedFrom = parse(from);

  // End is exclusive: an inclusive ?to=2026-07-25 must cover that whole day.
  const end = parsedTo ? new Date(parsedTo.getTime() + 24 * 60 * 60 * 1000) : new Date(now);
  const defaultSpanMs = (mode === "month" ? 365 : 30) * 24 * 60 * 60 * 1000;
  let start = parsedFrom || new Date(end.getTime() - defaultSpanMs);

  if (start.getTime() >= end.getTime()) {
    start = new Date(end.getTime() - defaultSpanMs);
  }

  const maxSpanMs = MAX_BUCKET_DAYS * 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > maxSpanMs) {
    start = new Date(end.getTime() - maxSpanMs);
  }

  return {
    start,
    end,
    groupBy: mode,
    format: mode === "month" ? "%Y-%m" : "%Y-%m-%d",
  };
};

// Folds aggregate bucket rows into report totals. Bucket count is bounded by
// resolveReportRange, so this stays a fixed-size fold rather than a scan.
export const summarizeBuckets = (buckets = []) => {
  const totals = buckets.reduce(
    (acc, bucket) => ({
      trips: acc.trips + Number(bucket.trips || 0),
      completedTrips: acc.completedTrips + Number(bucket.completedTrips || 0),
      cancelledTrips: acc.cancelledTrips + Number(bucket.cancelledTrips || 0),
      grossRevenue: acc.grossRevenue + Number(bucket.grossRevenue || 0),
      ownerEarnings: acc.ownerEarnings + Number(bucket.ownerEarnings || 0),
      commission: acc.commission + Number(bucket.commission || 0),
      cashTrips: acc.cashTrips + Number(bucket.cashTrips || 0),
      onlineTrips: acc.onlineTrips + Number(bucket.onlineTrips || 0),
      unsettledTrips: acc.unsettledTrips + Number(bucket.unsettledTrips || 0),
      unsettledGross: acc.unsettledGross + Number(bucket.unsettledGross || 0),
    }),
    {
      trips: 0,
      completedTrips: 0,
      cancelledTrips: 0,
      grossRevenue: 0,
      ownerEarnings: 0,
      commission: 0,
      cashTrips: 0,
      onlineTrips: 0,
      unsettledTrips: 0,
      unsettledGross: 0,
    },
  );

  return {
    ...totals,
    grossRevenue: round2(totals.grossRevenue),
    ownerEarnings: round2(totals.ownerEarnings),
    commission: round2(totals.commission),
    unsettledGross: round2(totals.unsettledGross),
    averageOwnerEarningsPerTrip: totals.completedTrips
      ? round2(totals.ownerEarnings / totals.completedTrips)
      : 0,
    averageFare: totals.completedTrips
      ? round2(totals.grossRevenue / totals.completedTrips)
      : 0,
  };
};

// Expiry tracking for insurance / RC / permit documents. FleetVehicle has no
// typed expiry column (see report), so the date lives on the document entry in
// the Mixed `documents` map and the flags are derived here.
export const expiryStatus = (value, { now = new Date(), warnDays = DOCUMENT_EXPIRY_WARN_DAYS } = {}) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return { expiryDate: "", daysRemaining: null, expired: false, expiringSoon: false };
  }

  const parsed = new Date(raw.length <= 10 ? `${raw}T00:00:00.000Z` : raw);
  if (Number.isNaN(parsed.getTime())) {
    return { expiryDate: "", daysRemaining: null, expired: false, expiringSoon: false };
  }

  const startOfDay = (date) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const daysRemaining = Math.round(
    (startOfDay(parsed) - startOfDay(new Date(now))) / (24 * 60 * 60 * 1000),
  );

  return {
    expiryDate: parsed.toISOString().slice(0, 10),
    daysRemaining,
    expired: daysRemaining < 0,
    expiringSoon: daysRemaining >= 0 && daysRemaining <= warnDays,
  };
};

/* ------------------------------------------------------------------ *
 * Shared internals
 * ------------------------------------------------------------------ */

const resolveOwner = async (req) => {
  if (String(req.auth?.role || "").toLowerCase() !== "owner") {
    throw new ApiError(403, "This report is only available for owner accounts");
  }

  const owner = await Owner.findById(req.auth?.sub)
    .select(
      "name company_name owner_name mobile phone email city transport_type service_location_id active approve status wallet bank_name ifsc account_no",
    )
    .lean();

  if (!owner || owner.active === false) {
    throw new ApiError(403, "Owner account is not active");
  }

  return owner;
};

// Owner drivers + their vehicle assignment, in one read. Fleet size is bounded by
// the owner's roster, so this map is safe to build in JS.
const loadFleetIndex = async (ownerId) => {
  const [drivers, vehicles] = await Promise.all([
    Driver.find({ owner_id: ownerId, deletedAt: null })
      .select("name phone assignedFleetVehicleId")
      .lean(),
    FleetVehicle.find({ owner_id: ownerId })
      .select("car_brand car_model license_plate_number transport_type status active documents")
      .lean(),
  ]);

  const vehicleById = new Map(vehicles.map((vehicle) => [String(vehicle._id), vehicle]));
  const driverById = new Map(
    drivers.map((driver) => [
      String(driver._id),
      {
        id: String(driver._id),
        name: driver.name || "",
        phone: driver.phone || "",
        vehicleId: driver.assignedFleetVehicleId
          ? String(driver.assignedFleetVehicleId)
          : "",
      },
    ]),
  );

  return {
    drivers,
    vehicles,
    driverIds: drivers.map((driver) => driver._id),
    driverById,
    vehicleById,
  };
};

const vehicleLabel = (vehicle) =>
  vehicle
    ? [
        [vehicle.car_brand, vehicle.car_model].filter(Boolean).join(" "),
        vehicle.license_plate_number,
      ]
        .filter(Boolean)
        .join(" • ")
    : "Unassigned";

const ownerRideMatch = ({ ownerId, driverIds, start, end, serviceType }) => {
  const match = {
    createdAt: { $gte: start, $lt: end },
    $or: [{ ownerId }, ...(driverIds.length ? [{ driverId: { $in: driverIds } }] : [])],
  };

  if (serviceType) {
    match.serviceType = serviceType;
  }

  return match;
};

// One shared set of accumulators so day buckets, driver rows and vehicle rows are
// always the same numbers. `ownerEarnings` is only what settlement actually
// credited; unsettled completed fares are reported separately instead of being
// re-derived from commission config (which would drift from walletService).
const METRIC_ACCUMULATORS = {
  trips: { $sum: 1 },
  completedTrips: {
    $sum: { $cond: [{ $eq: ["$status", RIDE_STATUS.COMPLETED] }, 1, 0] },
  },
  cancelledTrips: {
    $sum: { $cond: [{ $eq: ["$status", RIDE_STATUS.CANCELLED] }, 1, 0] },
  },
  grossRevenue: {
    $sum: {
      $cond: [
        { $eq: ["$status", RIDE_STATUS.COMPLETED] },
        { $ifNull: ["$fare", 0] },
        0,
      ],
    },
  },
  ownerEarnings: {
    $sum: {
      $cond: [{ $ifNull: ["$ownerSettledAt", false] }, { $ifNull: ["$ownerEarnings", 0] }, 0],
    },
  },
  commission: {
    $sum: {
      $cond: [
        { $eq: ["$status", RIDE_STATUS.COMPLETED] },
        { $ifNull: ["$commissionAmount", 0] },
        0,
      ],
    },
  },
  cashTrips: { $sum: { $cond: [{ $eq: ["$paymentMethod", "cash"] }, 1, 0] } },
  onlineTrips: { $sum: { $cond: [{ $eq: ["$paymentMethod", "online"] }, 1, 0] } },
  unsettledTrips: {
    $sum: {
      $cond: [
        {
          $and: [
            { $eq: ["$status", RIDE_STATUS.COMPLETED] },
            { $not: [{ $ifNull: ["$ownerSettledAt", false] }] },
          ],
        },
        1,
        0,
      ],
    },
  },
  unsettledGross: {
    $sum: {
      $cond: [
        {
          $and: [
            { $eq: ["$status", RIDE_STATUS.COMPLETED] },
            { $not: [{ $ifNull: ["$ownerSettledAt", false] }] },
          ],
        },
        { $ifNull: ["$fare", 0] },
        0,
      ],
    },
  },
};

const normalizeMetricRow = (row = {}) => ({
  trips: Number(row.trips || 0),
  completedTrips: Number(row.completedTrips || 0),
  cancelledTrips: Number(row.cancelledTrips || 0),
  grossRevenue: round2(row.grossRevenue),
  ownerEarnings: round2(row.ownerEarnings),
  commission: round2(row.commission),
  cashTrips: Number(row.cashTrips || 0),
  onlineTrips: Number(row.onlineTrips || 0),
  unsettledTrips: Number(row.unsettledTrips || 0),
  unsettledGross: round2(row.unsettledGross),
});

// Driver rows folded onto their assigned vehicle. Rides carry no vehicle
// reference, so Driver.assignedFleetVehicleId is the only available link.
const foldDriverRowsToVehicles = (driverRows, fleet) => {
  const byVehicle = new Map();

  for (const row of driverRows) {
    const driver = fleet.driverById.get(row.driverId);
    const vehicleId = driver?.vehicleId || "";
    const key = vehicleId || "unassigned";
    const existing =
      byVehicle.get(key) ||
      {
        vehicleId,
        label: vehicleLabel(fleet.vehicleById.get(vehicleId)),
        number: fleet.vehicleById.get(vehicleId)?.license_plate_number || "",
        transportType: fleet.vehicleById.get(vehicleId)?.transport_type || "",
        driverCount: 0,
        ...normalizeMetricRow({}),
      };

    byVehicle.set(key, {
      ...existing,
      driverCount: existing.driverCount + 1,
      trips: existing.trips + row.trips,
      completedTrips: existing.completedTrips + row.completedTrips,
      cancelledTrips: existing.cancelledTrips + row.cancelledTrips,
      grossRevenue: round2(existing.grossRevenue + row.grossRevenue),
      ownerEarnings: round2(existing.ownerEarnings + row.ownerEarnings),
      commission: round2(existing.commission + row.commission),
      cashTrips: existing.cashTrips + row.cashTrips,
      onlineTrips: existing.onlineTrips + row.onlineTrips,
      unsettledTrips: existing.unsettledTrips + row.unsettledTrips,
      unsettledGross: round2(existing.unsettledGross + row.unsettledGross),
    });
  }

  return [...byVehicle.values()].sort((a, b) => b.ownerEarnings - a.ownerEarnings);
};

const runOwnerEarningsReport = async ({ owner, query, serviceType = null }) => {
  const range = resolveReportRange(query);
  const fleet = await loadFleetIndex(owner._id);
  const match = ownerRideMatch({
    ownerId: owner._id,
    driverIds: fleet.driverIds,
    start: range.start,
    end: range.end,
    serviceType,
  });

  const [bucketRows, driverRows] = await Promise.all([
    Ride.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: {
              format: range.format,
              date: "$createdAt",
              timezone: REPORT_TIMEZONE,
            },
          },
          ...METRIC_ACCUMULATORS,
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Ride.aggregate([
      { $match: match },
      { $group: { _id: "$driverId", ...METRIC_ACCUMULATORS } },
      { $sort: { ownerEarnings: -1 } },
    ]),
  ]);

  const buckets = bucketRows.map((row) => ({
    key: String(row._id || ""),
    ...normalizeMetricRow(row),
  }));

  const byDriver = driverRows.map((row) => {
    const driverId = row._id ? String(row._id) : "";
    const driver = fleet.driverById.get(driverId);
    return {
      driverId,
      name: driver?.name || "Unassigned driver",
      phone: driver?.phone || "",
      vehicle: vehicleLabel(fleet.vehicleById.get(driver?.vehicleId || "")),
      ...normalizeMetricRow(row),
    };
  });

  return {
    range: {
      from: range.start.toISOString().slice(0, 10),
      to: new Date(range.end.getTime() - 1).toISOString().slice(0, 10),
      groupBy: range.groupBy,
      timezone: REPORT_TIMEZONE,
    },
    totals: summarizeBuckets(buckets),
    buckets,
    byDriver,
    byVehicle: foldDriverRowsToVehicles(byDriver, fleet),
    fleetSize: { drivers: fleet.drivers.length, vehicles: fleet.vehicles.length },
  };
};

/* ------------------------------------------------------------------ *
 * GET /api/drivers/fleet/earnings
 * ------------------------------------------------------------------ */

export const getOwnerEarningsReport = async (req, res) => {
  const owner = await resolveOwner(req);
  const report = await runOwnerEarningsReport({ owner, query: req.query });

  res.json({
    success: true,
    data: {
      ...report,
      walletBalance: round2(owner.wallet?.balance),
    },
  });
};

/* ------------------------------------------------------------------ *
 * GET /api/drivers/fleet/shipments
 * ------------------------------------------------------------------ */

export const getOwnerShipmentReport = async (req, res) => {
  const owner = await resolveOwner(req);
  const range = resolveReportRange(req.query);
  const fleet = await loadFleetIndex(owner._id);
  const match = ownerRideMatch({
    ownerId: owner._id,
    driverIds: fleet.driverIds,
    start: range.start,
    end: range.end,
    serviceType: "parcel",
  });

  const requestedStatus = String(req.query?.status || "").trim().toLowerCase();
  const recentMatch = requestedStatus ? { ...match, status: requestedStatus } : match;
  const limit = Math.min(Math.max(Number(req.query?.limit) || 25, 1), 100);

  const [report, categoryRows, weightRow, recentDocs] = await Promise.all([
    runOwnerEarningsReport({ owner, query: req.query, serviceType: "parcel" }),
    Ride.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ["$parcel.category", "uncategorised"] },
          shipments: { $sum: 1 },
          delivered: {
            $sum: { $cond: [{ $eq: ["$status", RIDE_STATUS.COMPLETED] }, 1, 0] },
          },
          weightKg: { $sum: { $ifNull: ["$parcel.weightKg", 0] } },
          revenue: {
            $sum: {
              $cond: [
                { $eq: ["$status", RIDE_STATUS.COMPLETED] },
                { $ifNull: ["$fare", 0] },
                0,
              ],
            },
          },
        },
      },
      { $sort: { shipments: -1 } },
    ]),
    Ride.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalWeightKg: { $sum: { $ifNull: ["$parcel.weightKg", 0] } },
          totalPackages: { $sum: { $ifNull: ["$parcel.packageCount", 0] } },
          fragileShipments: { $sum: { $cond: ["$parcel.isFragile", 1, 0] } },
          outstationShipments: { $sum: { $cond: ["$parcel.isOutstation", 1, 0] } },
          inTransit: {
            $sum: {
              $cond: [
                { $in: ["$status", [RIDE_STATUS.ACCEPTED, RIDE_STATUS.ONGOING]] },
                1,
                0,
              ],
            },
          },
          awaitingPickup: {
            $sum: { $cond: [{ $eq: ["$status", RIDE_STATUS.SEARCHING] }, 1, 0] },
          },
        },
      },
    ]),
    Ride.find(recentMatch)
      .select(
        "pickupAddress dropAddress status liveStatus fare driverEarnings ownerEarnings paymentMethod parcel createdAt completedAt driverId",
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const weight = weightRow[0] || {};

  res.json({
    success: true,
    data: {
      range: report.range,
      totals: {
        ...report.totals,
        totalWeightKg: round2(weight.totalWeightKg),
        totalPackages: Number(weight.totalPackages || 0),
        fragileShipments: Number(weight.fragileShipments || 0),
        outstationShipments: Number(weight.outstationShipments || 0),
        inTransit: Number(weight.inTransit || 0),
        awaitingPickup: Number(weight.awaitingPickup || 0),
      },
      buckets: report.buckets,
      byDriver: report.byDriver,
      byVehicle: report.byVehicle,
      byCategory: categoryRows.map((row) => ({
        category: String(row._id || "uncategorised"),
        shipments: Number(row.shipments || 0),
        delivered: Number(row.delivered || 0),
        weightKg: round2(row.weightKg),
        revenue: round2(row.revenue),
      })),
      recent: recentDocs.map((ride) => {
        const driver = fleet.driverById.get(String(ride.driverId || ""));
        return {
          id: String(ride._id),
          status: ride.status || "",
          liveStatus: ride.liveStatus || "",
          pickupAddress: ride.pickupAddress || "",
          dropAddress: ride.dropAddress || "",
          fare: round2(ride.fare),
          ownerEarnings: round2(ride.ownerEarnings),
          paymentMethod: ride.paymentMethod || "cash",
          category: ride.parcel?.category || "",
          materialName: ride.parcel?.materialName || "",
          weightKg: round2(ride.parcel?.weightKg),
          packageCount: Number(ride.parcel?.packageCount || 0),
          isFragile: Boolean(ride.parcel?.isFragile),
          deliveryScope: ride.parcel?.deliveryScope || "city",
          receiverName: ride.parcel?.receiverName || "",
          deliveredAt: ride.parcel?.proofOfDelivery?.deliveredAt || ride.completedAt || null,
          createdAt: ride.createdAt,
          driver: {
            id: driver?.id || "",
            name: driver?.name || "",
            phone: driver?.phone || "",
            vehicle: vehicleLabel(fleet.vehicleById.get(driver?.vehicleId || "")),
          },
        };
      }),
    },
  });
};

/* ------------------------------------------------------------------ *
 * GET /api/drivers/fleet/reports/export
 * ------------------------------------------------------------------ */

const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvFromRows = (headers, rows) =>
  [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");

const sendReportFile = async (res, filename, headers, rows, format) => {
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    res.send(csvFromRows(headers, rows));
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Report");

  worksheet.addRow(headers.map((header) => String(header).toUpperCase()));
  rows.forEach((row) => worksheet.addRow(headers.map((header) => row[header])));
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
};

export const exportOwnerReport = async (req, res) => {
  const owner = await resolveOwner(req);
  const type = String(req.query?.type || "trips").trim().toLowerCase();
  const format = String(req.query?.format || "csv").trim().toLowerCase() === "xlsx" ? "xlsx" : "csv";

  if (!["trips", "shipments", "vehicles", "drivers"].includes(type)) {
    throw new ApiError(400, "type must be one of trips, shipments, vehicles, drivers");
  }

  const range = resolveReportRange(req.query);
  const fleet = await loadFleetIndex(owner._id);
  const stamp = `${range.start.toISOString().slice(0, 10)}_${new Date(range.end.getTime() - 1)
    .toISOString()
    .slice(0, 10)}`;

  if (type === "vehicles" || type === "drivers") {
    const report = await runOwnerEarningsReport({ owner, query: req.query });
    const isVehicles = type === "vehicles";
    const headers = isVehicles
      ? ["vehicle", "number", "drivers", "trips", "completed", "cancelled", "gross", "owner_earnings", "commission"]
      : ["driver", "phone", "vehicle", "trips", "completed", "cancelled", "gross", "owner_earnings", "commission"];
    const rows = (isVehicles ? report.byVehicle : report.byDriver).map((row) =>
      isVehicles
        ? {
            vehicle: row.label,
            number: row.number,
            drivers: row.driverCount,
            trips: row.trips,
            completed: row.completedTrips,
            cancelled: row.cancelledTrips,
            gross: row.grossRevenue,
            owner_earnings: row.ownerEarnings,
            commission: row.commission,
          }
        : {
            driver: row.name,
            phone: row.phone,
            vehicle: row.vehicle,
            trips: row.trips,
            completed: row.completedTrips,
            cancelled: row.cancelledTrips,
            gross: row.grossRevenue,
            owner_earnings: row.ownerEarnings,
            commission: row.commission,
          },
    );

    await sendReportFile(res, `owner_${type}_${stamp}`, headers, rows, format);
    return;
  }

  const isShipments = type === "shipments";
  const match = ownerRideMatch({
    ownerId: owner._id,
    driverIds: fleet.driverIds,
    start: range.start,
    end: range.end,
    serviceType: isShipments ? "parcel" : null,
  });

  const rideDocs = await Ride.find(match)
    .select(
      "pickupAddress dropAddress status fare driverEarnings ownerEarnings ownerSettledAt commissionAmount paymentMethod transport_type serviceType parcel createdAt completedAt driverId",
    )
    .sort({ createdAt: -1 })
    .limit(MAX_EXPORT_ROWS)
    .lean();

  const headers = isShipments
    ? [
        "booked_at",
        "shipment_id",
        "status",
        "driver",
        "vehicle",
        "category",
        "material",
        "weight_kg",
        "packages",
        "scope",
        "pickup",
        "drop",
        "fare",
        "owner_earnings",
        "payment",
      ]
    : [
        "booked_at",
        "trip_id",
        "service",
        "status",
        "driver",
        "vehicle",
        "pickup",
        "drop",
        "fare",
        "commission",
        "owner_earnings",
        "settled",
        "payment",
      ];

  const rows = rideDocs.map((ride) => {
    const driver = fleet.driverById.get(String(ride.driverId || ""));
    const common = {
      booked_at: ride.createdAt ? new Date(ride.createdAt).toISOString() : "",
      status: ride.status || "",
      driver: driver?.name || "",
      vehicle: vehicleLabel(fleet.vehicleById.get(driver?.vehicleId || "")),
      pickup: ride.pickupAddress || "",
      drop: ride.dropAddress || "",
      fare: round2(ride.fare),
      owner_earnings: round2(ride.ownerEarnings),
      payment: ride.paymentMethod || "",
    };

    return isShipments
      ? {
          ...common,
          shipment_id: String(ride._id),
          category: ride.parcel?.category || "",
          material: ride.parcel?.materialName || "",
          weight_kg: round2(ride.parcel?.weightKg),
          packages: Number(ride.parcel?.packageCount || 0),
          scope: ride.parcel?.deliveryScope || "",
        }
      : {
          ...common,
          trip_id: String(ride._id),
          service: ride.serviceType || ride.transport_type || "ride",
          commission: round2(ride.commissionAmount),
          settled: ride.ownerSettledAt ? "yes" : "no",
        };
  });

  await sendReportFile(res, `owner_${type}_${stamp}`, headers, rows, format);
};

/* ------------------------------------------------------------------ *
 * Owner payout requests — POST/GET /api/drivers/fleet/payouts
 *                         POST /api/drivers/fleet/payouts/:id/cancel
 * ------------------------------------------------------------------ */

const ownerBankSnapshot = (owner = {}) => ({
  accountHolderName: String(owner.owner_name || owner.name || owner.company_name || "").trim(),
  upiId: "",
  qrCodeImage: "",
  accountNumber: String(owner.account_no || "").trim(),
  ifsc: String(owner.ifsc || "").trim().toUpperCase(),
  branchName: String(owner.bank_name || "").trim(),
  updatedAt: new Date(),
});

const serializePayoutRequest = (request = {}) => ({
  _id: String(request._id || ""),
  id: String(request._id || ""),
  transactionId: request.transactionId || "",
  amount: round2(request.amount),
  payment_method: request.payment_method || "bank_transfer",
  status: request.status || "pending",
  bank_details_snapshot: request.bank_details_snapshot || {},
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});

export const listOwnerPayoutRequests = async (req, res) => {
  const owner = await resolveOwner(req);
  const requests = await WithdrawalRequest.find({ owner_id: owner._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const walletSettings = await getWalletSettings();

  res.json({
    success: true,
    data: {
      wallet: { balance: round2(owner.wallet?.balance), currency: "INR" },
      requests: requests.map(serializePayoutRequest),
      rules: {
        transferEnabled: isTruthyFlag(walletSettings.enable_wallet_transfer_owner ?? "1"),
        minimumTransferAmount: Number(
          walletSettings.minimum_wallet_amount_for_transfer ?? 0,
        ),
      },
      bankDetails: {
        accountNumber: String(owner.account_no || "").trim(),
        ifsc: String(owner.ifsc || "").trim().toUpperCase(),
        bankName: String(owner.bank_name || "").trim(),
      },
    },
  });
};

// Debits the owner wallet up front (atomic conditional $inc) and records the hold
// on the OwnerWalletTransaction ledger, so a second request cannot spend the same
// balance. Admin approval only marks the payout as paid (nothing left to debit);
// the owner-side cancel below and adminService.rejectOwnerWithdrawalRequest are the
// two paths that return the hold, each gated on a conditional status flip so the
// refund can only happen once.
export const createOwnerPayoutRequest = async (req, res) => {
  const owner = await resolveOwner(req);
  const walletSettings = await getWalletSettings();

  if (!isTruthyFlag(walletSettings.enable_wallet_transfer_owner ?? "1")) {
    throw new ApiError(403, "Owner payouts are disabled by admin");
  }

  const amount = round2(req.body?.amount);
  const paymentMethod =
    String(req.body?.payment_method || req.body?.paymentMethod || "bank_transfer")
      .trim()
      .toLowerCase() || "bank_transfer";
  const minimumTransferAmount = Number(
    walletSettings.minimum_wallet_amount_for_transfer ?? 0,
  );

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "amount must be greater than zero");
  }

  if (minimumTransferAmount > 0 && amount < minimumTransferAmount) {
    throw new ApiError(400, `amount must be at least ${minimumTransferAmount}`);
  }

  if (!String(owner.account_no || "").trim() && paymentMethod === "bank_transfer") {
    throw new ApiError(400, "Add your bank account details before requesting a payout");
  }

  const recent = await WithdrawalRequest.findOne({
    owner_id: owner._id,
    amount,
    status: "pending",
  })
    .sort({ createdAt: -1 })
    .lean();

  if (recent && Date.now() - new Date(recent.createdAt).getTime() < 60 * 1000) {
    throw new ApiError(409, "A similar payout request was just submitted");
  }

  const debited = await Owner.findOneAndUpdate(
    { _id: owner._id, "wallet.balance": { $gte: amount } },
    { $inc: { "wallet.balance": -amount } },
    { new: true, projection: { wallet: 1 } },
  ).lean();

  if (!debited) {
    throw new ApiError(400, "Payout amount cannot exceed current wallet balance");
  }

  const balance = round2(debited.wallet?.balance);

  try {
    const created = await WithdrawalRequest.create({
      transactionId: `owdr_${Date.now().toString(36)}`,
      owner_id: owner._id,
      amount,
      payment_method: paymentMethod,
      bank_details_snapshot: ownerBankSnapshot(owner),
      status: "pending",
    });

    await OwnerWalletTransaction.create({
      ownerId: owner._id,
      amount,
      kind: "debit",
      title: `Payout request (${String(created._id).slice(-6)})`,
      balance,
    });

    res.status(201).json({
      success: true,
      data: {
        request: serializePayoutRequest(created.toObject()),
        wallet: { balance, currency: "INR" },
      },
      message: "Payout request sent to admin",
    });
  } catch (error) {
    // Never leave the owner short if the ledger write failed.
    await Owner.updateOne({ _id: owner._id }, { $inc: { "wallet.balance": amount } });
    throw error;
  }
};

export const cancelOwnerPayoutRequest = async (req, res) => {
  const owner = await resolveOwner(req);
  const requestId = String(req.params?.requestId || "").trim();

  if (!requestId || !mongoose.isValidObjectId(requestId)) {
    throw new ApiError(400, "A valid payout request id is required");
  }

  // Conditional update keeps the refund single-shot even under a double tap.
  const request = await WithdrawalRequest.findOneAndUpdate(
    { _id: requestId, owner_id: owner._id, status: "pending" },
    { $set: { status: "cancelled" } },
    { new: true },
  ).lean();

  if (!request) {
    throw new ApiError(404, "Pending payout request not found");
  }

  const amount = round2(request.amount);
  const refunded = await Owner.findOneAndUpdate(
    { _id: owner._id },
    { $inc: { "wallet.balance": amount } },
    { new: true, projection: { wallet: 1 } },
  ).lean();

  const balance = round2(refunded?.wallet?.balance);

  await OwnerWalletTransaction.create({
    ownerId: owner._id,
    amount,
    kind: "credit",
    title: `Payout request cancelled (${String(request._id).slice(-6)})`,
    balance,
  });

  res.json({
    success: true,
    data: {
      request: serializePayoutRequest(request),
      wallet: { balance, currency: "INR" },
    },
    message: "Payout request cancelled and amount refunded",
  });
};

/* ------------------------------------------------------------------ *
 * Vehicle document compliance
 *   GET   /api/drivers/fleet/compliance
 *   PATCH /api/drivers/fleet/vehicles/:vehicleId/compliance
 * ------------------------------------------------------------------ */

// Keys the owner can attach an expiry date (and document) to. FleetVehicle.documents
// is a Mixed map, so this list is the only schema these entries have.
const COMPLIANCE_KEYS = ["insurance", "rc", "permit", "fitness", "pollution"];

const summarizeVehicleCompliance = (vehicle, now = new Date()) => {
  const documents = vehicle.documents && typeof vehicle.documents === "object" ? vehicle.documents : {};

  const items = COMPLIANCE_KEYS.map((key) => {
    const entry = documents[key];
    const value = entry && typeof entry === "object" ? entry : {};
    const status = expiryStatus(
      value.expiryDate || value.expiry_date || value.validUpto || "",
      { now },
    );

    return {
      key,
      label: key.toUpperCase(),
      documentUrl: String(value.previewUrl || value.secureUrl || (typeof entry === "string" ? entry : "") || ""),
      uploaded: Boolean(value.previewUrl || value.secureUrl || typeof entry === "string"),
      policyNumber: String(value.policyNumber || value.number || "").trim(),
      provider: String(value.provider || value.insurer || "").trim(),
      ...status,
    };
  });

  return {
    items,
    expiredCount: items.filter((item) => item.expired).length,
    expiringSoonCount: items.filter((item) => item.expiringSoon).length,
    missingCount: items.filter((item) => !item.uploaded).length,
  };
};

export const getOwnerFleetCompliance = async (req, res) => {
  const owner = await resolveOwner(req);
  const fleet = await loadFleetIndex(owner._id);
  const now = new Date();

  const vehicles = fleet.vehicles
    .filter((vehicle) => vehicle.active !== false)
    .map((vehicle) => {
      const compliance = summarizeVehicleCompliance(vehicle, now);
      const assignedDriver = fleet.drivers.find(
        (driver) => String(driver.assignedFleetVehicleId || "") === String(vehicle._id),
      );

      return {
        id: String(vehicle._id),
        label: vehicleLabel(vehicle),
        number: vehicle.license_plate_number || "",
        status: vehicle.status || "pending",
        transportType: vehicle.transport_type || "taxi",
        assignedDriver: assignedDriver
          ? { id: String(assignedDriver._id), name: assignedDriver.name || "" }
          : null,
        ...compliance,
      };
    });

  res.json({
    success: true,
    data: {
      warnDays: DOCUMENT_EXPIRY_WARN_DAYS,
      complianceKeys: COMPLIANCE_KEYS,
      totals: {
        vehicles: vehicles.length,
        expired: vehicles.reduce((sum, vehicle) => sum + vehicle.expiredCount, 0),
        expiringSoon: vehicles.reduce((sum, vehicle) => sum + vehicle.expiringSoonCount, 0),
        missing: vehicles.reduce((sum, vehicle) => sum + vehicle.missingCount, 0),
      },
      vehicles,
    },
  });
};

export const updateOwnerVehicleCompliance = async (req, res) => {
  const owner = await resolveOwner(req);
  const vehicleId = String(req.params?.vehicleId || "").trim();

  if (!vehicleId || !mongoose.isValidObjectId(vehicleId)) {
    throw new ApiError(400, "A valid vehicle id is required");
  }

  const vehicle = await FleetVehicle.findOne({
    _id: vehicleId,
    owner_id: owner._id,
    active: true,
  });

  if (!vehicle) {
    throw new ApiError(404, "Fleet vehicle not found");
  }

  const incoming = req.body?.documents;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    throw new ApiError(400, "documents object is required");
  }

  const documents = { ...(vehicle.documents || {}) };
  let touched = 0;

  for (const key of COMPLIANCE_KEYS) {
    const patch = incoming[key];
    if (!patch || typeof patch !== "object") {
      continue;
    }

    const existing =
      documents[key] && typeof documents[key] === "object"
        ? documents[key]
        : typeof documents[key] === "string"
          ? { previewUrl: documents[key], secureUrl: documents[key], uploaded: true }
          : {};

    const next = { ...existing };
    const url = String(patch.previewUrl || patch.secureUrl || patch.url || "").trim();

    if (url) {
      next.previewUrl = url;
      next.secureUrl = String(patch.secureUrl || url).trim();
      next.uploaded = true;
    }

    if (patch.expiryDate !== undefined) {
      const parsed = expiryStatus(patch.expiryDate);
      if (String(patch.expiryDate || "").trim() && !parsed.expiryDate) {
        throw new ApiError(400, `${key} expiryDate must be a valid date`);
      }
      next.expiryDate = parsed.expiryDate;
    }

    if (patch.policyNumber !== undefined) {
      next.policyNumber = String(patch.policyNumber || "").trim();
    }

    if (patch.provider !== undefined) {
      next.provider = String(patch.provider || "").trim();
    }

    documents[key] = next;
    touched += 1;
  }

  if (!touched) {
    throw new ApiError(400, `documents must contain one of: ${COMPLIANCE_KEYS.join(", ")}`);
  }

  vehicle.documents = documents;
  vehicle.markModified("documents");
  await vehicle.save();

  res.json({
    success: true,
    data: {
      vehicle: {
        id: String(vehicle._id),
        label: vehicleLabel(vehicle),
        number: vehicle.license_plate_number || "",
        ...summarizeVehicleCompliance(vehicle.toObject()),
      },
    },
    message: "Vehicle documents updated",
  });
};
