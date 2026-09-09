"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvnClient = void 0;
const env_js_1 = require("../../config/env.js");
class ProvnClient {
    static BASE_URL = env_js_1.env.PROVN_URL.replace(/\/$/, "");
    static getHeaders() {
        return {
            "Content-Type": "application/json",
            Accept: "application/json",
            "API-Key": process.env.PROVN_API_KEY || env_js_1.env.PROVN_API_KEY || "",
            "Access-Key": process.env.PROVN_ACCESS_KEY || env_js_1.env.PROVN_ACCESS_KEY || "",
        };
    }
    /**
     * Verifies identity with Provn API (NIN, BVN, CAC, or Driver's License)
     */
    static async verifyIdentity(req) {
        try {
            let endpoint = `${this.BASE_URL}/verification/identity`;
            let body = {
                id_number: req.idNumber,
                first_name: req.firstName,
                last_name: req.lastName,
                dob: req.dateOfBirth,
                phone: req.phoneNumber,
            };
            if (req.idType === "nin") {
                endpoint = `${this.BASE_URL}/verification/nin`;
                body = { nin: req.idNumber };
            }
            else if (req.idType === "bvn") {
                endpoint = `${this.BASE_URL}/verification/bvn`;
                body = { bvn: req.idNumber };
            }
            else if (req.idType === "cac") {
                endpoint = `${this.BASE_URL}/verification/cac`;
                body = { rc_number: req.idNumber };
            }
            const response = await fetch(endpoint, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify(body),
            });
            const responseData = await response.json();
            if (!response.ok) {
                console.error("Provn Verification Error Response:", responseData);
                return {
                    status: "failed",
                    referenceId: responseData.reference || `PRV-FAIL-${Date.now()}`,
                    message: responseData.message || `Provn error with status code ${response.status}`,
                    rawResponse: responseData,
                };
            }
            const isVerified = responseData.status === "success" ||
                responseData.status === "verified" ||
                responseData.verified === true;
            return {
                status: isVerified ? "verified" : "failed",
                referenceId: responseData.reference || responseData.data?.reference || `PRV-${Date.now()}`,
                data: {
                    firstName: responseData.data?.first_name || responseData.data?.firstName,
                    lastName: responseData.data?.last_name || responseData.data?.lastName,
                    middleName: responseData.data?.middle_name,
                    dateOfBirth: responseData.data?.date_of_birth || responseData.data?.dob || responseData.data?.dateOfBirth,
                    gender: responseData.data?.gender,
                    photoUrl: responseData.data?.photo,
                    phoneNumber: responseData.data?.phone_number || responseData.data?.phone,
                    nin: responseData.data?.nin,
                    bvn: responseData.data?.bvn,
                    address: responseData.data?.residential_address || responseData.data?.address,
                },
                message: responseData.message || "Identity verified successfully",
                rawResponse: responseData,
            };
        }
        catch (error) {
            console.error("Provn Client Exception:", error);
            throw new Error(error.message || "Failed to communicate with Provn KYC verification API.");
        }
    }
}
exports.ProvnClient = ProvnClient;
