import { Router } from "express";
import {
  AuthController,
  signupSchema,
  loginSchema,
  setInitialPasswordSchema,
  verifyOtpSchema,
} from "../controllers/auth.controller.js";
import { KycController, submitKycSchema, manualReviewSchema } from "../controllers/kyc.controller.js";
import { StorageController, presignedUploadSchema } from "../controllers/storage.controller.js";
import { PaymentController, fundWalletSchema } from "../controllers/payment.controller.js";
import {
  OrganizationController,
  updateOrgSchema,
  inviteMemberSchema,
} from "../controllers/organization.controller.js";
import {
  UserController,
  updateProfileSchema,
  changePasswordSchema,
  toggle2faSchema,
} from "../controllers/user.controller.js";
import { AuditController } from "../controllers/audit.controller.js";
import { AbuseController, reportAbuseSchema, updateCaseSchema } from "../controllers/abuse.controller.js";
import packageRouter from "./package.routes.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authLimiter, otpLimiter } from "../middlewares/rateLimiter.middleware.js";

const apiRouter = Router();

// ─── Health Check ───
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "nigerme-enterprise-backend",
    timestamp: new Date().toISOString(),
  });
});

// ─── 1. Authentication Routes (Dual: Admin SaaS & Added Mail Users) ───
const authRouter = Router();

// A. Admin SaaS Auth (Public Signups & Admin Logins)
authRouter.post("/signup", authLimiter, validate(signupSchema), AuthController.signup);
authRouter.post("/admin/signup", authLimiter, validate(signupSchema), AuthController.signup);
authRouter.post("/login", authLimiter, validate(loginSchema), AuthController.login);
authRouter.post("/admin/login", authLimiter, validate(loginSchema), AuthController.login);

// B. Webmail User Auth (Only for added users within an organization)
authRouter.post("/mail/login", authLimiter, validate(loginSchema), AuthController.mailLogin);
authRouter.post("/user/login", authLimiter, validate(loginSchema), AuthController.mailLogin);
authRouter.post(
  "/mail/set-password",
  authLimiter,
  validate(setInitialPasswordSchema),
  AuthController.setInitialPassword
);

// C. 2FA & OTP Operations
authRouter.post("/verify-2fa", authLimiter, validate(verifyOtpSchema), AuthController.verify2fa);
authRouter.post("/otp/request", otpLimiter, AuthController.requestPhoneOtp);
authRouter.post("/refresh", AuthController.refreshToken);

apiRouter.use("/auth", authRouter);

// ─── 2. User Profile & Settings Routes ───
const userRouter = Router();
userRouter.use(authenticate);
userRouter.get("/profile", UserController.getProfile);
userRouter.put("/profile", validate(updateProfileSchema), UserController.updateProfile);
userRouter.post("/change-password", validate(changePasswordSchema), UserController.changePassword);
userRouter.post("/toggle-2fa", validate(toggle2faSchema), UserController.toggle2fa);
userRouter.get("/list", UserController.listUsers);
apiRouter.use("/users", userRouter);

// ─── 3. Organization & Multi-tenancy Routes ───
const orgRouter = Router();
orgRouter.use(authenticate);
orgRouter.get("/me", OrganizationController.getMyOrganization);
orgRouter.put("/update", validate(updateOrgSchema), OrganizationController.updateOrganization);
orgRouter.post("/verify-dns", OrganizationController.verifyDns);
orgRouter.get("/members", OrganizationController.getMembers);
orgRouter.post("/invite", validate(inviteMemberSchema), OrganizationController.inviteMember);
orgRouter.get("/stats", OrganizationController.getUsageStats);
apiRouter.use("/organization", orgRouter);

// ─── 4. KYC Identity Verification Routes (Provn) ───
const kycRouter = Router();
kycRouter.use(authenticate);
kycRouter.post("/submit", validate(submitKycSchema), KycController.submitKyc);
kycRouter.get("/status", KycController.getStatus);
kycRouter.get("/organization-records", KycController.getOrganizationRecords);
kycRouter.post("/manual-review", validate(manualReviewSchema), KycController.manualReview);
apiRouter.use("/kyc", kycRouter);

// ─── 5. Storage Routes (AWS S3) ───
const storageRouter = Router();
storageRouter.use(authenticate);
storageRouter.post("/presigned-upload", validate(presignedUploadSchema), StorageController.getPresignedUploadUrl);
storageRouter.get("/file-url", StorageController.getSecureFileUrl);
apiRouter.use("/storage", storageRouter);

// ─── 6. Payment & Ledger Routes (Paystack) ───
const paymentRouter = Router();
paymentRouter.post("/fund-wallet", authenticate, validate(fundWalletSchema), PaymentController.initializeFunding);
paymentRouter.get("/verify", authenticate, PaymentController.verifyPayment);
paymentRouter.get("/transactions", authenticate, PaymentController.getTransactions);
paymentRouter.post("/webhooks/paystack", PaymentController.handleWebhook);
apiRouter.use("/payments", paymentRouter);

// ─── 7. Audit Logs Routes ───
const auditRouter = Router();
auditRouter.use(authenticate);
auditRouter.get("/", AuditController.getLogs);
apiRouter.use("/audit-logs", auditRouter);

// ─── 8. Security & Abuse Prevention Routes ───
const abuseRouter = Router();
abuseRouter.use(authenticate);
abuseRouter.get("/cases", AbuseController.getCases);
abuseRouter.post("/report", validate(reportAbuseSchema), AbuseController.reportCase);
abuseRouter.post("/update-status", validate(updateCaseSchema), AbuseController.updateStatus);
apiRouter.use("/abuse", abuseRouter);

// ─── 9. Product Packages & Pricing Routes ───
apiRouter.use("/packages", packageRouter);

export default apiRouter;
