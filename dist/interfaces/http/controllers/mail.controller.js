"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailWebhookController = void 0;
const organization_model_js_1 = require("../../../infrastructure/database/models/organization.model.js");
const user_model_js_1 = require("../../../infrastructure/database/models/user.model.js");
const email_model_js_1 = require("../../../infrastructure/database/models/email.model.js");
const email_service_js_1 = require("../../../services/resend/email.service.js");
const audit_log_model_js_1 = require("../../../infrastructure/database/models/audit-log.model.js");
const classifier_service_js_1 = require("../../../services/mail/classifier.service.js");
const realtime_service_js_1 = require("../../../services/realtime/realtime.service.js");
const notification_service_js_1 = require("../../../services/notification/notification.service.js");
class MailWebhookController {
    /**
     * Handles Resend Inbound Email Webhook (POST /webhooks/resend)
     */
    static async handleResendWebhook(req, res) {
        try {
            const payload = req.body;
            const eventType = payload?.type || payload?.event;
            console.log(`📥 Resend Webhook received: event="${eventType}"`);
            // ─── 1. INBOUND EMAIL EVENT: email.received ───
            if (eventType === "email.received" ||
                (!eventType && (payload?.data?.id || payload?.data?.email_id || payload?.email_id))) {
                const emailData = payload.data || payload;
                const resendEmailId = emailData.id || emailData.email_id;
                const rawRecipients = Array.isArray(emailData.to)
                    ? emailData.to
                    : emailData.to
                        ? [emailData.to]
                        : [];
                const toRecipients = rawRecipients
                    .map((r) => {
                    if (typeof r === "string") {
                        const match = r.match(/<([^>]+)>/);
                        return (match ? match[1] : r).trim().toLowerCase();
                    }
                    if (r && typeof r === "object" && r.email) {
                        return String(r.email).trim().toLowerCase();
                    }
                    return "";
                })
                    .filter(Boolean);
                const subject = emailData.subject || "(No subject)";
                // Fetch complete email details from Resend Receiving API if needed
                let fullEmail = emailData;
                if (resendEmailId && (!emailData.html || !emailData.text)) {
                    try {
                        const detailRes = await email_service_js_1.ResendEmailService.getReceivedEmail(resendEmailId);
                        if (detailRes.data) {
                            fullEmail = { ...emailData, ...detailRes.data };
                        }
                    }
                    catch (err) {
                        console.warn(`⚠️ Could not fetch full received email from Resend API (${resendEmailId}):`, err.message);
                    }
                }
                const bodyHtml = fullEmail.html || `<p>${fullEmail.text || ""}</p>`;
                const bodyText = fullEmail.text || "";
                const preview = (bodyText || bodyHtml.replace(/<[^>]*>?/gm, "")).slice(0, 160).trim();
                // Robust extraction of sender name and clean email
                let rawFrom = fullEmail.headers?.from ||
                    fullEmail.headers?.From ||
                    fullEmail.from ||
                    emailData.headers?.from ||
                    emailData.headers?.From ||
                    emailData.from ||
                    emailData.sender ||
                    "";
                if (Array.isArray(rawFrom)) {
                    rawFrom = rawFrom[0];
                }
                let parsedSenderName = "";
                let cleanFromEmail = "";
                if (rawFrom && typeof rawFrom === "object") {
                    parsedSenderName = (rawFrom.name || "").replace(/['"]/g, "").trim();
                    cleanFromEmail = String(rawFrom.email || rawFrom.address || "").trim().toLowerCase();
                }
                else if (typeof rawFrom === "string" && rawFrom.trim()) {
                    const str = rawFrom.trim();
                    if (str.includes("<") && str.includes(">")) {
                        const match = str.match(/^(.*?)\s*<([^>]+)>/);
                        if (match) {
                            parsedSenderName = match[1].replace(/['"]/g, "").trim();
                            cleanFromEmail = match[2].trim().toLowerCase();
                        }
                        else {
                            cleanFromEmail = str.replace(/[<>]/g, "").trim().toLowerCase();
                        }
                    }
                    else {
                        cleanFromEmail = str.trim().toLowerCase();
                    }
                }
                if (!cleanFromEmail) {
                    cleanFromEmail = "unknown@unknown.com";
                }
                let senderName = parsedSenderName;
                let matchedUserAvatar = null;
                // If senderName is missing, empty, generic, or equal to the email address:
                const lowerSenderName = (senderName || "").toLowerCase();
                const isGenericName = !senderName ||
                    lowerSenderName === "external sender" ||
                    lowerSenderName === "sovereign workspace" ||
                    lowerSenderName === "unknown" ||
                    senderName === "[object Object]" ||
                    lowerSenderName === cleanFromEmail;
                if (isGenericName && cleanFromEmail && cleanFromEmail.includes("@")) {
                    // 1. Check if sender exists in our database as a registered user (e.g. colleague or customer)
                    try {
                        const matchedUser = await user_model_js_1.UserModel.findOne({ email: cleanFromEmail });
                        if (matchedUser?.name) {
                            senderName = matchedUser.name.trim();
                            matchedUserAvatar = matchedUser.avatarUrl || null;
                        }
                    }
                    catch { }
                    // 2. If still missing, derive a clean human name from the email (e.g. "abubakar.sadiq" -> "Abubakar Sadiq")
                    if (!senderName || senderName.toLowerCase() === "external sender") {
                        const localPart = cleanFromEmail.split("@")[0].replace(/[._-]/g, " ");
                        const formatted = localPart
                            .split(" ")
                            .filter(Boolean)
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                            .join(" ");
                        if (formatted)
                            senderName = formatted;
                    }
                }
                if (!senderName) {
                    senderName = "Sender";
                }
                // Fetch attachments list if not embedded
                let rawAttachments = fullEmail.attachments || [];
                if (rawAttachments.length === 0 && resendEmailId) {
                    try {
                        const attRes = await email_service_js_1.ResendEmailService.listReceivedAttachments(resendEmailId);
                        if (attRes.data && Array.isArray(attRes.data)) {
                            rawAttachments = attRes.data;
                        }
                    }
                    catch { }
                }
                const attachments = await Promise.all(rawAttachments.map(async (att) => {
                    let downloadUrl = att.download_url || att.url || null;
                    if (!downloadUrl && resendEmailId && att.id) {
                        try {
                            const singleAtt = await email_service_js_1.ResendEmailService.getReceivedAttachment(resendEmailId, att.id);
                            if (singleAtt?.data?.download_url) {
                                downloadUrl = singleAtt.data.download_url;
                            }
                        }
                        catch (e) {
                            console.warn(`Could not fetch download_url for attachment ${att.id}:`, e);
                        }
                    }
                    return {
                        id: att.id || `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        name: att.filename || att.name || "attachment",
                        sizeBytes: att.size || att.sizeBytes || 0,
                        contentType: att.content_type || att.contentType || "application/octet-stream",
                        downloadUrl,
                        contentId: att.content_id || null,
                    };
                }));
                // Process for each recipient mailbox
                for (const cleanRecipient of toRecipients) {
                    const parts = cleanRecipient.split("@");
                    if (parts.length !== 2)
                        continue;
                    const domain = parts[1];
                    // Lookup organization by domain (case-insensitive regex)
                    const domainRegex = new RegExp(`^${domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
                    const org = await organization_model_js_1.OrganizationModel.findOne({
                        $or: [{ domain: domainRegex }, { "dnsVerification.spfStatus": "verified", domain: domainRegex }],
                    });
                    if (!org) {
                        console.warn(`⚠️ Inbound email domain not registered on busmailer: ${domain}`);
                        continue;
                    }
                    // Strict SaaS Subscription & Package Check
                    const now = new Date();
                    const isTrialValid = org.subscriptionStatus === "TRIAL" &&
                        org.trialEndsAt &&
                        now <= new Date(org.trialEndsAt);
                    const isSubActive = org.subscriptionStatus === "ACTIVE" &&
                        (!org.subscriptionExpiresAt || now <= new Date(org.subscriptionExpiresAt));
                    const isGracePeriod = org.subscriptionStatus === "GRACE_PERIOD" &&
                        org.gracePeriodEndsAt &&
                        now <= new Date(org.gracePeriodEndsAt);
                    const hasActiveSubscription = !org.isSuspended && (isSubActive || isTrialValid || isGracePeriod);
                    const hasEmailPackage = (org.subscribedPackages || []).includes("org-email");
                    if (!hasActiveSubscription || !hasEmailPackage) {
                        console.warn(`🚫 Inbound email quarantined: Org "${org.name}" (${org.domain}) has no active email subscription (status=${org.subscriptionStatus}, isSuspended=${org.isSuspended})`);
                        await audit_log_model_js_1.AuditLogModel.create({
                            organizationId: org._id,
                            actorEmail: cleanFromEmail,
                            actorRole: "EXTERNAL_SENDER",
                            action: "INBOUND_EMAIL_REJECTED_SUBSCRIPTION_INACTIVE",
                            targetResource: `Mailbox: ${cleanRecipient}`,
                            details: `Inbound email "${subject}" rejected because organization subscription is ${org.subscriptionStatus}.`,
                            ipAddress: req.ip || "resend-inbound",
                        }).catch(() => { });
                        continue;
                    }
                    // Lookup user mailbox (case-insensitive regex)
                    const emailRegex = new RegExp(`^${cleanRecipient.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
                    const user = await user_model_js_1.UserModel.findOne({
                        email: emailRegex,
                        organizationId: org._id,
                    });
                    if (!user) {
                        console.warn(`⚠️ Mailbox not found for recipient: ${cleanRecipient}`);
                        continue;
                    }
                    // Intelligently classify into primary, updates, social, or promotions
                    const category = classifier_service_js_1.EmailClassifierService.classify({
                        fromEmail: cleanFromEmail,
                        fromName: senderName,
                        subject,
                        bodyText,
                        bodyHtml,
                        headers: fullEmail.headers,
                    });
                    // Match existing conversation thread by normalized subject if available
                    const cleanSubject = (subject || "").replace(/^(re:\s*|fwd:\s*)+/i, "").trim();
                    let threadId = "";
                    if (cleanSubject) {
                        const existing = await email_model_js_1.EmailModel.findOne({
                            organizationId: org._id,
                            $or: [
                                { subject: new RegExp(`^${cleanSubject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
                                { subject: new RegExp(`^(re:\\s*|fwd:\\s*)*${cleanSubject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
                            ],
                        }).sort({ createdAt: -1 });
                        if (existing?.threadId) {
                            threadId = existing.threadId;
                        }
                    }
                    if (!threadId) {
                        threadId = `thread-inbound-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                    }
                    const senderDomain = cleanFromEmail.split("@")[1]?.toLowerCase();
                    const freeDomains = new Set([
                        "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.fr",
                        "hotmail.com", "outlook.com", "live.com", "msn.com", "icloud.com",
                        "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
                        "zoho.com", "mail.com", "gmx.com", "yandex.com"
                    ]);
                    const senderAvatar = matchedUserAvatar || (senderDomain
                        ? (!freeDomains.has(senderDomain)
                            ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(senderDomain)}&sz=128`
                            : `https://unavatar.io/${encodeURIComponent(cleanFromEmail)}?fallback=false`)
                        : undefined);
                    // Create inbox record
                    const createdEmail = await email_model_js_1.EmailModel.create({
                        organizationId: org._id,
                        userId: user._id,
                        threadId,
                        resendId: resendEmailId,
                        folder: "inbox",
                        category,
                        from: {
                            name: senderName,
                            email: cleanFromEmail,
                            avatar: senderAvatar,
                        },
                        to: [{ name: user.name, email: user.email }],
                        subject,
                        preview,
                        bodyHtml,
                        bodyText,
                        attachments,
                        isRead: false,
                        isStarred: false,
                        isImportant: false,
                        labels: ["inbox"],
                        status: "RECEIVED",
                        receivedAt: new Date(),
                    });
                    console.log(`📬 Inbound email delivered to ${user.email} (Org: ${org.name})`);
                    // ─── Real-Time Push to Active Frontend Sessions (Zero Page Refresh) ───
                    const realtimeEmailPayload = {
                        id: createdEmail._id.toString(),
                        threadId: createdEmail.threadId,
                        folder: createdEmail.folder,
                        category: createdEmail.category,
                        from: createdEmail.from,
                        to: createdEmail.to,
                        cc: createdEmail.cc || [],
                        bcc: createdEmail.bcc || [],
                        subject: createdEmail.subject,
                        preview: createdEmail.preview,
                        body: createdEmail.bodyHtml || createdEmail.bodyText,
                        bodyHtml: createdEmail.bodyHtml,
                        bodyText: createdEmail.bodyText,
                        date: createdEmail.receivedAt || createdEmail.createdAt,
                        timestamp: createdEmail.createdAt,
                        read: createdEmail.isRead,
                        starred: createdEmail.isStarred,
                        important: createdEmail.isImportant,
                        labels: createdEmail.labels,
                        attachments: (createdEmail.attachments || []).map((a) => {
                            const ext = (a.name || "").split(".").pop()?.toLowerCase() || "";
                            const isImg = a.contentType?.includes("image") || ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext);
                            const isPdf = a.contentType?.includes("pdf") || ext === "pdf";
                            const isDoc = a.contentType?.includes("word") || a.contentType?.includes("document") || ["doc", "docx", "txt", "rtf"].includes(ext);
                            const isSheet = a.contentType?.includes("sheet") || ["xlsx", "xls", "csv"].includes(ext);
                            return {
                                id: a.id,
                                name: a.name,
                                sizeBytes: a.sizeBytes || 0,
                                formattedSize: `${Math.max(1, Math.round((a.sizeBytes || 0) / 1024))} KB`,
                                type: isPdf ? "pdf" : isImg ? "image" : isDoc ? "doc" : isSheet ? "doc" : "other",
                                contentType: a.contentType,
                                contentId: a.contentId,
                                url: a.downloadUrl,
                                downloadUrl: a.downloadUrl,
                            };
                        }),
                        status: createdEmail.status,
                    };
                    realtime_service_js_1.RealtimeService.emitToUser(user._id.toString(), "mail:received", realtimeEmailPayload);
                    realtime_service_js_1.RealtimeService.emitToOrganization(org._id.toString(), "mail:received", realtimeEmailPayload);
                    // Also generate and push an in-app workspace notification
                    await notification_service_js_1.NotificationService.sendNotification({
                        organizationId: org._id,
                        userId: user._id,
                        title: `New Email from ${senderName}`,
                        message: subject,
                        type: "EMAIL",
                        link: "/mail",
                        metadata: { emailId: createdEmail._id.toString() },
                    });
                }
            }
            // ─── 2. OUTBOUND DELIVERY EVENTS: email.sent, email.delivered, email.bounced, email.complained ───
            else if (eventType === "email.sent") {
                const emailData = payload.data || payload;
                const resendEmailId = emailData.email_id || emailData.id;
                if (resendEmailId) {
                    const updated = await email_model_js_1.EmailModel.findOneAndUpdate({ resendId: resendEmailId }, { $set: { status: "SENT", sentAt: new Date() } }, { new: true });
                    if (updated) {
                        realtime_service_js_1.RealtimeService.emitToUser(updated.userId.toString(), "mail:status_updated", {
                            id: updated._id.toString(),
                            resendId: resendEmailId,
                            status: "SENT",
                        });
                        realtime_service_js_1.RealtimeService.emitToOrganization(updated.organizationId.toString(), "mail:status_updated", {
                            id: updated._id.toString(),
                            resendId: resendEmailId,
                            status: "SENT",
                        });
                    }
                    console.log(`🚀 Email marked SENT: ${resendEmailId}`);
                }
            }
            else if (eventType === "email.delivered") {
                const emailData = payload.data || payload;
                const resendEmailId = emailData.email_id || emailData.id;
                if (resendEmailId) {
                    const updated = await email_model_js_1.EmailModel.findOneAndUpdate({ resendId: resendEmailId }, { $set: { status: "DELIVERED", deliveredAt: new Date() } }, { new: true });
                    if (updated) {
                        realtime_service_js_1.RealtimeService.emitToUser(updated.userId.toString(), "mail:status_updated", {
                            id: updated._id.toString(),
                            resendId: resendEmailId,
                            status: "DELIVERED",
                        });
                        realtime_service_js_1.RealtimeService.emitToOrganization(updated.organizationId.toString(), "mail:status_updated", {
                            id: updated._id.toString(),
                            resendId: resendEmailId,
                            status: "DELIVERED",
                        });
                    }
                    console.log(`✅ Email marked DELIVERED: ${resendEmailId}`);
                }
            }
            else if (eventType === "email.bounced") {
                const emailData = payload.data || payload;
                const resendEmailId = emailData.email_id || emailData.id;
                if (resendEmailId) {
                    const updated = await email_model_js_1.EmailModel.findOneAndUpdate({ resendId: resendEmailId }, { $set: { status: "BOUNCED" } }, { new: true });
                    if (updated) {
                        realtime_service_js_1.RealtimeService.emitToUser(updated.userId.toString(), "mail:status_updated", {
                            id: updated._id.toString(),
                            resendId: resendEmailId,
                            status: "BOUNCED",
                        });
                        realtime_service_js_1.RealtimeService.emitToOrganization(updated.organizationId.toString(), "mail:status_updated", {
                            id: updated._id.toString(),
                            resendId: resendEmailId,
                            status: "BOUNCED",
                        });
                    }
                    console.warn(`⚠️ Email marked BOUNCED: ${resendEmailId}`);
                }
            }
            else if (eventType === "email.complained") {
                const emailData = payload.data || payload;
                const resendEmailId = emailData.email_id || emailData.id;
                if (resendEmailId) {
                    const updated = await email_model_js_1.EmailModel.findOneAndUpdate({ resendId: resendEmailId }, { $set: { status: "COMPLAINED" } }, { new: true });
                    if (updated) {
                        realtime_service_js_1.RealtimeService.emitToUser(updated.userId.toString(), "mail:status_updated", {
                            id: updated._id.toString(),
                            resendId: resendEmailId,
                            status: "COMPLAINED",
                        });
                        realtime_service_js_1.RealtimeService.emitToOrganization(updated.organizationId.toString(), "mail:status_updated", {
                            id: updated._id.toString(),
                            resendId: resendEmailId,
                            status: "COMPLAINED",
                        });
                    }
                    console.warn(`🚨 Email marked COMPLAINED: ${resendEmailId}`);
                }
            }
            return res.status(200).json({ success: true, message: "Webhook acknowledged" });
        }
        catch (err) {
            console.error("❌ Error in Resend Webhook:", err?.message || err);
            return res.status(500).json({ success: false, error: err?.message || "Internal server error" });
        }
    }
    /**
     * Helper endpoint to test and verify incoming email delivery & real-time push
     * POST /api/mail/test-inbound
     */
    static async testInboundEmail(req, res) {
        try {
            const { to, from, subject, text, html } = req.body;
            if (!to) {
                return res.status(400).json({ error: "Missing required 'to' email address." });
            }
            // Simulate a standard Resend inbound webhook payload
            const simulatedPayload = {
                type: "email.received",
                data: {
                    id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    email_id: `sim-${Date.now()}`,
                    to: Array.isArray(to) ? to : [to],
                    from: from || "Client Inquiry <client@externalpartner.com>",
                    subject: subject || "Test Inbound Inquiry — Realtime Delivery Check",
                    text: text || "Hello! This is a test incoming email dispatched to verify real-time inbound updates without page refreshing.",
                    html: html || `<p>${text || "Hello! This is a test incoming email dispatched to verify real-time inbound updates without page refreshing."}</p>`,
                    created_at: new Date().toISOString(),
                },
            };
            // Reuse the webhook handler logic
            req.body = simulatedPayload;
            return await MailWebhookController.handleResendWebhook(req, res);
        }
        catch (err) {
            return res.status(500).json({ error: err?.message || "Failed to process test inbound email." });
        }
    }
}
exports.MailWebhookController = MailWebhookController;
