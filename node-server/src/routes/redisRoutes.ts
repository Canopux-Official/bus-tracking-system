import express from "express";
import { pushLocation } from "../controllers/redisController";

const router = express.Router();

// POST: save location
router.post("/location", pushLocation);

// GET: fetch location
// router.get("/location/:busId", getLocation);

// // get all locations
// router.get("/allLocation",getAllLocations);

export default router;