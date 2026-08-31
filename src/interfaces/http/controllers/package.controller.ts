import { Request, Response } from "express";
import { PackageService } from "../../../application/services/package.service.js";

export class PackageController {
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const packages = await PackageService.getAllPackages();
      res.status(200).json({
        success: true,
        data: packages,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message || "Failed to retrieve packages" },
      });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const pkg = await PackageService.getPackageById(req.params.id);
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
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message },
      });
    }
  }

  static async updatePricing(req: Request, res: Response): Promise<void> {
    try {
      const { priceMonthly, priceAnnual, priceFormatted } = req.body;
      const updated = await PackageService.updatePackagePricing(req.params.id, {
        priceMonthly: priceMonthly !== undefined ? Number(priceMonthly) : undefined,
        priceAnnual: priceAnnual !== undefined ? Number(priceAnnual) : undefined,
        priceFormatted,
      });

      res.status(200).json({
        success: true,
        message: `Pricing updated for package ${req.params.id}`,
        data: updated,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: { message: error.message || "Failed to update package pricing" },
      });
    }
  }

  static async reset(req: Request, res: Response): Promise<void> {
    try {
      const packages = await PackageService.resetPackagesToDefault();
      res.status(200).json({
        success: true,
        message: "Packages successfully reset to sovereign defaults.",
        data: packages,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message },
      });
    }
  }
}
