// Ride stops travel through the booking flow (SelectLocation -> SelectVehicle ->
// SearchingDriver) and have two shapes:
//   - legacy: a plain address string (no coordinates were ever captured)
//   - current: { address, coordinates: [lng, lat] | null }
// These helpers let every consumer read whichever it gets without each screen
// re-implementing the shape check.

export const getStopAddress = (stop) =>
  String(typeof stop === 'string' ? stop : stop?.address || '').trim();

export const getStopCoordinates = (stop) => {
  if (typeof stop === 'string') return null;
  const raw = stop?.coordinates;
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const [lng, lat] = raw.map(Number);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
};

/** Address strings only, blanks removed — for Google waypoints and display. */
export const toStopAddresses = (stops) =>
  (Array.isArray(stops) ? stops : []).map(getStopAddress).filter(Boolean);

/** Full objects, blanks removed — for the booking payload. */
export const toStopPayload = (stops) =>
  (Array.isArray(stops) ? stops : [])
    .map((stop) => ({ address: getStopAddress(stop), coordinates: getStopCoordinates(stop) }))
    .filter((stop) => stop.address.length > 0);

/** index -> [lng, lat], for seeding SelectLocation's editable state. */
export const toStopCoordsMap = (stops) =>
  (Array.isArray(stops) ? stops : []).reduce((acc, stop, index) => {
    const coords = getStopCoordinates(stop);
    if (coords) acc[index] = coords;
    return acc;
  }, {});
