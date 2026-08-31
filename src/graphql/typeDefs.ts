import gql from "graphql-tag";

export const typeDefs = gql`
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

  type DedicatedVirtualAccount {
    accountNumber: String!
    accountName: String!
    bankName: String!
    assignedAt: String
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
    dedicatedVirtualAccount: DedicatedVirtualAccount
    subscribedPackages: [String!]
    billingCycle: String
    autoDebitWallet: Boolean
    totalSeats: Int
    usedSeats: Int
    industry: String
    phone: String
    supportEmail: String
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
    verifyDomainDns: Organization!
    inviteMember(input: InviteMemberInput!): InvitedMemberPayload!
    updateUserStatus(userId: ID!, status: String!): User!
    deleteUser(userId: ID!): Boolean!

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
