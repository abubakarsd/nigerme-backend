import gql from "graphql-tag";

export const typeDefs = gql`
  # ─── Types ───

  type User {
    id: ID!
    email: String!
    personalEmail: String
    name: String!
    phone: String
    role: String!
    roleId: ID
    roleName: String
    department: String
    departmentId: ID
    userType: String!
    organizationId: ID
    isEmailVerified: Boolean!
    isPhoneVerified: Boolean!
    twoFactorEnabled: Boolean!
    mustChangePassword: Boolean
    canAccessEmail: Boolean!
    canAccessPayroll: Boolean
    canAccessPos: Boolean
    canAccessLogistics: Boolean
    canAccessHotel: Boolean
    canAccessAdminConsole: Boolean
    accessiblePackages: [String!]
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

  type EmailMetricTotals {
    sent: Int!
    delivered: Int!
    open_rate: Float!
  }

  type EmailMetricDataPoint {
    period: String!
    domain_id: String
    domain_name: String!
    sent: Int!
    delivered: Int!
    open_rate: Float!
  }

  type DomainCheckResult {
    domain: String!
    isOnline: Boolean!
    hasMx: Boolean!
    hasNs: Boolean!
    message: String!
  }

  type EmailMetricsResponse {
    object: String!
    start_date: String!
    end_date: String!
    metrics: [String!]!
    dimensions: [String!]!
    granularity: String!
    totals: EmailMetricTotals!
    data: [EmailMetricDataPoint!]!
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
    code: String
    description: String
    lead: String
    leadName: String
    leadEmail: String
    leadId: ID
    color: String
    memberCount: Int!
    memberIds: [String!]
    createdAt: String
    updatedAt: String
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
    twoFactorType: String
    mustChangePassword: Boolean
    phone: String
    personalEmail: String
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
    personalEmail: String
    role: String
    roleId: ID
    department: String
    departmentId: ID
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
    getDepartmentById(id: ID!): Department
    getOrganizationRoles: [WorkspaceRole!]!

    # Resend Email Metrics & Analytics
    getEmailMetrics(startDate: String, endDate: String): EmailMetricsResponse!

    # Public Domain Online Verification
    checkDomainOnline(domain: String!): DomainCheckResult!

    # Webmail Client Queries
    getMyEmails(folder: String, category: String, search: String, limit: Int, offset: Int): [WebmailMessage!]!
    getEmailById(id: ID!): WebmailMessage
    getMailboxCounts: MailboxCounts!

    # Calendar Events
    getCalendarEvents(start: String, end: String, type: String): [CalendarEvent!]!
    getCalendarEventById(id: ID!): CalendarEvent

    # Passkey & WebAuthn Queries
    getPasskeyRegistrationOptions: String!
    getPasskeyAuthOptions(email: String!): String!
    getMyPasskeys: [PasskeyCredentialInfo!]!
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

    # ── Passkey & WebAuthn Mutations ──
    verifyPasskeyRegistration(responseJson: String!, friendlyName: String): Boolean!
    verifyPasskeyAuth(email: String!, responseJson: String!): AuthPayload!
    deletePasskey(id: ID!): Boolean!
    requestPasskeyOtpFallback(email: String!): OtpResponse!

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
    assignUserDepartment(userId: ID!, departmentId: ID): User!

    # ── Roles ──
    createRole(input: RoleInput!): WorkspaceRole!
    updateRole(id: ID!, input: RoleInput!): WorkspaceRole!
    deleteRole(id: ID!): Boolean!
    assignUserRole(userId: ID!, roleId: ID!): User!

    # ── Storage (AWS S3) ──
    getPresignedUploadUrl(input: RequestUploadUrlInput!): PresignedUploadPayload!

    # ── KYC (Provn) ──
    submitKyc(input: SubmitKycInput!): KycRecord!

    # ── Payments (Paystack & Direct Funding) ──
    initializeWalletFunding(input: FundWalletInput!): PaymentInitPayload!
    fundWalletDirect(amountInNaira: Float!, channel: String, description: String): Transaction!

    # ── Webmail Client Dispatch & Management ──
    sendMail(input: SendMailInput!): WebmailMessage!
    updateEmailStatus(id: ID!, folder: String, isRead: Boolean, isStarred: Boolean, isImportant: Boolean): WebmailMessage!
    deleteEmail(id: ID!, permanent: Boolean): Boolean!

    # ── Legacy / System Email Dispatch (Resend) ──
    sendEmail(input: SendEmailInput!): EmailResponse!
    sendOtpEmail(email: String!): EmailResponse!

    # ── Product Packages & Pricing Admin ──
    updatePackagePricing(packageId: String!, input: UpdatePackagePricingInput!): ProductPackage!
    resetPackagesToDefault: [ProductPackage!]!

    # ── Calendar Management ──
    createCalendarEvent(input: CreateCalendarEventInput!): CalendarEvent!
    updateCalendarEvent(id: ID!, input: UpdateCalendarEventInput!): CalendarEvent!
    deleteCalendarEvent(id: ID!): Boolean!
  }

  type PasskeyCredentialInfo {
    id: ID!
    credentialId: String!
    friendlyName: String!
    deviceType: String!
    backedUp: Boolean!
    createdAt: String!
    lastUsedAt: String
  }

  type CalendarAttendee {
    name: String!
    email: String!
    userId: ID
    status: String!
  }

  input CalendarAttendeeInput {
    name: String!
    email: String!
    userId: ID
    status: String
  }

  type CalendarEvent {
    id: ID!
    organizationId: ID!
    organizerId: ID!
    organizerName: String!
    organizerEmail: String!
    title: String!
    description: String
    start: String!
    end: String!
    allDay: Boolean
    timezone: String
    location: String
    meetUrl: String
    attendees: [CalendarAttendee!]!
    color: String!
    type: String!
    relatedTaskId: String
    relatedEmailId: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateCalendarEventInput {
    title: String!
    description: String
    start: String!
    end: String!
    allDay: Boolean
    timezone: String
    location: String
    meetUrl: String
    attendees: [CalendarAttendeeInput!]
    color: String
    type: String
    relatedTaskId: String
    relatedEmailId: String
  }

  input UpdateCalendarEventInput {
    title: String
    description: String
    start: String
    end: String
    allDay: Boolean
    timezone: String
    location: String
    meetUrl: String
    attendees: [CalendarAttendeeInput!]
    color: String
    type: String
  }

  type EmailParticipant {
    name: String!
    email: String!
    avatar: String
  }

  type EmailAttachment {
    id: String!
    name: String!
    sizeBytes: Int!
    contentType: String!
    downloadUrl: String
    contentId: String
  }

  type WebmailMessage {
    id: ID!
    threadId: String!
    folder: String!
    category: String!
    from: EmailParticipant!
    to: [EmailParticipant!]!
    cc: [EmailParticipant!]
    bcc: [EmailParticipant!]
    replyTo: String
    subject: String!
    preview: String!
    bodyHtml: String!
    bodyText: String!
    attachments: [EmailAttachment!]!
    isRead: Boolean!
    isStarred: Boolean!
    isImportant: Boolean!
    labels: [String!]!
    status: String!
    receivedAt: String
    sentAt: String
    createdAt: String!
  }

  type MailboxCounts {
    inbox: Int!
    unread: Int!
    starred: Int!
    sent: Int!
    drafts: Int!
    spam: Int!
    trash: Int!
    archive: Int!
  }

  input EmailParticipantInput {
    name: String
    email: String!
  }

  input EmailAttachmentInput {
    id: String
    name: String!
    sizeBytes: Int
    contentType: String
    downloadUrl: String
    contentId: String
    content: String
  }

  input SendMailInput {
    to: [EmailParticipantInput!]!
    cc: [EmailParticipantInput!]
    bcc: [EmailParticipantInput!]
    replyTo: String
    subject: String
    bodyHtml: String!
    bodyText: String
    attachments: [EmailAttachmentInput!]
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
    code: String
    description: String
    lead: String
    leadName: String
    leadEmail: String
    leadId: ID
    color: String
    memberIds: [String!]
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

