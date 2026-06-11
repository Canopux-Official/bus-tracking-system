import { createBus, endTrip, getStops, updateRoute } from '../controllers/busController';
import express from 'express';

const router = express.Router();

// call when bus driver will enter the bus details

router.post('/create',                    createBus);
router.patch('/end-trip/:tripId',         endTrip);
router.patch('/trip/:tripId/route',       updateRoute);
router.get('/trip/:tripId/stops',         getStops);


export default router;