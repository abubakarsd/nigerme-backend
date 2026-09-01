import { Request, Response } from "express";
import { OrganizationModel } from "../../../infrastructure/database/models/organization.model.js";
import { UserModel } from "../../../infrastructure/database/models/user.model.js";
import { EmailModel } from "../../../infrastructure/database/models/email.model.js";
import { ResendEmailService } from "../../../services/resend/email.service.js";
import { AuditLogModel } from "../../../infrastructure/database/models/audit-log.model.js";

export class MailWebhookController {
  /**
   * Handles Resend Inbound Email Webhook (POST /webhooks/resend)
   */
  static async handleResendWebhook(req: Request, res: Response) {
    try {
      const payload = req.body;
      const eventType = payload?.type || payload?.event;

      console.log(`📥 Resend Webhook received: event="${eventType}"`);

      if (eventType === "email.received" || payload?.data?.id || payload?.data?.email_id) {
        const emailData = payload.data || payload;
        const resendEmailId = emailData.id || emailData.email_id;
        const toRecipients: string[] = Array.isArray(emailData.to)
          ? emailData.to
          : emailData.to
          ? [emailData.to]
          : [];
        const fromAddress: string = emailData.from || "unknown@unknown.com";
        const subject: string = emailData.subject || "(No subject)";

        // Fetch complete email details from Resend Receiving API if needed
        let fullEmail = emailData;
        if (resendEmailId && (!emailData.html || !emailData.text)) {
          const detailRes = await ResendEmailService.getReceivedEmail(resendEmailId);
          if (detailRes.data) {
            fullEmail = { ...emailData, ...detailRes.data };
          }
        }

        const bodyHtml = fullEmail.html || `<p>${fullEmail.text || ""}</p>`;
        const bodyText = fullEmail.text || "";
        const preview = (bodyText || bodyHtml.replace(/<[^>]*>?/gm, "")).slice(0, 160).trim();

        // Process for each recipient
        for (const recipient of toRecipients) {
          const cleanRecipient = recipient.toLowerCase().trim();
          const parts = cleanRecipient.split("@");
          if (parts.length !== 2) continue;
          const domain = parts[1];

          // Lookup organization by domain
          const org = await OrganizationModel.findOne({
            $or: [{ domain }, { "dnsVerification.spfStatus": "verified", domain }],
          });

          if (!org) {
            console.warn(`⚠️ Inbound email domain not registered on Nigerme: ${domain}`);
            continue;
          }

          // Strict SaaS Subscription & Package Check
          const now = new Date();
          const isTrialValid =
            org.subscriptionStatus === "TRIAL" &&
            org.trialEndsAt &&
            now <= new Date(org.trialEndsAt);
          const isSubActive =
            org.subscriptionStatus === "ACTIVE" &&
            (!org.subscriptionExpiresAt || now <= new Date(org.subscriptionExpiresAt));
          const isGracePeriod =
            org.subscriptionStatus === "GRACE_PERIOD" &&
            org.gracePeriodEndsAt &&
            now <= new Date(org.gracePeriodEndsAt);

          const hasActiveSubscription =
            !org.isSuspended && (isSubActive || isTrialValid || isGracePeriod);
          const hasEmailPackage = (org.subscribedPackages || []).includes("org-email");

          if (!hasActiveSubscription || !hasEmailPackage) {
            console.warn(
              `🚫 Inbound email quarantined: Org "${org.name}" (${org.domain}) has no active email subscription (status=${org.subscriptionStatus}, isSuspended=${org.isSuspended})`
            );
            await AuditLogModel.create({
              organizationId: org._id,
              actorEmail: fromAddress,
              actorRole: "EXTERNAL_SENDER",
              action: "INBOUND_EMAIL_REJECTED_SUBSCRIPTION_INACTIVE",
              targetResource: `Mailbox: ${cleanRecipient}`,
              details: `Inbound email "${subject}" rejected because organization subscription is ${org.subscriptionStatus}.`,
              ipAddress: req.ip || "resend-inbound",
            }).catch(() => {});
            continue;
          }

          // Lookup user mailbox
          const user = await UserModel.findOne({
            email: cleanRecipient,
            organizationId: org._id,
          });

          if (!user) {
            console.warn(`⚠️ Mailbox not found for recipient: ${cleanRecipient}`);
            continue;
          }

          // Parse attachments
          const rawAttachments = fullEmail.attachments || [];
          const attachments = rawAttachments.map((att: any) => ({
            id: att.id || `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: att.filename || att.name || "attachment",
            sizeBytes: att.size || att.sizeBytes || 0,
            contentType: att.content_type || att.contentType || "application/octet-stream",
            downloadUrl: att.download_url || att.url || null,
            contentId: att.content_id || null,
          }));

          // Create inbox record
          const senderName = fromAddress.includes("<")
            ? fromAddress.split("<")[0].replace(/['"]/g, "").trim()
            : fromAddress.split("@")[0];

          await EmailModel.create({
            organizationId: org._id,
            userId: user._id,
            threadId: `thread-inbound-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            resendId: resendEmailId,
            folder: "inbox",
            category: "primary",
            from: {
              name: senderName || "External Sender",
              email: fromAddress,
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

      return res.status(200).json({ success: true, message: "Webhook acknowledged" });
    } catch (err: any) {
      console.error("❌ Error in Resend Inbound Webhook:", err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || "Internal server error" });
    }
  }
}
