import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { PasskeyModel, UserModel, OrganizationModel } from "../../models/index.js";
import { TokenManager } from "../../infrastructure/security/token.manager.js";
import mongoose from "mongoose";

// In-memory challenge store with auto-expiry for challenges
const challengeCache = new Map<string, { challenge: string; expiresAt: number }>();

function setChallenge(key: string, challenge: string) {
  challengeCache.set(key, {
    challenge,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes validity
  });
}

function getChallenge(key: string): string | null {
  const item = challengeCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    challengeCache.delete(key);
    return null;
  }
  challengeCache.delete(key);
  return item.challenge;
}

export class PasskeyService {
  private static getRpConfig(originHeader?: string) {
    const isDev = process.env.NODE_ENV !== "production";
    let rpID = "localhost";
    let origin: string | string[] = [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:4000",
      "https://localhost:3000",
    ];

    if (!isDev || (originHeader && !originHeader.includes("localhost"))) {
      if (originHeader) {
        try {
          const url = new URL(originHeader);
          rpID = url.hostname;
          origin = [`${url.protocol}//${url.host}`];
        } catch {
          rpID = process.env.PASSKEY_RP_ID || "nigerme.com";
          origin = [
            process.env.APP_URL || "https://nigerme.com",
            "https://app.nigerme.com",
            "https://mail.nigerme.com",
          ];
        }
      } else {
        rpID = process.env.PASSKEY_RP_ID || "nigerme.com";
        origin = [
          process.env.APP_URL || "https://nigerme.com",
          "https://app.nigerme.com",
          "https://mail.nigerme.com",
        ];
      }
    }

    return {
      rpName: "Nigerme Business Workspace",
      rpID,
      expectedOrigin: origin,
    };
  }

  /**
   * 1. Generate Registration Options (when user is in Settings)
   */
  static async generateRegistrationOptions(userId: string, originHeader?: string) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("User not found");

    const existingPasskeys = await PasskeyModel.find({ userId: user._id });
    const { rpName, rpID } = this.getRpConfig(originHeader);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(user._id.toString())),
      userName: user.email,
      userDisplayName: user.name || user.email.split("@")[0],
      attestationType: "none",
      excludeCredentials: existingPasskeys.map((pk) => ({
        id: pk.credentialId,
        transports: pk.transports as any,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    setChallenge(`reg:${user._id.toString()}`, options.challenge);
    return JSON.stringify(options);
  }

  /**
   * 2. Verify Registration Response & Store in MongoDB
   */
  static async verifyRegistration(
    userId: string,
    responseJson: string,
    friendlyName?: string,
    originHeader?: string
  ) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error("User not found");

    const expectedChallenge = getChallenge(`reg:${user._id.toString()}`);
    if (!expectedChallenge) {
      throw new Error("Passkey registration challenge expired. Please try again.");
    }

    const { expectedOrigin, rpID } = this.getRpConfig(originHeader);
    const body = JSON.parse(responseJson);

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Passkey registration verification failed.");
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const base64PublicKey = Buffer.from(credential.publicKey).toString("base64");

    // Save passkey in DB
    await PasskeyModel.create({
      userId: user._id,
      organizationId: user.organizationId,
      credentialId: credential.id,
      publicKey: base64PublicKey,
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: body.response?.transports || ["internal", "hybrid"],
      friendlyName: friendlyName?.trim() || "Phone / Security Key",
      lastUsedAt: new Date(),
    });

    // Mark user twoFactorEnabled = true if not already
    if (!user.twoFactorEnabled) {
      user.twoFactorEnabled = true;
      await user.save();
    }

    return true;
  }

  /**
   * 3. Generate Authentication Options (for MFA during login)
   */
  static async generateAuthenticationOptions(email: string, originHeader?: string) {
    const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (!user) throw new Error("User not found");

    const passkeys = await PasskeyModel.find({ userId: user._id });
    if (passkeys.length === 0) {
      throw new Error("No passkeys registered for this account.");
    }

    const { rpID } = this.getRpConfig(originHeader);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map((pk) => ({
        id: pk.credentialId,
        transports: pk.transports as any,
      })),
      userVerification: "preferred",
    });

    setChallenge(`auth:${user.email.toLowerCase()}`, options.challenge);
    return JSON.stringify(options);
  }

  /**
   * 4. Verify Authentication Response (finishes MFA sign-in)
   */
  static async verifyAuthentication(
    email: string,
    responseJson: string,
    originHeader?: string
  ) {
    const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (!user) throw new Error("User not found");

    const expectedChallenge = getChallenge(`auth:${user.email.toLowerCase()}`);
    if (!expectedChallenge) {
      throw new Error("Passkey session expired. Please sign in again.");
    }

    const body = JSON.parse(responseJson);
    const passkey = await PasskeyModel.findOne({
      userId: user._id,
      credentialId: body.id,
    });

    if (!passkey) {
      throw new Error("Unrecognized passkey credential.");
    }

    const { expectedOrigin, rpID } = this.getRpConfig(originHeader);

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64")),
        counter: passkey.counter,
        transports: passkey.transports as any,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      throw new Error("Passkey verification failed.");
    }

    // Update counter & last used
    passkey.counter = verification.authenticationInfo.newCounter;
    passkey.lastUsedAt = new Date();
    await passkey.save();

    // Generate tokens
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      userType: user.userType,
      organizationId: user.organizationId ? user.organizationId.toString() : undefined,
    };
    const accessToken = TokenManager.generateAccessToken(payload);
    const refreshToken = TokenManager.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId ? user.organizationId.toString() : "",
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }

  /**
   * 5. Get User's Registered Passkeys (for Settings page)
   */
  static async getMyPasskeys(userId: string) {
    const passkeys = await PasskeyModel.find({ userId }).sort({ createdAt: -1 });
    return passkeys.map((pk) => ({
      id: pk._id.toString(),
      credentialId: pk.credentialId,
      friendlyName: pk.friendlyName || "Phone / Security Key",
      deviceType: pk.deviceType,
      backedUp: pk.backedUp,
      createdAt: pk.createdAt.toISOString(),
      lastUsedAt: pk.lastUsedAt ? pk.lastUsedAt.toISOString() : null,
    }));
  }

  /**
   * 6. Delete / Revoke Passkey in Settings
   */
  static async deletePasskey(userId: string, passkeyId: string) {
    await PasskeyModel.deleteOne({ _id: passkeyId, userId });
    return true;
  }
}
