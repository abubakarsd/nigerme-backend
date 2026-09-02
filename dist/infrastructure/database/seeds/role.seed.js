"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ORG_DEPARTMENTS = exports.DEFAULT_ORG_ROLES = void 0;
exports.seedOrganizationDefaultRoles = seedOrganizationDefaultRoles;
exports.seedOrganizationDefaultDepartments = seedOrganizationDefaultDepartments;
const role_model_js_1 = require("../models/role.model.js");
const department_model_js_1 = require("../models/department.model.js");
exports.DEFAULT_ORG_ROLES = [
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
        description: "Manages team mailboxes, DNS records, security policies, and administrative operations.",
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
        description: "Access to Payroll calculations, tax remittances, salary slips, and subscription billing.",
        isSystem: false, // Operational role — can be edited or deleted
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
        description: "Access to POS terminal checkout, stock inventory, barcode scanning, and sales receipts.",
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
        description: "Standard employee account with private sovereign webmail, calendar, and task management.",
        isSystem: false,
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
exports.DEFAULT_ORG_DEPARTMENTS = [
    {
        name: "Executive & Management",
        code: "EXEC",
        description: "Strategic leadership, corporate governance, and executive oversight.",
        leadName: "Workspace Owner",
        color: "purple",
    },
    {
        name: "Finance & Accounts",
        code: "FIN",
        description: "Financial accounting, corporate billing, tax remittances, and audit controls.",
        leadName: "Finance Lead",
        color: "emerald",
    },
    {
        name: "Engineering & IT",
        code: "ENG",
        description: "Technical infrastructure, software engineering, and systems administration.",
        leadName: "Tech Lead",
        color: "blue",
    },
    {
        name: "Sales & Marketing",
        code: "MKT",
        description: "Business development, customer outreach, retail marketing, and growth.",
        leadName: "Marketing Lead",
        color: "amber",
    },
    {
        name: "Operations & Logistics",
        code: "OPS",
        description: "Supply chain, haulage fleet dispatch, vehicle telemetry, and field operations.",
        leadName: "Operations Lead",
        color: "cyan",
    },
    {
        name: "Human Resources",
        code: "HR",
        description: "People operations, talent acquisition, staff relations, and workplace culture.",
        leadName: "HR Lead",
        color: "rose",
    },
    {
        name: "Customer Support",
        code: "CS",
        description: "Client success, helpdesk resolution, and query management.",
        leadName: "Support Lead",
        color: "indigo",
    },
    {
        name: "Hospitality & Guest Services",
        code: "HOSP",
        description: "Front desk, guest reservations, room inventory, and concierge services.",
        leadName: "Front Desk Manager",
        color: "lime",
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
async function seedOrganizationDefaultDepartments(orgId) {
    try {
        const existingDepts = await department_model_js_1.DepartmentModel.find({ organizationId: orgId });
        if (existingDepts.length > 0)
            return existingDepts;
        const deptsToCreate = exports.DEFAULT_ORG_DEPARTMENTS.map((d) => ({
            ...d,
            organizationId: orgId,
            memberCount: 0,
        }));
        const created = await department_model_js_1.DepartmentModel.insertMany(deptsToCreate);
        console.log(`✅ Seeded ${created.length} default organization departments for org: ${orgId}`);
        return created;
    }
    catch (err) {
        console.error(`⚠️ Failed to seed default departments for org ${orgId}:`, err);
        return [];
    }
}
