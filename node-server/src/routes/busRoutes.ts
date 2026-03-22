import { createBus } from '../controllers/busController';
import express from 'express';

const router = express.Router();

// call when bus driver will enter the bus details


router.post('/create',createBus);

export default router;