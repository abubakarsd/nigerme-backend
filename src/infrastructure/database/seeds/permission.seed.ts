import { PermissionModel } from "../models/permission.model.js";

export const INITIAL_PERMISSIONS = [
  {
    key: "canAccessEmail",
    name: "Sovereign Webmail & Calendar",
    description: "Access to private webmail, corporate address book, scheduling, and sovereign calendar.",
    category: "Core" as const,
    isSystem: true,
  },
  {
    key: "canAccessPayroll",
    name: "Payroll & PAYE Remittance",
    description: "Execute salary runs, compute PAYE taxes, manage pensions, and generate Payslips.",
    category: "Operations" as const,
    isSystem: true,
  },
  {
    key: "canAccessPos",
    name: "Commerce POS & Retail Hub",
    description: "Access barcode scanner, create sales receipts, process terminal checkout, and view stock.",
    category: "Operations" as const,
    isSystem: true,
  },
  {
    key: "canAccessLogistics",
    name: "Fleet & Haulage Telemetry",
    description: "Track GPS vehicle coordinates, assign cargo manifests, and dispatch haulage trips.",
    category: "Operations" as const,
    isSystem: true,
  },
  {
    key: "canAccessHotel",
    name: "Hotel PMS & FrontDesk",
    description: "Manage guest check-ins, room inventory matrix, billing folios, and housekeeping status.",
    category: "Operations" as const,
    isSystem: true,
  },
  {
    key: "canAccessAdminConsole",
    name: "Workspace Management Console",
    description: "Access to administrative configuration, analytics dashboards, and system settings.",
    category: "Administration" as const,
    isSystem: true,
  },
  {
    key: "canManageBilling",
    name: "Billing & Wallet Management",
    description: "Fund workspace dedicated wallet, order module packages, and download tax invoices.",
    category: "Administration" as const,
    isSystem: true,
  },
  {
    key: "canManageUsers",
    name: "User & Mailbox Provisioning",
    description: "Issue new enterprise email accounts, set storage quotas, reset passwords, and suspend users.",
    category: "Administration" as const,
    isSystem: true,
  },
  {
    key: "canManageDomains",
    name: "Domain & Cryptographic DNS",
    description: "Configure custom domains, update MX/SPF/DKIM/DMARC records, and manage routing.",
    category: "Security" as const,
    isSystem: true,
  },
];

export async function seedPermissions() {
  try {
    for (const perm of INITIAL_PERMISSIONS) {
      await PermissionModel.findOneAndUpdate(
        { key: perm.key },
        { $set: perm },
        { upsert: true, new: true }
      );
    }
    console.log("✅ Seeded initial system permissions successfully.");
  } catch (err) {
    console.error("⚠️ Failed to seed permissions:", err);
  }
}
