"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INITIAL_PACKAGES = void 0;
exports.seedPackages = seedPackages;
const package_model_js_1 = require("../models/package.model.js");
exports.INITIAL_PACKAGES = [
    {
        packageId: "org-email",
        name: "Organization Sovereign Email & Workspace Suite",
        shortName: "Org Email Suite",
        tagline: "Core sovereign email with integrated collaboration engine",
        description: "Enterprise-grade sovereign mailbox with custom domain SPF/DKIM/DMARC routing, task management, smart scheduling, video meetings, and encrypted cloud drive.",
        category: "PRODUCTIVITY",
        badge: "Core Base Package (Auto-Included)",
        badgeTone: "success",
        isCore: true,
        autoChecked: true,
        priceMonthly: 2500, // per seat / month
        priceAnnual: 25500, // per seat / year (15% discount)
        pricingModel: "PER_SEAT",
        priceFormatted: "₦2,500 / seat / mo",
        accentColor: "#84cc16",
        glowColor: "rgba(132, 204, 22, 0.15)",
        sortOrder: 1,
        subFeatures: [
            {
                id: "work-management",
                name: "Work Management (Task Boards)",
                shortDesc: "Kanban & list task tracking with 1-click email-to-task conversion and assignment.",
                badge: "Built-in",
                iconName: "CheckSquare",
            },
            {
                id: "scheduling",
                name: "Smart Scheduling & Booking Links",
                shortDesc: "Calendly-style public booking links (/s/slug) with automated slot detection.",
                badge: "Built-in",
                iconName: "CalendarClock",
            },
            {
                id: "meetings",
                name: "HD Video & Audio Meetings",
                shortDesc: "Encrypted virtual meeting rooms with screen share, in-browser instant calling.",
                badge: "Built-in",
                iconName: "Video",
            },
            {
                id: "drive",
                name: "Encrypted Cloud Drive & Storage",
                shortDesc: "Secure document storage, team drive folders, and encrypted file sharing links.",
                badge: "Built-in",
                iconName: "HardDrive",
            },
            {
                id: "sovereign-mail",
                name: "Sovereign Domain Email (@company.ng)",
                shortDesc: "Anti-spam, anti-phishing, DKIM 2048-bit keys, and automated IP warmup.",
                badge: "Core",
                iconName: "MailCheck",
            },
        ],
        keyHighlights: [
            "Auto-included for all organization members",
            "Unlimited domain aliases & sovereign routing",
            "30GB cloud storage per mailbox seat",
            "Paystack / Direct settlement in Naira",
        ],
        systemCapabilities: [
            "DKIM, SPF & DMARC Automated DNS configuration",
            "Multi-folder mail categorization & AI thread summaries",
            "Shared inboxes for sales@ & support@ departments",
            "Mobile responsive webmail app",
        ],
    },
    {
        packageId: "payroll",
        name: "Automated Payroll & HR Compliance Suite",
        shortName: "Payroll & HR System",
        tagline: "1-click salary disbursement, PAYE statutory tax calculation & HR self-service",
        description: "Full Nigerian statutory compliance engine with direct NIBSS bank batch transfers, automated PAYE/Pension calculations, employee self-service payslip portal, and leave tracking.",
        category: "FINANCE_HR",
        badge: "Popular Add-on",
        badgeTone: "purple",
        isCore: false,
        autoChecked: false,
        priceMonthly: 15000, // Flat addon / month
        priceAnnual: 153000, // Flat addon / year (15% discount)
        pricingModel: "FLAT_MONTHLY",
        priceFormatted: "₦15,000 / month flat",
        accentColor: "#a855f7",
        glowColor: "rgba(168, 85, 247, 0.15)",
        sortOrder: 2,
        subFeatures: [
            {
                id: "salary-disbursement",
                name: "1-Click Direct Salary Disbursement",
                shortDesc: "Automated NIBSS/NAPS bank batch transfers to all Nigerian commercial & microfinance banks.",
                badge: "Automated",
                iconName: "Banknote",
            },
            {
                id: "tax-compliance",
                name: "PAYE, Pension & NHF Computation",
                shortDesc: "Automated state IRS withholding tax brackets, NSITF, Pension Reform Act compliance.",
                badge: "Compliant",
                iconName: "Calculator",
            },
            {
                id: "employee-portal",
                name: "Employee Self-Service & Payslips",
                shortDesc: "Digital PDF payslip generation, leave requests, attendance logs, and staff self-updates.",
                badge: "Self-Service",
                iconName: "UserCheck",
            },
            {
                id: "multi-tier-approvals",
                name: "Multi-Tier Signing & Auditing",
                shortDesc: "Finance maker-checker dual authorization keys with immutable payout audit logs.",
                badge: "Secure",
                iconName: "ShieldAlert",
            },
        ],
        keyHighlights: [
            "Direct bank batch settlement via API",
            "Automated PDF payslip delivery to staff emails",
            "Custom deduction & bonus rule configurator",
            "State IRS filing sheet generator",
        ],
        systemCapabilities: [
            "Supports unlimited employee roster accounts",
            "Bank account name verification prior to disbursement",
            "Configurable allowances (Housing, Transport, Utility)",
            "Instant payout reconciliation reports",
        ],
    },
    {
        packageId: "inventory-pos",
        name: "Smart Inventory & Cloud POS System",
        shortName: "Inventory & POS",
        tagline: "Real-time stock tracking, multi-warehouse control & high-speed checkout",
        description: "Modern retail and wholesale inventory control system coupled with an offline-capable Point of Sale register, barcode scanner integration, stock replenishment alerts, and profit margin analytics.",
        category: "COMMERCE_POS",
        badge: "Commerce Suite",
        badgeTone: "blue",
        isCore: false,
        autoChecked: false,
        priceMonthly: 20000,
        priceAnnual: 204000,
        pricingModel: "FLAT_MONTHLY",
        priceFormatted: "₦20,000 / month flat",
        accentColor: "#3b82f6",
        glowColor: "rgba(59, 130, 246, 0.15)",
        sortOrder: 3,
        subFeatures: [
            {
                id: "cloud-pos",
                name: "High-Speed Cloud & Offline POS",
                shortDesc: "Fast barcode cashier terminal, split payments (Cash/Card/Transfer), thermal receipt printing.",
                badge: "Offline Ready",
                iconName: "Store",
            },
            {
                id: "stock-tracking",
                name: "Real-Time Stock & Low Inventory Alerts",
                shortDesc: "SKU variations, batch expiration dates, automated reorder thresholds, and shrinkage audit.",
                badge: "Live Sync",
                iconName: "Boxes",
            },
            {
                id: "multi-warehouse",
                name: "Multi-Store & Warehouse Transfers",
                shortDesc: "Inter-branch consignment transfers, stock balance reconciliation, and depot management.",
                badge: "Multi-Branch",
                iconName: "Warehouse",
            },
            {
                id: "pos-analytics",
                name: "Gross Margin & Sales Analytics",
                shortDesc: "Top-selling SKUs, cashier shift reconciliations, daily revenue breakdown by payment channel.",
                badge: "Analytics",
                iconName: "TrendingUp",
            },
        ],
        keyHighlights: [
            "Works with USB, Bluetooth and WiFi barcode scanners",
            "Instant Paystack QR code dynamic payment at counter",
            "Multi-store unified catalog sync",
            "Automated supplier purchase order generation",
        ],
        systemCapabilities: [
            "Customer loyalty points & store credit management",
            "Cash drawer & thermal ESC/POS printer support",
            "Product variant matrix (Sizes, Colors, Bundles)",
            "Stock valuation reports (FIFO / Average Costing)",
        ],
    },
    {
        packageId: "logistics",
        name: "Fleet, Dispatch & Logistics Tracking System",
        shortName: "Logistics & Fleet",
        tagline: "End-to-end waybill management, live courier tracking & delivery verification",
        description: "Full-cycle dispatch management platform for 3PLs, e-commerce fleets, and courier companies. Includes digital waybill issuance, live GPS delivery tracking, automated customer SMS updates, and proof-of-delivery signatures.",
        category: "LOGISTICS",
        badge: "Supply Chain",
        badgeTone: "warning",
        isCore: false,
        autoChecked: false,
        priceMonthly: 25000,
        priceAnnual: 255000,
        pricingModel: "FLAT_MONTHLY",
        priceFormatted: "₦25,000 / month flat",
        accentColor: "#f59e0b",
        glowColor: "rgba(245, 158, 11, 0.15)",
        sortOrder: 4,
        subFeatures: [
            {
                id: "waybill-engine",
                name: "Digital Waybill & Consignment Generator",
                shortDesc: "Generate scannable QR code waybills, package manifests, and multi-piece shipment labels.",
                badge: "Barcode Ready",
                iconName: "FileSpreadsheet",
            },
            {
                id: "live-fleet-tracking",
                name: "Fleet Dispatch & Courier GPS Route",
                shortDesc: "Driver assignment, dynamic route sequencing, speed & transit milestone telemetry.",
                badge: "Live Telemetry",
                iconName: "Truck",
            },
            {
                id: "customer-tracking-portal",
                name: "Branded Customer Tracking Portal",
                shortDesc: "Live tracking links via SMS/WhatsApp with real-time ETA and driver contact.",
                badge: "SMS & WhatsApp",
                iconName: "Navigation",
            },
            {
                id: "pod-signature",
                name: "Proof of Delivery (POD) & E-Sign",
                shortDesc: "Recipient signature capture, photo evidence upload, and OTP package release.",
                badge: "OTP Verified",
                iconName: "BadgeCheck",
            },
        ],
        keyHighlights: [
            "Rider/driver companion mobile web view",
            "Automated SMS/Email parcel status triggers",
            "Delivery zone & tariff distance calculator",
            "Failed delivery & return-to-origin (RTO) workflow",
        ],
        systemCapabilities: [
            "Bulk CSV consignment order import",
            "Cash-on-Delivery (COD) reconciliation ledger",
            "Vehicle maintenance logs and fuel tracking",
            "Webhook API for e-commerce website integration",
        ],
    },
    {
        packageId: "hotel-booking",
        name: "Hotel & Hospitality Reservation Engine",
        shortName: "Hotel Booking System",
        tagline: "Room inventory grid, front-desk check-in, housekeeping & online booking engine",
        description: "All-in-one hospitality property management system (PMS) for boutique hotels, guest houses, and resort chains. Features interactive room reservation grid, guest folio billing, online booking portal, and housekeeping sync.",
        category: "HOSPITALITY",
        badge: "Hospitality Suite",
        badgeTone: "danger",
        isCore: false,
        autoChecked: false,
        priceMonthly: 30000,
        priceAnnual: 306000,
        pricingModel: "FLAT_MONTHLY",
        priceFormatted: "₦30,000 / month flat",
        accentColor: "#f43f5e",
        glowColor: "rgba(244, 63, 94, 0.15)",
        sortOrder: 5,
        subFeatures: [
            {
                id: "room-grid",
                name: "Interactive Room & Reservation Grid",
                shortDesc: "Visual calendar matrix of room categories, suites, occupancy rates, and maintenance blocks.",
                badge: "Visual PMS",
                iconName: "BedDouble",
            },
            {
                id: "front-desk-checkin",
                name: "Front Desk Check-in & Guest Folio",
                shortDesc: "Fast guest registration, digital keycard assignments, deposit tracking, and unified bill settlement.",
                badge: "Front Desk",
                iconName: "Key",
            },
            {
                id: "direct-online-booking",
                name: "Direct Online Booking Widget",
                shortDesc: "Embeddable website reservation engine with instant Paystack payment and confirmation emails.",
                badge: "Zero OTA Commission",
                iconName: "Globe2",
            },
            {
                id: "housekeeping-pos",
                name: "Housekeeping & Restaurant POS Sync",
                shortDesc: "Live room cleaning status (Dirty/Clean/Inspected) and restaurant tab charges to room folio.",
                badge: "POS Synced",
                iconName: "Sparkles",
            },
        ],
        keyHighlights: [
            "Direct commission-free room bookings",
            "Unified guest folio (Room + Dining + Laundry)",
            "Daily night audit & occupancy reports",
            "Multi-property group administration",
        ],
        systemCapabilities: [
            "Dynamic seasonal rate pricing manager",
            "Guest ID scan and corporate billing agreements",
            "Minibar and room service charge integration",
            "Automated post-stay review collection emails",
        ],
    },
];
/**
 * Seeds and migrates packages into MongoDB database
 */
async function seedPackages(forceUpdate = false) {
    try {
        const existingCount = await package_model_js_1.PackageModel.countDocuments();
        if (existingCount === 0 || forceUpdate) {
            console.log(`🌱 [Database Seeder] Seeding ${exports.INITIAL_PACKAGES.length} product packages into MongoDB...`);
            for (const pkg of exports.INITIAL_PACKAGES) {
                await package_model_js_1.PackageModel.findOneAndUpdate({ packageId: pkg.packageId }, { $set: pkg }, { upsert: true, new: true });
            }
            console.log(`✅ [Database Seeder] Successfully seeded all product packages.`);
        }
        else {
            console.log(`📦 [Database Seeder] ${existingCount} product packages already present in MongoDB.`);
        }
    }
    catch (error) {
        console.error("❌ [Database Seeder] Error seeding packages:", error);
    }
}
