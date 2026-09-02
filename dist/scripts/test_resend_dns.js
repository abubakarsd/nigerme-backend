"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const resend_1 = require("resend");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const apiKey = process.env.RESEND_ORG_API || process.env.RESEND_API;
console.log("Using API Key:", apiKey ? apiKey.substring(0, 8) + "..." : "NONE");
const resend = new resend_1.Resend(apiKey);
async function main() {
    try {
        const list = await resend.domains.list();
        console.log("Domains List response:", JSON.stringify(list, null, 2));
        if (list.data && list.data.data && list.data.data.length > 0) {
            const firstDom = list.data.data[0];
            console.log("Fetching first domain:", firstDom.id, firstDom.name);
            const detail = await resend.domains.get(firstDom.id);
            console.log("First domain detail:", JSON.stringify(detail, null, 2));
        }
    }
    catch (err) {
        console.error("Error:", err);
    }
}
main();
