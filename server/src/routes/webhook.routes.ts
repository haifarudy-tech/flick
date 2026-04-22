import { Router, raw } from 'express';
import { makeDeliveryWebhook } from '../controllers/webhook.controller.js';
import { stripeWebhook } from '../controllers/subscription.controller.js';

const router = Router();

// NOTE: webhook routes MUST use the raw body parser because HMAC verification
// is done against the exact bytes received. app.ts mounts this router before
// express.json() so the raw middleware below takes effect.

router.post('/ubereats', raw({ type: '*/*', limit: '2mb' }), makeDeliveryWebhook('ubereats'));
router.post('/deliveroo', raw({ type: '*/*', limit: '2mb' }), makeDeliveryWebhook('deliveroo'));
router.post('/justeat', raw({ type: '*/*', limit: '2mb' }), makeDeliveryWebhook('justeat'));

router.post('/stripe', raw({ type: 'application/json', limit: '2mb' }), stripeWebhook);

export default router;
