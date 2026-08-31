"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageController = void 0;
const package_service_js_1 = require("../../../application/services/package.service.js");
class PackageController {
    static async getAll(req, res) {
        try {
            const packages = await package_service_js_1.PackageService.getAllPackages();
            res.status(200).json({
                success: true,
                data: packages,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: { message: error.message || "Failed to retrieve packages" },
            });
        }
    }
    static async getById(req, res) {
        try {
            const pkg = await package_service_js_1.PackageService.getPackageById(req.params.id);
            if (!pkg) {
                res.status(404).json({
                    success: false,
                    error: { message: `Package ${req.params.id} not found.` },
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: pkg,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: { message: error.message },
            });
        }
    }
    static async updatePricing(req, res) {
        try {
            const { priceMonthly, priceAnnual, priceFormatted } = req.body;
            const updated = await package_service_js_1.PackageService.updatePackagePricing(req.params.id, {
                priceMonthly: priceMonthly !== undefined ? Number(priceMonthly) : undefined,
                priceAnnual: priceAnnual !== undefined ? Number(priceAnnual) : undefined,
                priceFormatted,
            });
            res.status(200).json({
                success: true,
                message: `Pricing updated for package ${req.params.id}`,
                data: updated,
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: { message: error.message || "Failed to update package pricing" },
            });
        }
    }
    static async reset(req, res) {
        try {
            const packages = await package_service_js_1.PackageService.resetPackagesToDefault();
            res.status(200).json({
                success: true,
                message: "Packages successfully reset to sovereign defaults.",
                data: packages,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: { message: error.message },
            });
        }
    }
}
exports.PackageController = PackageController;
