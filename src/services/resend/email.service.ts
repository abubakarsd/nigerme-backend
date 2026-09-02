import { Resend } from "resend";
import { env } from "../../config/env.js";

export const BRAND_LOGO_URL = "https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/favicon.png";
export const ADVERT_BANNER_URL = "https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/advert-banner.png";
export const FOOTER_BANNER_URL = "https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/ChatGPT+Image+Sep+2%2C+2026%2C+12_13_41+PM.png";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export class ResendEmailService {
  private static resendClient: Resend | null = null;

  private static getClient(): Resend {
    if (!this.resendClient) {
      const apiKey = env.RESEND_API || env.RESEND_API_KEY || process.env.RESEND_API || process.env.RESEND_API_KEY;
      if (!apiKey) {
        console.warn("⚠️ RESEND_API key not found in environment variables. Emails will be logged to console in fallback mode.");
      }
      this.resendClient = new Resend(apiKey || "re_dummy");
    }
    return this.resendClient;
  }

  private static getFromAddress(customFrom?: string): string {
    if (customFrom) return customFrom;
    const configured = env.EMAIL_SENDER || process.env.EMAIL_SENDER;
    if (configured) {
      // If configured doesn't contain a display name, add Nigerme branding
      return configured.includes("<") ? configured : `Nigerme Workspace <${configured.replace(/['"]/g, "")}>`;
    }
    return "Nigerme Workspace <no-reply@vynxtechnology.com>";
  }

  /**
   * Generic sender using Resend API
   */
  static async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const client = this.getClient();
      const from = this.getFromAddress(options.from);

      const apiKey = env.RESEND_API || env.RESEND_API_KEY || process.env.RESEND_API;
      if (!apiKey) {
        console.log(`[Resend Fallback] Email to ${Array.isArray(options.to) ? options.to.join(", ") : options.to} | Subject: "${options.subject}"`);
        return { success: true, id: "simulated-" + Date.now() };
      }

      const response = await client.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      });

      if (response.error) {
        console.error("❌ Resend API Error:", response.error);
        return { success: false, error: response.error.message };
      }

      console.log(`✉️ Email dispatched via Resend: ${response.data?.id} to ${options.to}`);
      return { success: true, id: response.data?.id };
    } catch (error: any) {
      console.error("❌ Failed to send email via Resend:", error?.message || error);
      return { success: false, error: error?.message || "Unknown email delivery failure" };
    }
  }

  /**
   * Sends a branded Two-Factor / Login OTP email
   */
  static async sendOtpEmail(to: string, name: string, otpCode: string, expiresInMinutes = 10, isSignup = false): Promise<{ success: boolean; id?: string; error?: string }> {
    const subject = `${otpCode} is your Nigerme verification code`;
    const bannerUrl = isSignup ? ADVERT_BANNER_URL : FOOTER_BANNER_URL;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 32px 16px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
          .logo-box { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; }
          .logo { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px; }
          .desc { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px; }
          .code-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0; }
          .otp { font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #15803d; }
          .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-box">
            <img src="${BRAND_LOGO_URL}" alt="Nigerme Logo" width="28" height="28" style="display: inline-block; vertical-align: middle; border-radius: 6px;" />
            <span class="logo">niger<span>me</span></span>
          </div>
          <h1 class="title">Verify your identity</h1>
          <p class="desc">Hello <strong>${name}</strong>,<br>Use the verification code below to complete your sign in on Nigerme Sovereign Workspace:</p>
          <div class="code-box">
            <div class="otp">${otpCode}</div>
          </div>
          <p class="desc" style="font-size: 13px; color: #6b7280;">This code is valid for <strong>${expiresInMinutes} minutes</strong>. If you did not make this request, you can safely ignore this email.</p>
          <div style="margin-top: 24px; width: 100%; border-radius: 8px; overflow: hidden;">
            <img src="${bannerUrl}" alt="Nigerme" width="100%" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 8px; border: 0;" />
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      text: `Your Nigerme verification code is ${otpCode}. Valid for ${expiresInMinutes} minutes.`,
    });
  }

  /**
   * Generates the sovereign Welcome & Security Rules email content
   */
  static getWelcomeAndRulesContent(name: string, organizationName: string, orgEmail: string, isOwner = false) {
    const subject = `Welcome to Nigerme Sovereign Mail — Getting Started & Account Guidelines`;
    const preview = `Your sovereign business mailbox is now active for ${organizationName}. Key guidelines and access instructions.`;
    const bannerUrl = isOwner ? ADVERT_BANNER_URL : FOOTER_BANNER_URL;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 32px 16px; }
          .container { max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
          .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; }
          .logo-box { display: flex; align-items: center; gap: 10px; }
          .logo { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .badge { display: inline-block; background: #f0fdf4; color: #166534; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 6px; border: 1px solid #bbf7d0; }
          .title { font-size: 20px; font-weight: 800; color: #111827; margin: 0 0 12px; }
          .lead { font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 24px; }
          .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; margin: 24px 0 12px; }
          .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; }
          .card-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 3px; }
          .card-desc { font-size: 12px; color: #4b5563; line-height: 1.5; margin: 0; }
          .rule-card { background: #fafaf9; border-left: 3px solid #84cc16; padding: 12px 16px; margin-bottom: 8px; }
          .rule-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 2px; }
          .rule-desc { font-size: 12px; color: #4b5563; line-height: 1.5; margin: 0; }
          .btn { display: inline-block; background-color: #84cc16; color: #000000; font-weight: 800; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 13px; margin: 20px 0; text-align: center; }
          .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 28px; text-align: center; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-box">
              <img src="${BRAND_LOGO_URL}" alt="Nigerme Logo" width="28" height="28" style="display: inline-block; vertical-align: middle; border-radius: 6px;" />
              <span class="logo">niger<span>me</span></span>
            </div>
            <div class="badge">Business Mailbox</div>
          </div>

          <h1 class="title">Welcome, ${name}!</h1>
          <p class="lead">
            Your mailbox (<strong>${orgEmail}</strong>) has been activated for <strong>${organizationName}</strong>. 
            Nigerme provides authenticated email deliverability, integrated productivity tools, and sovereign communication infrastructure.
          </p>

          <div class="section-title">Mailbox Navigation &amp; Features</div>
          
          <div class="card">
            <div class="card-title">Categorized Inbox Tabs</div>
            <p class="card-desc">Messages are automatically organized into <strong>Primary</strong> (direct conversations), <strong>Updates</strong> (notifications), <strong>Social</strong>, and <strong>Promotions</strong>.</p>
          </div>

          <div class="card">
            <div class="card-title">AI Assistant &amp; Smart Actions</div>
            <p class="card-desc">Extract action items, summarize long threads, and draft professional replies right from your sidebar.</p>
          </div>

          <div class="card">
            <div class="card-title">Integrated Calendar &amp; Scheduling</div>
            <p class="card-desc">Turn incoming emails directly into calendar appointments and schedule events with team members.</p>
          </div>

          <div class="section-title">Security Guidelines &amp; Policies</div>

          <div class="rule-card">
            <div class="rule-title">1. Account Confidentiality</div>
            <p class="rule-desc">Never share your mailbox credentials, OTP codes, or organization files with unauthorized parties.</p>
          </div>

          <div class="rule-card">
            <div class="rule-title">2. Password Security &amp; 2FA / Passkeys</div>
            <p class="rule-desc">Change temporary passwords on your first sign-in and keep Multi-Factor Authentication (2FA / Passkeys) enabled.</p>
          </div>

          <div class="rule-card">
            <div class="rule-title">3. Outbound Sending Integrity</div>
            <p class="rule-desc">All sent emails carry your organization's verified domain reputation. Strictly adhere to anti-spam policies.</p>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <a href="https://nigerme.com/mail" class="btn">Open Your Mailbox &rarr;</a>
          </div>

          <div style="margin-top: 24px; width: 100%; border-radius: 8px; overflow: hidden;">
            <img src="${bannerUrl}" alt="Welcome to Nigerme" width="100%" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 8px; border: 0;" />
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.
          </div>
        </div>
      </body>
      </html>
    `;

    const bodyText = `Welcome to Nigerme Sovereign Mail, ${name}!\n\nYour mailbox account (${orgEmail}) for ${organizationName} is now active.\n\nKey Guidelines:\n1. Confidentiality: Never disclose organization credentials.\n2. Password & 2FA: Change temporary passwords and keep 2FA active.\n3. Outbound Sending: Maintain professional standards and avoid spam.\n\nOpen your mailbox at: https://nigerme.com/mail`;
    return { subject, preview, html, bodyText };
  }

  /**
   * Automatically provisions the Welcome & Rules email in the user's MongoDB mailbox
   */
  static async provisionWelcomeEmailInMailbox(
    organizationId: any,
    userId: any,
    userName: string,
    userEmail: string,
    organizationName: string,
    isOwner = false
  ) {
    try {
      const { EmailModel } = await import("../../infrastructure/database/models/email.model.js");
      const { subject, preview, html, bodyText } = this.getWelcomeAndRulesContent(
        userName,
        organizationName,
        userEmail,
        isOwner
      );

      // Check if welcome email already exists for this user
      const existing = await EmailModel.findOne({
        organizationId,
        userId,
        subject,
      });

      if (!existing) {
        await EmailModel.create({
          organizationId,
          userId,
          threadId: `thread-welcome-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          folder: "inbox",
          category: "primary",
          from: {
            name: "Nigerme Business Mail",
            email: "welcome@nigerme.com",
            avatar: BRAND_LOGO_URL,
          },
          to: [
            {
              name: userName,
              email: userEmail,
            },
          ],
          cc: [],
          bcc: [],
          subject,
          preview,
          bodyHtml: html,
          bodyText,
          attachments: [],
          isRead: false,
          isStarred: true,
          isImportant: true,
          labels: ["Welcome", "Getting Started", "Security"],
          status: "RECEIVED",
          receivedAt: new Date(),
        });
        console.log(`✅ Provisioned sovereign welcome & rules email in mailbox for ${userEmail}`);
      } else {
        // Update existing welcome email to latest formatted HTML and correct details
        existing.to = [{ name: userName, email: userEmail }];
        existing.preview = preview;
        existing.bodyHtml = html;
        existing.bodyText = bodyText;
        existing.from = {
          name: "Nigerme Business Mail",
          email: "welcome@nigerme.com",
          avatar: BRAND_LOGO_URL,
        };
        await existing.save();
        console.log(`🔄 Refreshed sovereign welcome email in mailbox for ${userEmail}`);
      }
    } catch (err: any) {
      console.warn("⚠️ Could not provision welcome email in database:", err.message);
    }
  }

  /**
   * Sends a Welcome email to newly registered organization owners
   */
  static async sendWelcomeEmail(to: string, name: string, organizationName: string, domain: string): Promise<{ success: boolean; id?: string }> {
    const { subject, html, bodyText } = this.getWelcomeAndRulesContent(name, organizationName, to, true);
    return this.sendEmail({ to, subject, html, text: bodyText });
  }

  /**
   * Sends an invitation to a new team member
   * Dispatches member invitation email to the user's personal email with temporary login credentials.
   */
  static async sendMemberInvitationEmail(
    personalEmail: string,
    name: string,
    organizationName: string,
    assignedOrgEmail: string,
    tempPassword?: string
  ): Promise<{ success: boolean; id?: string }> {
    const subject = `Your Sovereign Business Mailbox for ${organizationName} on Nigerme`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 32px 16px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
          .logo-box { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; }
          .logo { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .btn { display: inline-block; background-color: #84cc16; color: #000000; font-weight: 800; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 13px; margin-top: 16px; }
          .cred-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; line-height: 1.6; }
          .desc { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px; }
          .notice-box { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #92400e; margin-top: 14px; }
          .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-box">
            <img src="${BRAND_LOGO_URL}" alt="Nigerme Logo" width="28" height="28" style="display: inline-block; vertical-align: middle; border-radius: 6px;" />
            <span class="logo">niger<span>me</span></span>
          </div>
          <h2 style="margin: 0 0 12px; font-size: 18px; color: #111827;">Hello ${name},</h2>
          <p class="desc">Your workspace administrator has provisioned your sovereign business mailbox for <strong>${organizationName}</strong>.</p>
          
          <div class="cred-box">
            <div><strong>Assigned Business Email:</strong> <span style="font-family: monospace; font-weight: bold; color: #111827;">${assignedOrgEmail}</span></div>
            ${
              tempPassword
                ? `<div style="margin-top: 8px;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #111827;">${tempPassword}</code></div>`
                : ""
            }
          </div>

          <div class="notice-box">
            <strong>Security Notice:</strong> You will be required to set a permanent password upon your first sign-in.
          </div>

          <p style="text-align: center; margin-top: 24px;">
            <a href="https://nigerme.com/mail/login" class="btn">Sign In to Webmail &rarr;</a>
          </p>

          <div style="margin-top: 24px; width: 100%; border-radius: 8px; overflow: hidden;">
            <img src="${FOOTER_BANNER_URL}" alt="Nigerme" width="100%" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 8px; border: 0;" />
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to: personalEmail, subject, html });
  }

  /**
   * Sends a 2FA OTP code to the user's personal email for Webmail login.
   */
  static async sendWebmailOtpEmail(
    personalEmail: string,
    name: string,
    orgEmail: string,
    otpCode: string,
    expiresInMinutes = 10
  ): Promise<{ success: boolean; id?: string }> {
    const subject = `Your Nigerme Webmail Security Code: ${otpCode}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 32px 16px; }
          .container { max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; text-align: center; }
          .logo-box { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; text-align: left; }
          .logo { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .otp-badge { font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #15803d; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px 24px; border-radius: 8px; display: inline-block; margin: 20px 0; font-family: monospace; }
          .desc { font-size: 14px; color: #4b5563; line-height: 1.6; text-align: left; }
          .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 28px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-box">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/favicon.png" alt="Nigerme Logo" width="28" height="28" style="display: inline-block; vertical-align: middle; border-radius: 6px;" />
            <span class="logo">niger<span>me</span></span>
          </div>
          <h2 style="margin: 0 0 12px; font-size: 18px; color: #111827; text-align: left;">Webmail Verification</h2>
          <p class="desc">A sign-in attempt was initiated for your mailbox <strong>${orgEmail}</strong>. Enter the verification code below to authorize your session:</p>
          
          <div class="otp-badge">${otpCode}</div>
          
          <p class="desc" style="font-size: 13px; color: #6b7280;">Valid for <strong>${expiresInMinutes} minutes</strong>. If you did not initiate this request, notify your administrator immediately.</p>
          
          <div style="margin-top: 24px; width: 100%; border-radius: 0;">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/ChatGPT+Image+Sep+2%2C+2026%2C+12_13_41+PM.png" alt="Nigerme" width="100%" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 0; border: 0;" />
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to: personalEmail, subject, html });
  }

  /**
   * Sends a receipt when a package is added / subscribed
   */
  static async sendPackageSubscribedReceipt(
    to: string,
    name: string,
    organizationName: string,
    packageName: string,
    _billingCycle = "MONTHLY"
  ): Promise<{ success: boolean; id?: string }> {
    return this.sendSubscriptionActivatedEmail(to, name, organizationName, packageName);
  }

  /**
   * Sends a cancellation confirmation when a package or organization subscription is cancelled
   */
  static async sendPackageCancelledConfirmation(
    to: string,
    name: string,
    organizationName: string,
    cancelledPackageName: string
  ): Promise<{ success: boolean; id?: string }> {
    return this.sendCancellationEmail(to, name, organizationName, cancelledPackageName);
  }

  /**
   * Sends a Plan / Package Cancellation confirmation email to the workspace administrator
   */
  static async sendCancellationEmail(
    to: string,
    name: string,
    organizationName: string,
    cancelledPackageName: string
  ): Promise<{ success: boolean; id?: string }> {
    const subject = `Subscription Update: ${cancelledPackageName} cancelled for ${organizationName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 32px 16px; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
          .logo-box { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; }
          .logo { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px; }
          .desc { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px; }
          .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; }
          .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-box">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/favicon.png" alt="Nigerme Logo" width="28" height="28" style="display: inline-block; vertical-align: middle; border-radius: 6px;" />
            <span class="logo">niger<span>me</span></span>
          </div>
          <h2 class="title">Package Cancellation Notice</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">This is to confirm that <strong>${cancelledPackageName}</strong> has been cancelled for <strong>${organizationName}</strong>.</p>
          <div class="box">
            <div style="font-size: 13px; color: #4b5563;">Cancelled Package: <strong style="color: #111827;">${cancelledPackageName}</strong></div>
            <div style="font-size: 13px; color: #4b5563; margin-top: 6px;">Status: <strong style="color: #dc2626;">Cancelled &amp; Auto-debit removed</strong></div>
          </div>
          <p class="desc">You can manage your active packages at any time in your <a href="https://app.nigerme.com/admin/subscription" style="color: #65a30d; font-weight: 600;">Subscription console</a>.</p>
          
          <div style="margin-top: 24px; width: 100%; border-radius: 0;">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/ChatGPT+Image+Sep+2%2C+2026%2C+12_13_41+PM.png" alt="Nigerme" width="100%" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 0; border: 0;" />
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      text: `Subscription Update: ${cancelledPackageName} has been cancelled for ${organizationName}.`,
    });
  }

  /**
   * Sends a Plan / Package Subscription confirmation email to the workspace administrator
   */
  static async sendSubscriptionActivatedEmail(
    to: string,
    name: string,
    organizationName: string,
    packageName: string
  ): Promise<{ success: boolean; id?: string }> {
    const subject = `Subscription Activated: ${packageName} is now live for ${organizationName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 32px 16px; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
          .logo-box { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; }
          .logo { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px; }
          .desc { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px; }
          .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; }
          .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-box">
            <img src="${BRAND_LOGO_URL}" alt="Nigerme Logo" width="28" height="28" style="display: inline-block; vertical-align: middle; border-radius: 6px;" />
            <span class="logo">niger<span>me</span></span>
          </div>
          <h2 class="title">Package Activated</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">The <strong>${packageName}</strong> module has been activated for <strong>${organizationName}</strong>.</p>
          <div class="box">
            <div style="font-size: 13px; color: #4b5563;">Active Module: <strong style="color: #111827;">${packageName}</strong></div>
            <div style="font-size: 13px; color: #4b5563; margin-top: 6px;">Status: <strong style="color: #16a34a;">Active &amp; Provisioned</strong></div>
          </div>
          <p class="desc">All members in your workspace now have access to this module.</p>
          
          <div style="margin-top: 24px; width: 100%; border-radius: 8px; overflow: hidden;">
            <img src="${ADVERT_BANNER_URL}" alt="Nigerme" width="100%" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 8px; border: 0;" />
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      text: `Subscription Activated: ${packageName} is now active for ${organizationName}.`,
    });
  }

  /**
   * Sends subscription due reminder (e.g. 4 days before, 1 day before)
   */
  static async sendSubscriptionDueReminder(
    to: string,
    name: string,
    organizationName: string,
    daysRemaining: number,
    amount: number,
    cycle: string
  ): Promise<{ success: boolean; id?: string }> {
    const urgency = daysRemaining === 1 ? "Urgent: Renewal tomorrow" : `Renewal in ${daysRemaining} days`;
    const subject = `${urgency} — Nigerme subscription for ${organizationName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 32px 16px; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
          .logo-box { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; }
          .logo { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px; }
          .desc { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px; }
          .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; }
          .btn { display: inline-block; background-color: #84cc16; color: #000000; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 13px; margin-top: 14px; }
          .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-box">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/favicon.png" alt="Nigerme Logo" width="28" height="28" style="display: inline-block; vertical-align: middle; border-radius: 6px;" />
            <span class="logo">niger<span>me</span></span>
          </div>
          <h2 class="title">Subscription Renewal Notice</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">Your subscription for <strong>${organizationName}</strong> will renew in <strong>${daysRemaining} day${daysRemaining === 1 ? "" : "s"}</strong>.</p>
          <div class="box">
            <div style="font-size: 13px; color: #4b5563;">Renewal Amount: <strong style="color: #111827;">₦${amount.toLocaleString()}</strong></div>
            <div style="font-size: 13px; color: #4b5563; margin-top: 6px;">Billing Cycle: <strong style="color: #111827;">${cycle}</strong></div>
            <div style="font-size: 13px; color: #4b5563; margin-top: 6px;">Payment Method: <strong style="color: #16a34a;">Wallet Auto-Debit</strong></div>
          </div>
          <p class="desc">Please ensure your organization dedicated wallet has sufficient balance to prevent service disruption.</p>
          <a href="https://app.nigerme.com/admin/billing" class="btn">View Billing &rarr;</a>
          
          <div style="margin-top: 24px; width: 100%; border-radius: 0;">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/ChatGPT+Image+Sep+2%2C+2026%2C+12_13_41+PM.png" alt="Nigerme" width="100%" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 0; border: 0;" />
          </div>

          <div class="footer">&copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.</div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail({ to, subject, html });
  }

  /**
   * Sends payment failure & 5-day grace period notice
   */
  static async sendPaymentFailedGracePeriodNotice(
    to: string,
    name: string,
    organizationName: string,
    amount: number,
    graceDaysLeft: number
  ): Promise<{ success: boolean; id?: string }> {
    const subject = `Action Required: Subscription Payment Failed (${graceDaysLeft}-Day Grace Period Active)`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 32px 16px; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
          .logo-box { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; }
          .logo { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .title { font-size: 18px; font-weight: 700; color: #dc2626; margin: 0 0 12px; }
          .desc { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px; }
          .box { background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 16px; margin: 16px 0; }
          .btn { display: inline-block; background-color: #dc2626; color: #ffffff; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 13px; margin-top: 14px; }
          .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-box">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/favicon.png" alt="Nigerme Logo" width="28" height="28" style="display: inline-block; vertical-align: middle; border-radius: 6px;" />
            <span class="logo">niger<span>me</span></span>
          </div>
          <h2 class="title">Automatic Debit Failed</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">We were unable to renew the subscription for <strong>${organizationName}</strong> due to insufficient wallet balance (<strong>₦${amount.toLocaleString()}</strong> needed).</p>
          <div class="box">
            <div style="font-size: 13px; color: #dc2626;">Grace Period Remaining: <strong>${graceDaysLeft} Days</strong></div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 6px;">After the grace period expires, outbound and inbound email dispatch will be restricted.</div>
          </div>
          <p class="desc">Please fund your dedicated wallet to maintain uninterrupted service.</p>
          <a href="https://app.nigerme.com/admin/billing" class="btn">Fund Wallet Now &rarr;</a>
          
          <div style="margin-top: 24px; width: 100%; border-radius: 0;">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/ChatGPT+Image+Sep+2%2C+2026%2C+12_13_41+PM.png" alt="Nigerme" width="100%" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 0; border: 0;" />
          </div>

          <div class="footer">&copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.</div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail({ to, subject, html });
  }

  /**
   * Sends complete service suspension notice
   */
  static async sendServiceSuspendedNotice(
    to: string,
    name: string,
    organizationName: string
  ): Promise<{ success: boolean; id?: string }> {
    const subject = `Service Suspended: Grace period expired for ${organizationName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 32px 16px; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
          .logo-box { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; }
          .logo { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .title { font-size: 18px; font-weight: 700; color: #dc2626; margin: 0 0 12px; }
          .desc { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px; }
          .btn { display: inline-block; background-color: #84cc16; color: #000000; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 13px; margin-top: 16px; }
          .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-box">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/favicon.png" alt="Nigerme Logo" width="28" height="28" style="display: inline-block; vertical-align: middle; border-radius: 6px;" />
            <span class="logo">niger<span>me</span></span>
          </div>
          <h2 class="title">Services Temporarily Suspended</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">The grace period for <strong>${organizationName}</strong> has expired without renewal. Outbound email transmission and modular services are currently restricted.</p>
          <p class="desc">To reactivate your workspace, fund your wallet and click reactivate in your admin console.</p>
          <a href="https://app.nigerme.com/admin/billing" class="btn">Reactivate Workspace &rarr;</a>
          
          <div style="margin-top: 24px; width: 100%; border-radius: 0;">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/ChatGPT+Image+Sep+2%2C+2026%2C+12_13_41+PM.png" alt="Nigerme" width="100%" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 0; border: 0;" />
          </div>

          <div class="footer">&copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.</div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail({ to, subject, html });
  }

  /**
   * Sends renewal wallet debit receipt
   */
  static async sendWalletDebitedReceipt(
    to: string,
    name: string,
    organizationName: string,
    amount: number,
    nextDueDate: string
  ): Promise<{ success: boolean; id?: string }> {
    const subject = `Receipt: ₦${amount.toLocaleString()} subscription auto-renewed for ${organizationName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 32px 16px; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
          .logo-box { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; }
          .logo { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px; }
          .desc { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px; }
          .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; }
          .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-box">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/favicon.png" alt="Nigerme Logo" width="28" height="28" style="display: inline-block; vertical-align: middle; border-radius: 6px;" />
            <span class="logo">niger<span>me</span></span>
          </div>
          <h2 class="title">Subscription Renewal Receipt</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">Your subscription for <strong>${organizationName}</strong> has renewed successfully.</p>
          <div class="box">
            <div style="font-size: 13px; color: #4b5563;">Amount Paid: <strong style="color: #111827;">₦${amount.toLocaleString()}</strong></div>
            <div style="font-size: 13px; color: #4b5563; margin-top: 6px;">Next Due Date: <strong style="color: #16a34a;">${nextDueDate}</strong></div>
            <div style="font-size: 13px; color: #4b5563; margin-top: 6px;">Status: <strong style="color: #16a34a;">Active &amp; Paid</strong></div>
          </div>
          
          <div style="margin-top: 24px; width: 100%; border-radius: 0;">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/ChatGPT+Image+Sep+2%2C+2026%2C+12_13_41+PM.png" alt="Nigerme" width="100%" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 0; border: 0;" />
          </div>

          <div class="footer">&copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.</div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail({ to, subject, html });
  }

  /**
   * Sends an immediate security alert when domain DNS records disconnect or fail verification
   */
  static async sendDnsDisconnectionAlertEmail(
    to: string,
    name: string,
    organizationName: string,
    domainName: string,
    disconnectedRecords: string[] = ["SPF", "DKIM", "MX"]
  ): Promise<{ success: boolean; id?: string }> {
    const subject = `Action Required: DNS records disconnected for ${domainName}`;
    const recordsHtml = disconnectedRecords
      .map(
        (r) =>
          `<li style="margin-bottom: 6px;"><strong style="color: #dc2626;">${r}</strong> - Disconnected / Unreachable</li>`
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 32px 16px; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
          .logo-box { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; }
          .logo { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .title { font-size: 18px; font-weight: 700; color: #dc2626; margin: 0 0 12px; }
          .desc { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px; }
          .box { background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 16px; margin: 16px 0; }
          .btn { display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 12px 24px; border-radius: 8px; margin-top: 16px; text-align: center; }
          .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-box">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/favicon.png" alt="Nigerme Logo" width="28" height="28" style="display: inline-block; vertical-align: middle; border-radius: 6px;" />
            <span class="logo">niger<span>me</span></span>
          </div>
          <h2 class="title">DNS Disconnection Detected</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">One or more required DNS records for <strong>${domainName}</strong> under <strong>${organizationName}</strong> are currently disconnected:</p>
          
          <div class="box">
            <ul style="color: #4b5563; font-size: 13px; margin: 0; padding-left: 20px;">
              ${recordsHtml}
            </ul>
          </div>

          <p class="desc">Outbound emails from this domain may be delayed or marked as spam until DNS records are restored.</p>

          <a href="https://app.nigerme.com/admin/domains" class="btn">Update DNS in Admin Console &rarr;</a>
          
          <div style="margin-top: 24px; width: 100%; border-radius: 0;">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/ChatGPT+Image+Sep+2%2C+2026%2C+12_13_41+PM.png" alt="Nigerme" width="100%" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 0; border: 0;" />
          </div>

          <div class="footer">&copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.</div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail({ to, subject, html });
  }

  /**
   * Sends confirmation email when domain DNS verification succeeds
   */
  static async sendDnsConnectedConfirmationEmail(
    to: string,
    name: string,
    organizationName: string,
    domainName: string
  ): Promise<{ success: boolean; id?: string }> {
    const subject = `Domain Active: ${domainName} is verified`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 32px 16px; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
          .logo-box { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; }
          .logo { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px; }
          .desc { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px; }
          .box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0; }
          .btn { display: inline-block; background-color: #84cc16; color: #000000; text-decoration: none; font-weight: 700; font-size: 13px; padding: 12px 24px; border-radius: 8px; margin-top: 14px; text-align: center; }
          .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-box">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/favicon.png" alt="Nigerme Logo" width="28" height="28" style="display: inline-block; vertical-align: middle; border-radius: 6px;" />
            <span class="logo">niger<span>me</span></span>
          </div>
          <h2 class="title">Domain ${domainName} is Active</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">All DNS records for <strong>${domainName}</strong> under <strong>${organizationName}</strong> have been verified.</p>
          
          <div class="box">
            <div style="font-size: 13px; color: #166534; font-weight: 600; margin-bottom: 4px;">✓ SPF Outbound Routing: Verified</div>
            <div style="font-size: 13px; color: #166534; font-weight: 600; margin-bottom: 4px;">✓ DKIM 2048-bit Signing: Verified</div>
            <div style="font-size: 13px; color: #166534; font-weight: 600; margin-bottom: 4px;">✓ MX Mail Exchange: Active</div>
            <div style="font-size: 13px; color: #166534; font-weight: 600;">✓ Anti-Spoofing &amp; DMARC: Enforced</div>
          </div>

          <a href="https://app.nigerme.com/admin/domains" class="btn">View Domain Console &rarr;</a>
          
          <div style="margin-top: 24px; width: 100%; border-radius: 0;">
            <img src="https://nigerme-172147427546-us-east-1-an.s3.us-east-1.amazonaws.com/ChatGPT+Image+Sep+2%2C+2026%2C+12_13_41+PM.png" alt="Nigerme" width="100%" style="width: 100%; max-width: 100%; height: auto; display: block; border-radius: 0; border: 0;" />
          </div>

          <div class="footer">&copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.</div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail({ to, subject, html });
  }

  /**
   * Dispatches a user-composed email from the webmail client via Resend
   */
  static async sendUserEmail(options: {
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: Array<{
      filename: string;
      content?: string;
      path?: string;
    }>;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const client = this.getClient();
      const apiKey = env.RESEND_API || env.RESEND_API_KEY || process.env.RESEND_API;

      if (!apiKey) {
        console.log(`[Resend Fallback Mailer] From: ${options.from} -> To: ${options.to.join(", ")} | Subject: "${options.subject}"`);
        return { success: true, id: "simulated-mail-" + Date.now() };
      }

      const payload: any = {
        from: options.from,
        to: options.to,
        subject: options.subject || "(No subject)",
        html: options.html,
      };

      if (options.text) payload.text = options.text;
      if (options.cc && options.cc.length > 0) payload.cc = options.cc;
      if (options.bcc && options.bcc.length > 0) payload.bcc = options.bcc;
      if (options.replyTo) payload.replyTo = options.replyTo;
      if (options.attachments && options.attachments.length > 0) {
        payload.attachments = options.attachments;
      }

      const response = await client.emails.send(payload);

      if (response.error) {
        console.error("❌ Resend sendUserEmail error:", response.error);
        return { success: false, error: response.error.message };
      }

      console.log(`✉️ Webmail dispatched via Resend: ${response.data?.id} from ${options.from}`);
      return { success: true, id: response.data?.id };
    } catch (err: any) {
      console.error("❌ Failed to send user email:", err?.message || err);
      return { success: false, error: err?.message || "Failed to dispatch email via Resend" };
    }
  }

  /**
   * Retrieves a single received email from Resend Inbound Receiving API
   */
  static async getReceivedEmail(id: string): Promise<{ data?: any; error?: any }> {
    try {
      const client = this.getClient();
      const receivingClient = (client as any).emails?.receiving || (client as any).receiving;
      if (!receivingClient || typeof receivingClient.get !== "function") {
        return { data: null, error: { message: "Resend receiving API not supported on this client version." } };
      }
      return await receivingClient.get(id);
    } catch (err: any) {
      return { error: { message: err?.message || "Failed to retrieve received email" } };
    }
  }

  /**
   * Lists received emails from Resend Inbound Receiving API
   */
  static async listReceivedEmails(params?: { limit?: number; after?: string; before?: string }): Promise<{ data?: any; error?: any }> {
    try {
      const client = this.getClient();
      const receivingClient = (client as any).emails?.receiving || (client as any).receiving;
      if (!receivingClient || typeof receivingClient.list !== "function") {
        return { data: [], error: null };
      }
      return await receivingClient.list(params);
    } catch (err: any) {
      return { error: { message: err?.message || "Failed to list received emails" } };
    }
  }

  /**
   * Retrieves an attachment for a received email from Resend
   */
  /**
   * Retrieves an attachment for a received email from Resend
   */
  static async getReceivedAttachment(emailId: string, attachmentId: string): Promise<{ data?: any; error?: any }> {
    try {
      const client = this.getClient();
      const receivingClient = (client as any).emails?.receiving || (client as any).receiving;
      if (!receivingClient?.attachments?.get) {
        return { error: { message: "Resend attachment receiving not supported." } };
      }
      return await receivingClient.attachments.get({ emailId, id: attachmentId });
    } catch (err: any) {
      return { error: { message: err?.message || "Failed to retrieve attachment" } };
    }
  }

  /**
   * Lists all attachments for a received email from Resend
   */
  static async listReceivedAttachments(emailId: string): Promise<{ data?: any; error?: any }> {
    try {
      const client = this.getClient();
      const receivingClient = (client as any).emails?.receiving || (client as any).receiving;
      if (!receivingClient?.attachments?.list) {
        return { data: [], error: null };
      }
      return await receivingClient.attachments.list({ emailId });
    } catch (err: any) {
      return { data: [], error: { message: err?.message || "Failed to list attachments" } };
    }
  }

  /**
   * Automatically configures or updates the Inbound & Delivery Webhook on Resend
   */
  static async setupInboundWebhook(backendBaseUrl: string): Promise<{ data?: any; error?: any }> {
    try {
      if (!backendBaseUrl || !backendBaseUrl.startsWith("http")) {
        return { error: { message: "Invalid backendBaseUrl" } };
      }
      const client = this.getClient();
      const endpoint = `${backendBaseUrl.replace(/\/+$/, "")}/webhooks/resend`;
      const events: any = [
        "email.received",
        "email.sent",
        "email.delivered",
        "email.bounced",
        "email.complained",
      ];

      if (!client.webhooks) {
        return { error: { message: "Webhooks API not available on this client" } };
      }

      const existing: any = await client.webhooks.list().catch(() => ({ data: [] }));
      const webhookList = Array.isArray(existing?.data)
        ? existing.data
        : Array.isArray(existing?.data?.data)
        ? existing.data.data
        : [];
      const found = webhookList.find((w: any) => w.endpoint === endpoint);

      if (found) {
        console.log(`📡 Resend Webhook already active for ${endpoint} (id: ${found.id})`);
        return await (client.webhooks as any).update(found.id, {
          endpoint,
          events,
        });
      }

      console.log(`🚀 Provisioning new Resend Inbound Webhook for ${endpoint}...`);
      return await (client.webhooks as any).create({
        endpoint,
        events,
      });
    } catch (err: any) {
      console.warn("⚠️ Note: Auto-webhook registration skipped:", err?.message || err);
      return { error: { message: err?.message || "Failed to setup webhook" } };
    }
  }
}

