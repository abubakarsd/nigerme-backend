import { Router } from "express";
import { PackageController } from "../controllers/package.controller.js";

const router = Router();

// Public / Authenticated read packages
router.get("/", PackageController.getAll);
router.get("/:id", PackageController.getById);

// Admin pricing & updates
router.patch("/:id/pricing", PackageController.updatePricing);
router.post("/reset", PackageController.reset);

export default router;
