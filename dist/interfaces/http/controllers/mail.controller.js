"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailWebhookController = void 0;
const organization_model_js_1 = require("../../../infrastructure/database/models/organization.model.js");
const user_model_js_1 = require("../../../infrastructure/database/models/user.model.js");
const email_model_js_1 = require("../../../infrastructure/database/models/email.model.js");
const email_service_js_1 = require("../../../services/resend/email.service.js");
const audit_log_model_js_1 = require("../../../infrastructure/database/models/audit-log.model.js");
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
                const toRecipients = Array.isArray(emailData.to)
                    ? emailData.to
                    : emailData.to
                        ? [emailData.to]
                        : [];
                const fromAddress = emailData.from || "unknown@unknown.com";
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
                // Extract sender name and clean email
                let cleanFromEmail = fromAddress;
                let senderName = "External Sender";
                if (fromAddress.includes("<") && fromAddress.includes(">")) {
                    const match = fromAddress.match(/^(.*?)\s*<(.+?)>$/);
                    if (match) {
                        senderName = match[1].replace(/['"]/g, "").trim() || match[2].split("@")[0];
                        cleanFromEmail = match[2].trim();
                    }
                }
                else {
                    senderName = fromAddress.split("@")[0];
                    cleanFromEmail = fromAddress.trim();
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
                const attachments = rawAttachments.map((att) => ({
                    id: att.id || `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    name: att.filename || att.name || "attachment",
                    sizeBytes: att.size || att.sizeBytes || 0,
                    contentType: att.content_type || att.contentType || "application/octet-stream",
                    downloadUrl: att.download_url || att.url || null,
                    contentId: att.content_id || null,
                }));
                // Process for each recipient mailbox
                for (const recipient of toRecipients) {
                    const cleanRecipient = recipient.toLowerCase().trim();
                    const parts = cleanRecipient.split("@");
                    if (parts.length !== 2)
                        continue;
                    const domain = parts[1];
                    // Lookup organization by domain
                    const org = await organization_model_js_1.OrganizationModel.findOne({
                        $or: [{ domain }, { "dnsVerification.spfStatus": "verified", domain }],
                    });
                    if (!org) {
                        console.warn(`⚠️ Inbound email domain not registered on Nigerme: ${domain}`);
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
                    // Lookup user mailbox
                    const user = await user_model_js_1.UserModel.findOne({
                        email: cleanRecipient,
                        organizationId: org._id,
                    });
                    if (!user) {
                        console.warn(`⚠️ Mailbox not found for recipient: ${cleanRecipient}`);
                        continue;
                    }
                    // Create inbox record
                    await email_model_js_1.EmailModel.create({
                        organizationId: org._id,
                        userId: user._id,
                        threadId: `thread-inbound-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        resendId: resendEmailId,
                        folder: "inbox",
                        category: "primary",
                        from: {
                            name: senderName || "External Sender",
                            email: cleanFromEmail,
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
                }
            }
            // ─── 2. OUTBOUND DELIVERY EVENTS: email.sent, email.delivered, email.bounced, email.complained ───
            else if (eventType === "email.sent") {
                const emailData = payload.data || payload;
                const resendEmailId = emailData.email_id || emailData.id;
                if (resendEmailId) {
                    await email_model_js_1.EmailModel.findOneAndUpdate({ resendId: resendEmailId }, { $set: { status: "SENT", sentAt: new Date() } });
                    console.log(`🚀 Email marked SENT: ${resendEmailId}`);
                }
            }
            else if (eventType === "email.delivered") {
                const emailData = payload.data || payload;
                const resendEmailId = emailData.email_id || emailData.id;
                if (resendEmailId) {
                    await email_model_js_1.EmailModel.findOneAndUpdate({ resendId: resendEmailId }, { $set: { status: "DELIVERED", deliveredAt: new Date() } });
                    console.log(`✅ Email marked DELIVERED: ${resendEmailId}`);
                }
            }
            else if (eventType === "email.bounced") {
                const emailData = payload.data || payload;
                const resendEmailId = emailData.email_id || emailData.id;
                if (resendEmailId) {
                    await email_model_js_1.EmailModel.findOneAndUpdate({ resendId: resendEmailId }, { $set: { status: "BOUNCED" } });
                    console.warn(`⚠️ Email marked BOUNCED: ${resendEmailId}`);
                }
            }
            else if (eventType === "email.complained") {
                const emailData = payload.data || payload;
                const resendEmailId = emailData.email_id || emailData.id;
                if (resendEmailId) {
                    await email_model_js_1.EmailModel.findOneAndUpdate({ resendId: resendEmailId }, { $set: { status: "COMPLAINED" } });
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
}
exports.MailWebhookController = MailWebhookController;
