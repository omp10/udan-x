import { listAvailablePromosForUser, validatePromoForContext } from '../../services/promoService.js';

export const validatePromo = async (req, res) => {
  const { code, fare, service_location_id, transport_type } = req.body || {};

  const result = await validatePromoForContext({
    code,
    userId: req.auth?.sub,
    fare,
    service_location_id,
    transport_type,
  });

  res.json({ success: true, data: result });
};

export const getAvailablePromos = async (req, res) => {
  // Both filters are optional: the offers screen browses without a ride context,
  // the ride flow passes them to narrow the list to what actually applies.
  const result = await listAvailablePromosForUser({
    userId: req.auth?.sub,
    service_location_id: req.query.service_location_id,
    transport_type: req.query.transport_type,
    limit: req.query.limit,
  });

  res.json({ success: true, data: result });
};
