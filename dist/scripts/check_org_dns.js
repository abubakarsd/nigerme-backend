"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const organization_model_js_1 = require("../infrastructure/database/models/organization.model.js");
async function main() {
    await mongoose_1.default.connect(process.env.MONGODB_URI || "");
    const orgs = await organization_model_js_1.OrganizationModel.find({});
    console.log("Found", orgs.length, "organizations in DB:");
    for (const o of orgs) {
        console.log({
            id: o._id.toString(),
            name: o.name,
            domain: o.domain,
            resendDomainId: o.resendDomainId,
            resendStatus: o.resendStatus,
            recordsCount: o.resendRecords?.length,
            records: o.resendRecords,
        });
    }
    await mongoose_1.default.disconnect();
}
main();
