"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeDefs = void 0;
const graphql_tag_1 = __importDefault(require("graphql-tag"));
exports.typeDefs = (0, graphql_tag_1.default) `
  # ─── Types ───

  type User {
    id: ID!
    email: String!
    name: String!
    phone: String
    role: String!
    userType: String!
    organizationId: ID
    isEmailVerified: Boolean!
    isPhoneVerified: Boolean!
    twoFactorEnabled: Boolean!
    mustChangePassword: Boolean
    canAccessEmail: Boolean!
    avatarUrl: String
    status: String!
    lastLoginAt: String
    createdAt: String!
  }

  type DnsStatus {
    spfStatus: String!
    dkimStatus: String!
    dmarcStatus: String!
    mxStatus: String!
    lastCheckedAt: String
  }

  type ResendDnsRecord {
    record: String!
    name: String!
    type: String!
    value: String!
    ttl: String
    status: String
    priority: Int
  }

  type DedicatedVirtualAccount {
    accountNumber: String!
    accountName: String!
    bankName: String!
    assignedAt: String
  }

  type RolePermissions {
    canAccessEmail: Boolean!
    canAccessPayroll: Boolean!
    canAccessPos: Boolean!
    canAccessLogistics: Boolean!
    canAccessHotel: Boolean!
    canAccessAdminConsole: Boolean!
    canManageBilling: Boolean!
    canManageUsers: Boolean!
    canManageDomains: Boolean!
  }

  type SystemPermission {
    id: ID!
    key: String!
    name: String!
    description: String!
    category: String!
    isSystem: Boolean!
  }

  type WorkspaceRole {
    id: ID!
    name: String!
    description: String
    isSystem: Boolean!
    memberCount: Int!
    permissions: RolePermissions!
  }

  type Department {
    id: ID!
    name: String!
    description: String
    lead: String
    memberIds: [String!]!
    packageAccess: [String!]!
    createdAt: String
  }

  type Organization {
    id: ID!
    name: String!
    domain: String!
    ownerId: ID!
    plan: String!
    walletBalance: Float!
    kycStatus: String!
    trustLevel: String!
    dailySendingLimit: Int!
    dnsVerification: DnsStatus
    resendDomainId: String
    resendStatus: String
    resendRegion: String
    resendRecords: [ResendDnsRecord!]
    dedicatedVirtualAccount: DedicatedVirtualAccount
    subscribedPackages: [String!]
    billingCycle: String
    autoDebitWallet: Boolean
    totalSeats: Int
    usedSeats: Int
    subscriptionStatus: String
    trialStartsAt: String
    trialEndsAt: String
    subscriptionStartsAt: String
    subscriptionExpiresAt: String
    gracePeriodEndsAt: String
    isSuspended: Boolean
    lastBillingReminderSentAt: String
    lastBillingReminderType: String
    industry: String
    phone: String
    supportEmail: String
    departments: [Department!]!
    roles: [WorkspaceRole!]!
    createdAt: String!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  type LoginResponse {
    requiresTwoFactor: Boolean!
    mustChangePassword: Boolean
    phone: String
    message: String
    tokens: AuthPayload
  }

  type InvitedMemberPayload {
    user: User!
    temporaryPassword: String
  }

  type OtpResponse {
    message: String!
    expiresInMinutes: Int!
  }

  type PresignedUploadPayload {
    uploadUrl: String!
    fileKey: String!
    publicUrl: String!
    expiresInSeconds: Int!
  }

  type KycRecord {
    id: ID!
    idType: String!
    maskedIdNumber: String!
    verificationStatus: String!
    idDocumentUrl: String
    verifiedAt: String
    failureReason: String
    createdAt: String!
  }

  type PaymentInitPayload {
    authorization_url: String!
    access_code: String!
    reference: String!
  }

  type Transaction {
    id: ID!
    reference: String!
    type: String!
    amount: Float!
    status: String!
    channel: String!
    currency: String!
    paidAt: String
    createdAt: String!
  }

  type AuditLog {
    id: ID!
    actorEmail: String!
    actorRole: String!
    action: String!
    targetResource: String!
    details: String
    ipAddress: String
    createdAt: String!
  }

  type AbuseCase {
    id: ID!
    organizationName: String!
    targetDomain: String!
    senderEmail: String!
    riskLevel: String!
    triggerReason: String!
    sendingVelocityHourly: Int!
    bounceRatePercent: Float!
    status: String!
    details: String
    createdAt: String!
  }

  type SubFeature {
    id: String!
    name: String!
    shortDesc: String!
    badge: String!
    iconName: String!
  }

  type ProductPackage {
    id: ID!
    packageId: String!
    name: String!
    shortName: String!
    tagline: String!
    description: String!
    category: String!
    badge: String!
    badgeTone: String!
    isCore: Boolean!
    autoChecked: Boolean!
    priceMonthly: Float!
    priceAnnual: Float!
    pricingModel: String!
    priceFormatted: String!
    accentColor: String!
    glowColor: String!
    subFeatures: [SubFeature!]!
    keyHighlights: [String!]!
    systemCapabilities: [String!]!
    isActive: Boolean!
    sortOrder: Int!
    createdAt: String!
    updatedAt: String!
  }

  type Subscription {
    id: ID!
    organizationId: ID!
    packageIds: [String!]!
    billingCycle: String!
    seatCount: Int!
    totalAmount: Float!
    currency: String!
    status: String!
    paymentMethod: String
    trialStartsAt: String
    trialEndsAt: String
    currentPeriodStartsAt: String!
    currentPeriodEndsAt: String!
    gracePeriodEndsAt: String
    autoDebit: Boolean!
    cancelledAt: String
    cancellationReason: String
    lastPaymentReference: String
    createdAt: String!
    updatedAt: String!
  }

  # ─── Inputs ───

  input SignupInput {
    name: String!
    email: String!
    password: String!
    phone: String
    organizationName: String
    domain: String
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input SetInitialPasswordInput {
    email: String!
    temporaryPassword: String!
    newPassword: String!
  }

  input SubmitKycInput {
    idType: String!
    idNumber: String!
    firstName: String
    lastName: String
    dateOfBirth: String
    phoneNumber: String
    idDocumentS3Key: String
    idDocumentUrl: String
    cacCertificateS3Key: String
    cacCertificateUrl: String
  }

  input RequestUploadUrlInput {
    folder: String!
    fileName: String!
    contentType: String!
  }

  input FundWalletInput {
    amountInNaira: Float!
    callbackUrl: String
  }

  input InviteMemberInput {
    name: String!
    email: String!
    role: String
    phone: String
    password: String
  }

  input UpdateOrganizationInput {
    name: String
    plan: String
    dailySendingLimit: Int
    subscribedPackages: [String!]
    billingCycle: String
    autoDebitWallet: Boolean
    totalSeats: Int
    industry: String
    phone: String
    supportEmail: String
  }

  # ─── Queries & Mutations ───

  type Query {
    # System
    healthCheck: String!

    # User & Organization
    me: User!
    myOrganization: Organization
    getOrganizationMembers: [User!]!

    # KYC Verification
    getKycStatus: KycRecord
    getOrganizationKycRecords: [KycRecord!]!

    # Storage (AWS S3)
    getSecureFileUrl(fileKey: String!): String!

    # Billing & Ledger (Paystack)
    getTransactions(limit: Int): [Transaction!]!
    getWalletBalance: Float!

    # Audit & Security
    getAuditLogs(limit: Int): [AuditLog!]!
    getAbuseCases: [AbuseCase!]!

    # Product Packages & Pricing
    getPackages: [ProductPackage!]!
    getPackage(packageId: String!): ProductPackage

    # Subscriptions & Plan Management
    getOrganizationSubscriptions(limit: Int): [Subscription!]!
    getCurrentSubscription: Subscription

    # Departments & Roles & Permissions
    getPermissions: [SystemPermission!]!
    getOrganizationDepartments: [Department!]!
    getOrganizationRoles: [WorkspaceRole!]!
  }

  type Mutation {
    # ── Auth & OTP ──
    signup(input: SignupInput!): AuthPayload!
    login(input: LoginInput!): LoginResponse!
    mailLogin(input: LoginInput!): LoginResponse!
    setInitialPassword(input: SetInitialPasswordInput!): AuthPayload!
    verify2fa(phone: String!, code: String!): AuthPayload!
    requestPhoneOtp(phone: String!, purpose: String): OtpResponse!
    requestEmailOtp(email: String!, name: String, purpose: String): OtpResponse!
    verifyEmailOtp(email: String!, code: String!, purpose: String): Boolean!
    refreshToken(refreshToken: String!): AuthPayload!

    # ── Organization & Domain & Users ──
    updateOrganization(input: UpdateOrganizationInput!): Organization!
    subscribePackage(packageId: String!): Organization!
    cancelPackageSubscription(packageId: String!): Organization!
    activateSubscriptionFromWallet(packageIds: [String!]!, billingCycle: String!, totalSeats: Int!): Organization!
    verifyDomainDns: Organization!
    inviteMember(input: InviteMemberInput!): InvitedMemberPayload!
    updateUserStatus(userId: ID!, status: String!): User!
    deleteUser(userId: ID!): Boolean!

    # ── Subscriptions ──
    updateSubscriptionAutoDebit(autoDebit: Boolean!): Subscription!
    cancelSubscription(reason: String): Subscription!

    # ── Departments ──
    createDepartment(input: DepartmentInput!): Department!
    updateDepartment(id: ID!, input: DepartmentInput!): Department!
    deleteDepartment(id: ID!): Boolean!

    # ── Roles ──
    createRole(input: RoleInput!): WorkspaceRole!
    updateRole(id: ID!, input: RoleInput!): WorkspaceRole!
    deleteRole(id: ID!): Boolean!

    # ── Storage (AWS S3) ──
    getPresignedUploadUrl(input: RequestUploadUrlInput!): PresignedUploadPayload!

    # ── KYC (Provn) ──
    submitKyc(input: SubmitKycInput!): KycRecord!

    # ── Payments (Paystack & Direct Funding) ──
    initializeWalletFunding(input: FundWalletInput!): PaymentInitPayload!
    fundWalletDirect(amountInNaira: Float!, channel: String, description: String): Transaction!

    # ── Email Dispatch (Resend) ──
    sendEmail(input: SendEmailInput!): EmailResponse!
    sendOtpEmail(email: String!): EmailResponse!

    # ── Product Packages & Pricing Admin ──
    updatePackagePricing(packageId: String!, input: UpdatePackagePricingInput!): ProductPackage!
    resetPackagesToDefault: [ProductPackage!]!
  }

  input UpdatePackagePricingInput {
    priceMonthly: Float
    priceAnnual: Float
    priceFormatted: String
  }

  input RolePermissionsInput {
    canAccessEmail: Boolean
    canAccessPayroll: Boolean
    canAccessPos: Boolean
    canAccessLogistics: Boolean
    canAccessHotel: Boolean
    canAccessAdminConsole: Boolean
    canManageBilling: Boolean
    canManageUsers: Boolean
    canManageDomains: Boolean
  }

  input RoleInput {
    name: String!
    description: String
    isSystem: Boolean
    permissions: RolePermissionsInput!
  }

  input DepartmentInput {
    name: String!
    description: String
    lead: String
    memberIds: [String!]
    packageAccess: [String!]
  }

  type EmailResponse {
    success: Boolean!
    message: String!
  }

  input SendEmailInput {
    to: String!
    subject: String!
    html: String!
    text: String
  }
`;
