import { Router } from "express";
import { searchBuses } from "../controllers/userController";

const router = Router();

router.get("/search", searchBuses);

export default router;