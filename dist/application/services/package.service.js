"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageService = void 0;
const package_model_js_1 = require("../../infrastructure/database/models/package.model.js");
const package_seed_js_1 = require("../../infrastructure/database/seeds/package.seed.js");
class PackageService {
    /**
     * Fetches all product packages sorted by sortOrder
     */
    static async getAllPackages() {
        let packages = await package_model_js_1.PackageModel.find({ isActive: true }).sort({ sortOrder: 1 });
        // If database is empty, seed now
        if (!packages || packages.length === 0) {
            await (0, package_seed_js_1.seedPackages)(true);
            packages = await package_model_js_1.PackageModel.find({ isActive: true }).sort({ sortOrder: 1 });
        }
        return packages;
    }
    /**
     * Fetches a package by its unique package ID (e.g. "org-email", "payroll")
     */
    static async getPackageById(packageId) {
        return package_model_js_1.PackageModel.findOne({ packageId });
    }
    /**
     * Updates package pricing (monthly & annual fees)
     */
    static async updatePackagePricing(packageId, dto) {
        const pkg = await package_model_js_1.PackageModel.findOne({ packageId });
        if (!pkg) {
            throw new Error(`Package with ID '${packageId}' not found.`);
        }
        if (dto.priceMonthly !== undefined) {
            pkg.priceMonthly = dto.priceMonthly;
        }
        if (dto.priceAnnual !== undefined) {
            pkg.priceAnnual = dto.priceAnnual;
        }
        if (dto.priceFormatted) {
            pkg.priceFormatted = dto.priceFormatted;
        }
        else if (dto.priceMonthly !== undefined) {
            const formattedNum = new Intl.NumberFormat("en-NG", {
                style: "currency",
                currency: "NGN",
                maximumFractionDigits: 0,
            }).format(pkg.priceMonthly);
            pkg.priceFormatted =
                pkg.pricingModel === "PER_SEAT"
                    ? `${formattedNum} / seat / mo`
                    : `${formattedNum} / month flat`;
        }
        await pkg.save();
        return pkg;
    }
    /**
     * Updates full package attributes (name, tagline, description, badge, etc.)
     */
    static async updatePackage(packageId, updateData) {
        const pkg = await package_model_js_1.PackageModel.findOneAndUpdate({ packageId }, { $set: updateData }, { new: true, runValidators: true });
        if (!pkg) {
            throw new Error(`Package with ID '${packageId}' not found.`);
        }
        return pkg;
    }
    /**
     * Resets packages back to sovereign enterprise defaults
     */
    static async resetPackagesToDefault() {
        await (0, package_seed_js_1.seedPackages)(true);
        return package_model_js_1.PackageModel.find({ isActive: true }).sort({ sortOrder: 1 });
    }
}
exports.PackageService = PackageService;
