"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ORG_ROLES = void 0;
exports.seedOrganizationDefaultRoles = seedOrganizationDefaultRoles;
const role_model_js_1 = require("../models/role.model.js");
exports.DEFAULT_ORG_ROLES = [
    {
        name: "Owner / Executive",
        slug: "owner",
        description: "Full sovereign administrative control, all operational packages, and billing management.",
        isSystem: true,
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
        isSystem: true,
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
        isSystem: false,
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
        isSystem: false,
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
        isSystem: false,
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
        isSystem: false,
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
        isSystem: true,
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
async function seedOrganizationDefaultRoles(orgId) {
    try {
        const existingRoles = await role_model_js_1.RoleModel.find({ organizationId: orgId });
        if (existingRoles.length > 0)
            return existingRoles;
        const rolesToCreate = exports.DEFAULT_ORG_ROLES.map((r) => ({
            ...r,
            organizationId: orgId,
        }));
        const created = await role_model_js_1.RoleModel.insertMany(rolesToCreate);
        console.log(`✅ Seeded ${created.length} default organization roles for org: ${orgId}`);
        return created;
    }
    catch (err) {
        console.error(`⚠️ Failed to seed default roles for org ${orgId}:`, err);
        return [];
    }
}
