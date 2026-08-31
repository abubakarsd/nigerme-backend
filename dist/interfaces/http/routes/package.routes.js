"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const package_controller_js_1 = require("../controllers/package.controller.js");
const router = (0, express_1.Router)();
// Public / Authenticated read packages
router.get("/", package_controller_js_1.PackageController.getAll);
router.get("/:id", package_controller_js_1.PackageController.getById);
// Admin pricing & updates
router.patch("/:id/pricing", package_controller_js_1.PackageController.updatePricing);
router.post("/reset", package_controller_js_1.PackageController.reset);
exports.default = router;
