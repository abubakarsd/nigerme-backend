import { env } from "../../config/env.js";

export interface ProvnVerificationRequest {
  idType: "nin" | "bvn" | "drivers_license" | "voters_card" | "cac";
  idNumber: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
}

export interface ProvnVerificationResponse {
  status: "verified" | "failed" | "pending";
  referenceId: string;
  data?: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    dateOfBirth?: string;
    gender?: string;
    photoUrl?: string;
    phoneNumber?: string;
    nin?: string;
    bvn?: string;
    address?: string;
  };
  message?: string;
  rawResponse?: any;
}

export class ProvnClient {
  private static readonly BASE_URL = env.PROVN_URL.replace(/\/$/, "");

  private static sanitizeKey(k: string | undefined): string {
    if (!k) return "";
    return k.trim().replace(/^["']|["']$/g, "").trim();
  }

  private static getHeaders() {
    const apiKey = this.sanitizeKey(process.env.PROVN_API_KEY || env.PROVN_API_KEY);
    const accessKey = this.sanitizeKey(process.env.PROVN_ACCESS_KEY || env.PROVN_ACCESS_KEY);
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      "API-Key": apiKey,
      "Access-Key": accessKey,
    };
  }

  /**
   * Verifies identity with Provn API (NIN, BVN, CAC, or Driver's License)
   */
  static async verifyIdentity(req: ProvnVerificationRequest): Promise<ProvnVerificationResponse> {
    try {
      let endpoint = `${this.BASE_URL}/verification/identity`;
      let body: any = {
        id_number: req.idNumber,
        first_name: req.firstName,
        last_name: req.lastName,
        dob: req.dateOfBirth,
        phone: req.phoneNumber,
      };

      if (req.idType === "nin") {
        endpoint = `${this.BASE_URL}/verification/nin`;
        body = { nin: req.idNumber };
      } else if (req.idType === "bvn") {
        endpoint = `${this.BASE_URL}/verification/bvn`;
        body = { bvn: req.idNumber };
      } else if (req.idType === "cac") {
        endpoint = `${this.BASE_URL}/verification/cac`;
        body = { rc_number: req.idNumber };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      const responseData: any = await response.json();

      if (!response.ok) {
        console.error("Provn Error:", responseData);
        return {
          status: "failed",
          referenceId: responseData.reference || `PRV-FAIL-${Date.now()}`,
          message: responseData.message || `Provn error status ${response.status}`,
          rawResponse: responseData,
        };
      }

      const isVerified =
        responseData.status === "success" ||
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
    } catch (error: any) {
      console.error("Provn Client Exception:", error);
      throw new Error(error.message || "Failed to communicate with Provn KYC verification API.");
    }
  }
}
