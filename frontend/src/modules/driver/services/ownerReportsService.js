import api from "../../../shared/api/axiosInstance";
import { getLocalDriverToken } from "./registrationService";

const withOwnerAuth = (config = {}) => {
  const token = getLocalDriverToken();

  if (!token) {
    return config;
  }

  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  };
};

export const getOwnerEarningsReport = (params = {}) =>
  api.get("/drivers/fleet/earnings", withOwnerAuth({ params }));

export const getOwnerShipmentReport = (params = {}) =>
  api.get("/drivers/fleet/shipments", withOwnerAuth({ params }));

export const getOwnerFleetCompliance = () =>
  api.get("/drivers/fleet/compliance", withOwnerAuth());

export const updateOwnerVehicleCompliance = (vehicleId, documents) =>
  api.patch(
    `/drivers/fleet/vehicles/${vehicleId}/compliance`,
    { documents },
    withOwnerAuth(),
  );

export const getOwnerPayoutRequests = () =>
  api.get("/drivers/fleet/payouts", withOwnerAuth());

export const createOwnerPayoutRequest = (payload) =>
  api.post("/drivers/fleet/payouts", payload, withOwnerAuth());

export const cancelOwnerPayoutRequest = (requestId) =>
  api.post(`/drivers/fleet/payouts/${requestId}/cancel`, {}, withOwnerAuth());

// Streams the CSV/XLSX straight to a download; the endpoint sets the filename but
// a blob response has to be saved by hand.
export const downloadOwnerReport = async (params = {}) => {
  const response = await api.get(
    "/drivers/fleet/reports/export",
    withOwnerAuth({ params, responseType: "blob" }),
  );

  const blob = response?.data instanceof Blob ? response.data : new Blob([response?.data]);
  const extension = String(params.format || "csv").toLowerCase() === "xlsx" ? "xlsx" : "csv";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `owner_${params.type || "trips"}_report.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
