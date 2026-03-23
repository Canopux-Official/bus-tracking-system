import { createBus, endTrip } from '../controllers/busController';
import express from 'express';

const router = express.Router();

// call when bus driver will enter the bus details


router.post('/create',createBus);
router.patch("/end-trip/:tripId", endTrip);

export default router;