import mongoose from "mongoose";
import { RoleModel } from "../models/role.model.js";
import { OrganizationModel } from "../models/organization.model.js";

export const DEFAULT_ORG_ROLES = [
  {
    name: "Owner / Executive",
    slug: "owner",
    description: "Full sovereign administrative control, all operational packages, and billing management.",
    isSystem: true, // Protected core system role — cannot be deleted
    memberCount: 1,
    permissions: {
      canAccessEmail: true,
      canAccessPayroll: true,
      canAccessPos: true,
      canAccessLogistics: true,
      canAccessHotel: true,
      canAccessAdminConsole: true,
      canManageBilling: true,
      canManageUsers: true,
      canManageDomains: true,
    },
  },
  {
    name: "Workspace Administrator",
    slug: "admin",
    description: "Manages team mailboxes, DNS records, security policies, and operational systems.",
    isSystem: true, // Protected core system role — cannot be deleted
    memberCount: 0,
    permissions: {
      canAccessEmail: true,
      canAccessPayroll: true,
      canAccessPos: true,
      canAccessLogistics: true,
      canAccessHotel: true,
      canAccessAdminConsole: true,
      canManageBilling: false,
      canManageUsers: true,
      canManageDomains: true,
    },
  },
  {
    name: "Finance & Payroll Officer",
    slug: "finance",
    description: "Access to Payroll calculations, tax remittances, salary slips, and subscription wallet.",
    isSystem: false, // Optional operational role — can be deleted by admin if not needed
    memberCount: 0,
    permissions: {
      canAccessEmail: true,
      canAccessPayroll: true,
      canAccessPos: false,
      canAccessLogistics: false,
      canAccessHotel: false,
      canAccessAdminConsole: false,
      canManageBilling: true,
      canManageUsers: false,
      canManageDomains: false,
    },
  },
  {
    name: "Store Cashier / POS Manager",
    slug: "pos",
    description: "Access to POS terminal checkout, stock inventory, barcode scanning, and order receipts.",
    isSystem: false, // Optional operational role — can be deleted by admin if not needed
    memberCount: 0,
    permissions: {
      canAccessEmail: true,
      canAccessPayroll: false,
      canAccessPos: true,
      canAccessLogistics: false,
      canAccessHotel: false,
      canAccessAdminConsole: false,
      canManageBilling: false,
      canManageUsers: false,
      canManageDomains: false,
    },
  },
  {
    name: "Logistics & Fleet Dispatcher",
    slug: "logistics",
    description: "Access to Fleet Telemetry, haulage dispatch routing, GPS tracking, and delivery manifests.",
    isSystem: false, // Optional operational role — can be deleted by admin if not needed
    memberCount: 0,
    permissions: {
      canAccessEmail: true,
      canAccessPayroll: false,
      canAccessPos: false,
      canAccessLogistics: true,
      canAccessHotel: false,
      canAccessAdminConsole: false,
      canManageBilling: false,
      canManageUsers: false,
      canManageDomains: false,
    },
  },
  {
    name: "Hospitality & Front Desk Agent",
    slug: "hotel",
    description: "Access to Hotel PMS, live room availability matrix, guest reservations, and folios.",
    isSystem: false, // Optional operational role — can be deleted by admin if not needed
    memberCount: 0,
    permissions: {
      canAccessEmail: true,
      canAccessPayroll: false,
      canAccessPos: false,
      canAccessLogistics: false,
      canAccessHotel: true,
      canAccessAdminConsole: false,
      canManageBilling: false,
      canManageUsers: false,
      canManageDomains: false,
    },
  },
  {
    name: "Standard Team Member",
    slug: "member",
    description: "Standard employee account with secure sovereign webmail and corporate address book access.",
    isSystem: false, // Can be modified or replaced with custom roles
    memberCount: 0,
    permissions: {
      canAccessEmail: true,
      canAccessPayroll: false,
      canAccessPos: false,
      canAccessLogistics: false,
      canAccessHotel: false,
      canAccessAdminConsole: false,
      canManageBilling: false,
      canManageUsers: false,
      canManageDomains: false,
    },
  },
];

export const DEFAULT_ORG_DEPARTMENTS = [
  {
    id: "dept-exec",
    name: "Executive & Management",
    description: "Strategic leadership, organization governance, and executive oversight.",
    lead: "Workspace Owner",
    roleName: "Owner / Executive",
    memberIds: [],
    packageAccess: ["org-email", "org-payroll", "org-pos", "org-logistics", "org-hotel"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "dept-finance",
    name: "Finance & Accounts",
    description: "Payroll disbursements, accounting, corporate billing, and tax remittances.",
    lead: "Finance Lead",
    roleName: "Finance & Payroll Officer",
    memberIds: [],
    packageAccess: ["org-email", "org-payroll"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "dept-retail",
    name: "Retail & Operations",
    description: "Store inventory, POS point of sale, order checkout, and merchandising.",
    lead: "Store Manager",
    roleName: "Store Cashier / POS Manager",
    memberIds: [],
    packageAccess: ["org-email", "org-pos"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "dept-logistics",
    name: "Fleet & Logistics",
    description: "Fleet haulage operations, dispatch routing, asset telemetry, and drivers.",
    lead: "Logistics Lead",
    roleName: "Logistics & Fleet Dispatcher",
    memberIds: [],
    packageAccess: ["org-email", "org-logistics"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "dept-hospitality",
    name: "Hospitality & Front Desk",
    description: "Guest reservations, PMS room matrix, housekeeping, and front desk operations.",
    lead: "Front Desk Manager",
    roleName: "Hospitality & Front Desk Agent",
    memberIds: [],
    packageAccess: ["org-email", "org-hotel"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "dept-general",
    name: "General Team",
    description: "Core organization staff with sovereign business email access.",
    lead: "Operations Lead",
    roleName: "Standard Team Member",
    memberIds: [],
    packageAccess: ["org-email"],
    createdAt: new Date().toISOString(),
  },
];

export async function seedOrganizationDefaultRoles(orgId: mongoose.Types.ObjectId | string) {
  try {
    const existingRoles = await RoleModel.find({ organizationId: orgId });
    if (existingRoles.length > 0) return existingRoles;

    const rolesToCreate = DEFAULT_ORG_ROLES.map((r) => ({
      ...r,
      organizationId: orgId,
    }));

    const created = await RoleModel.insertMany(rolesToCreate);
    console.log(`✅ Seeded ${created.length} default organization roles for org: ${orgId}`);
    return created;
  } catch (err) {
    console.error(`⚠️ Failed to seed default roles for org ${orgId}:`, err);
    return [];
  }
}

export async function seedOrganizationDefaultDepartments(orgId: mongoose.Types.ObjectId | string) {
  try {
    const org = await OrganizationModel.findById(orgId);
    if (!org) return [];
    if (org.departments && org.departments.length > 0) return org.departments;

    org.departments = DEFAULT_ORG_DEPARTMENTS;
    org.markModified("departments");
    await org.save();
    console.log(`✅ Seeded ${DEFAULT_ORG_DEPARTMENTS.length} default departments for org: ${orgId}`);
    return org.departments;
  } catch (err) {
    console.error(`⚠️ Failed to seed default departments for org ${orgId}:`, err);
    return [];
  }
}
