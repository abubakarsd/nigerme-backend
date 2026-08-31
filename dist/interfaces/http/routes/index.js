"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_js_1 = require("../controllers/auth.controller.js");
const kyc_controller_js_1 = require("../controllers/kyc.controller.js");
const storage_controller_js_1 = require("../controllers/storage.controller.js");
const payment_controller_js_1 = require("../controllers/payment.controller.js");
const organization_controller_js_1 = require("../controllers/organization.controller.js");
const user_controller_js_1 = require("../controllers/user.controller.js");
const audit_controller_js_1 = require("../controllers/audit.controller.js");
const abuse_controller_js_1 = require("../controllers/abuse.controller.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const validate_middleware_js_1 = require("../middlewares/validate.middleware.js");
const rateLimiter_middleware_js_1 = require("../middlewares/rateLimiter.middleware.js");
const apiRouter = (0, express_1.Router)();
// ─── Health Check ───
apiRouter.get("/health", (_req, res) => {
    res.status(200).json({
        status: "healthy",
        service: "nigerme-enterprise-backend",
        timestamp: new Date().toISOString(),
    });
});
// ─── 1. Authentication Routes (Dual: Admin SaaS & Added Mail Users) ───
const authRouter = (0, express_1.Router)();
// A. Admin SaaS Auth (Public Signups & Admin Logins)
authRouter.post("/signup", rateLimiter_middleware_js_1.authLimiter, (0, validate_middleware_js_1.validate)(auth_controller_js_1.signupSchema), auth_controller_js_1.AuthController.signup);
authRouter.post("/admin/signup", rateLimiter_middleware_js_1.authLimiter, (0, validate_middleware_js_1.validate)(auth_controller_js_1.signupSchema), auth_controller_js_1.AuthController.signup);
authRouter.post("/login", rateLimiter_middleware_js_1.authLimiter, (0, validate_middleware_js_1.validate)(auth_controller_js_1.loginSchema), auth_controller_js_1.AuthController.login);
authRouter.post("/admin/login", rateLimiter_middleware_js_1.authLimiter, (0, validate_middleware_js_1.validate)(auth_controller_js_1.loginSchema), auth_controller_js_1.AuthController.login);
// B. Webmail User Auth (Only for added users within an organization)
authRouter.post("/mail/login", rateLimiter_middleware_js_1.authLimiter, (0, validate_middleware_js_1.validate)(auth_controller_js_1.loginSchema), auth_controller_js_1.AuthController.mailLogin);
authRouter.post("/user/login", rateLimiter_middleware_js_1.authLimiter, (0, validate_middleware_js_1.validate)(auth_controller_js_1.loginSchema), auth_controller_js_1.AuthController.mailLogin);
authRouter.post("/mail/set-password", rateLimiter_middleware_js_1.authLimiter, (0, validate_middleware_js_1.validate)(auth_controller_js_1.setInitialPasswordSchema), auth_controller_js_1.AuthController.setInitialPassword);
// C. 2FA & OTP Operations
authRouter.post("/verify-2fa", rateLimiter_middleware_js_1.authLimiter, (0, validate_middleware_js_1.validate)(auth_controller_js_1.verifyOtpSchema), auth_controller_js_1.AuthController.verify2fa);
authRouter.post("/otp/request", rateLimiter_middleware_js_1.otpLimiter, auth_controller_js_1.AuthController.requestPhoneOtp);
authRouter.post("/refresh", auth_controller_js_1.AuthController.refreshToken);
apiRouter.use("/auth", authRouter);
// ─── 2. User Profile & Settings Routes ───
const userRouter = (0, express_1.Router)();
userRouter.use(auth_middleware_js_1.authenticate);
userRouter.get("/profile", user_controller_js_1.UserController.getProfile);
userRouter.put("/profile", (0, validate_middleware_js_1.validate)(user_controller_js_1.updateProfileSchema), user_controller_js_1.UserController.updateProfile);
userRouter.post("/change-password", (0, validate_middleware_js_1.validate)(user_controller_js_1.changePasswordSchema), user_controller_js_1.UserController.changePassword);
userRouter.post("/toggle-2fa", (0, validate_middleware_js_1.validate)(user_controller_js_1.toggle2faSchema), user_controller_js_1.UserController.toggle2fa);
userRouter.get("/list", user_controller_js_1.UserController.listUsers);
apiRouter.use("/users", userRouter);
// ─── 3. Organization & Multi-tenancy Routes ───
const orgRouter = (0, express_1.Router)();
orgRouter.use(auth_middleware_js_1.authenticate);
orgRouter.get("/me", organization_controller_js_1.OrganizationController.getMyOrganization);
orgRouter.put("/update", (0, validate_middleware_js_1.validate)(organization_controller_js_1.updateOrgSchema), organization_controller_js_1.OrganizationController.updateOrganization);
orgRouter.post("/verify-dns", organization_controller_js_1.OrganizationController.verifyDns);
orgRouter.get("/members", organization_controller_js_1.OrganizationController.getMembers);
orgRouter.post("/invite", (0, validate_middleware_js_1.validate)(organization_controller_js_1.inviteMemberSchema), organization_controller_js_1.OrganizationController.inviteMember);
orgRouter.get("/stats", organization_controller_js_1.OrganizationController.getUsageStats);
apiRouter.use("/organization", orgRouter);
// ─── 4. KYC Identity Verification Routes (Provn) ───
const kycRouter = (0, express_1.Router)();
kycRouter.use(auth_middleware_js_1.authenticate);
kycRouter.post("/submit", (0, validate_middleware_js_1.validate)(kyc_controller_js_1.submitKycSchema), kyc_controller_js_1.KycController.submitKyc);
kycRouter.get("/status", kyc_controller_js_1.KycController.getStatus);
kycRouter.get("/organization-records", kyc_controller_js_1.KycController.getOrganizationRecords);
kycRouter.post("/manual-review", (0, validate_middleware_js_1.validate)(kyc_controller_js_1.manualReviewSchema), kyc_controller_js_1.KycController.manualReview);
apiRouter.use("/kyc", kycRouter);
// ─── 5. Storage Routes (AWS S3) ───
const storageRouter = (0, express_1.Router)();
storageRouter.use(auth_middleware_js_1.authenticate);
storageRouter.post("/presigned-upload", (0, validate_middleware_js_1.validate)(storage_controller_js_1.presignedUploadSchema), storage_controller_js_1.StorageController.getPresignedUploadUrl);
storageRouter.get("/file-url", storage_controller_js_1.StorageController.getSecureFileUrl);
apiRouter.use("/storage", storageRouter);
// ─── 6. Payment & Ledger Routes (Paystack) ───
const paymentRouter = (0, express_1.Router)();
paymentRouter.post("/fund-wallet", auth_middleware_js_1.authenticate, (0, validate_middleware_js_1.validate)(payment_controller_js_1.fundWalletSchema), payment_controller_js_1.PaymentController.initializeFunding);
paymentRouter.get("/verify", auth_middleware_js_1.authenticate, payment_controller_js_1.PaymentController.verifyPayment);
paymentRouter.get("/transactions", auth_middleware_js_1.authenticate, payment_controller_js_1.PaymentController.getTransactions);
paymentRouter.post("/webhooks/paystack", payment_controller_js_1.PaymentController.handleWebhook);
apiRouter.use("/payments", paymentRouter);
// ─── 7. Audit Logs Routes ───
const auditRouter = (0, express_1.Router)();
auditRouter.use(auth_middleware_js_1.authenticate);
auditRouter.get("/", audit_controller_js_1.AuditController.getLogs);
apiRouter.use("/audit-logs", auditRouter);
// ─── 8. Security & Abuse Prevention Routes ───
const abuseRouter = (0, express_1.Router)();
abuseRouter.use(auth_middleware_js_1.authenticate);
abuseRouter.get("/cases", abuse_controller_js_1.AbuseController.getCases);
abuseRouter.post("/report", (0, validate_middleware_js_1.validate)(abuse_controller_js_1.reportAbuseSchema), abuse_controller_js_1.AbuseController.reportCase);
abuseRouter.post("/update-status", (0, validate_middleware_js_1.validate)(abuse_controller_js_1.updateCaseSchema), abuse_controller_js_1.AbuseController.updateStatus);
apiRouter.use("/abuse", abuseRouter);
exports.default = apiRouter;
