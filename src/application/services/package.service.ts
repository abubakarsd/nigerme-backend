import { PackageModel, IPackage } from "../../infrastructure/database/models/package.model.js";
import { INITIAL_PACKAGES, seedPackages } from "../../infrastructure/database/seeds/package.seed.js";

export interface UpdatePackagePricingDto {
  priceMonthly?: number;
  priceAnnual?: number;
  priceFormatted?: string;
}

export class PackageService {
  /**
   * Fetches all product packages sorted by sortOrder
   */
  static async getAllPackages(): Promise<IPackage[]> {
    let packages = await PackageModel.find({ isActive: true }).sort({ sortOrder: 1 });
    
    // If database is empty, seed now
    if (!packages || packages.length === 0) {
      await seedPackages(true);
      packages = await PackageModel.find({ isActive: true }).sort({ sortOrder: 1 });
    }

    return packages;
  }

  /**
   * Fetches a package by its unique package ID (e.g. "org-email", "payroll")
   */
  static async getPackageById(packageId: string): Promise<IPackage | null> {
    return PackageModel.findOne({ packageId });
  }

  /**
   * Updates package pricing (monthly & annual fees)
   */
  static async updatePackagePricing(
    packageId: string,
    dto: UpdatePackagePricingDto
  ): Promise<IPackage> {
    const pkg = await PackageModel.findOne({ packageId });
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
    } else if (dto.priceMonthly !== undefined) {
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
  static async updatePackage(
    packageId: string,
    updateData: Partial<IPackage>
  ): Promise<IPackage> {
    const pkg = await PackageModel.findOneAndUpdate(
      { packageId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!pkg) {
      throw new Error(`Package with ID '${packageId}' not found.`);
    }

    return pkg;
  }

  /**
   * Resets packages back to sovereign enterprise defaults
   */
  static async resetPackagesToDefault(): Promise<IPackage[]> {
    await seedPackages(true);
    return PackageModel.find({ isActive: true }).sort({ sortOrder: 1 });
  }
}
