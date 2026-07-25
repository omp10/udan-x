import { Router } from 'express';
import { uploadRateLimit } from '../../middlewares/rateLimitMiddleware.js';
import * as commonController from '../controllers/commonController.js';

export const commonRouter = Router();

// Universal image upload endpoint. Stays anonymous (the signup flow uploads a
// photo before the account exists) but is rate limited so it is not an open relay.
commonRouter.post('/common/upload/image', uploadRateLimit, commonController.uploadImage);
commonRouter.get('/common/referrals/translation', commonController.getReferralTranslation);
commonRouter.get('/common/referrals/settings', commonController.getReferralSettingsContent);
commonRouter.get('/common/payment-gateway', commonController.getPaymentGatewayConfig);
commonRouter.post('/common/payment-gateway/phonepe/callback', commonController.acknowledgePhonePeCallback);
commonRouter.get('/common/recharge-api/callback', commonController.acknowledgeRechargeApiCallback);
commonRouter.post('/common/recharge-api/callback', commonController.acknowledgeRechargeApiCallback);
