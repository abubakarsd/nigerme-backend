"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResendEmailService = void 0;
const resend_1 = require("resend");
const env_js_1 = require("../../config/env.js");
class ResendEmailService {
    static resendClient = null;
    static getClient() {
        if (!this.resendClient) {
            const apiKey = env_js_1.env.RESEND_API || env_js_1.env.RESEND_API_KEY || process.env.RESEND_API || process.env.RESEND_API_KEY;
            if (!apiKey) {
                console.warn("⚠️ RESEND_API key not found in environment variables. Emails will be logged to console in fallback mode.");
            }
            this.resendClient = new resend_1.Resend(apiKey || "re_dummy");
        }
        return this.resendClient;
    }
    static getFromAddress(customFrom) {
        if (customFrom)
            return customFrom;
        const configured = env_js_1.env.EMAIL_SENDER || process.env.EMAIL_SENDER;
        if (configured) {
            // If configured doesn't contain a display name, add Nigerme branding
            return configured.includes("<") ? configured : `Nigerme Workspace <${configured.replace(/['"]/g, "")}>`;
        }
        return "Nigerme Workspace <no-reply@vynxtechnology.com>";
    }
    /**
     * Generic sender using Resend API
     */
    static async sendEmail(options) {
        try {
            const client = this.getClient();
            const from = this.getFromAddress(options.from);
            const apiKey = env_js_1.env.RESEND_API || env_js_1.env.RESEND_API_KEY || process.env.RESEND_API;
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
        }
        catch (error) {
            console.error("❌ Failed to send email via Resend:", error?.message || error);
            return { success: false, error: error?.message || "Unknown email delivery failure" };
        }
    }
    /**
     * Sends a branded Two-Factor / Login OTP email
     */
    static async sendOtpEmail(to, name, otpCode, expiresInMinutes = 10) {
        const subject = `${otpCode} is your Nigerme verification code`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8faf7; color: #18181b; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 20px; padding: 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
          .logo { font-size: 22px; font-weight: 800; color: #09090b; letter-spacing: -0.5px; margin-bottom: 24px; }
          .logo span { color: #84cc16; }
          .title { font-size: 20px; font-weight: 700; color: #09090b; margin-bottom: 12px; }
          .code-box { background: #fafbfa; border: 1.5px solid #84cc16; border-radius: 14px; padding: 18px; text-align: center; margin: 24px 0; }
          .otp { font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #15803d; }
          .desc { font-size: 14px; color: #52525b; line-height: 1.6; margin-bottom: 20px; }
          .footer { font-size: 12px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 20px; margin-top: 24px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">niger<span>me</span></div>
          <div class="title">Verify your identity</div>
          <p class="desc">Hello <strong>${name}</strong>,<br>Use the verification code below to complete your sign in or verification on Nigerme Sovereign Workspace.</p>
          <div class="code-box">
            <div class="otp">${otpCode}</div>
          </div>
          <p class="desc">This code expires in <strong>${expiresInMinutes} minutes</strong>. If you did not initiate this request, please change your password or notify your workspace administrator immediately.</p>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Cloud Infrastructure.
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
     * Sends a Welcome email to newly registered organization owners
     */
    static async sendWelcomeEmail(to, name, organizationName, domain) {
        const subject = `Welcome to Nigerme — Action Required: Verify your domain ${domain}`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 580px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 24px; padding: 36px; color: #f8fafc; }
          .logo { font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 24px; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .badge { display: inline-block; background: rgba(132, 204, 22, 0.15); color: #a3e635; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px; }
          .btn { display: inline-block; background-color: #84cc16; color: #09090b; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 14px; margin: 20px 0; text-align: center; }
          .step-card { background: #0f172a; border: 1px solid #334155; border-radius: 16px; padding: 16px 20px; margin-bottom: 12px; }
          .step-num { font-size: 11px; font-weight: 800; color: #84cc16; text-transform: uppercase; margin-bottom: 4px; }
          .step-title { font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px; }
          .step-desc { font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0; }
          .desc { font-size: 14px; color: #cbd5e1; line-height: 1.6; }
          .footer { font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">niger<span>me</span></div>
          <div class="badge">Sovereign Workspace Ready</div>
          <h2 style="margin: 0 0 12px; font-size: 22px; color: #ffffff;">Welcome to Nigerme, ${name}!</h2>
          <p class="desc">Your enterprise organization <strong>${organizationName}</strong> has been successfully provisioned on the sovereign cloud with domain <code>${domain}</code>.</p>
          
          <div style="margin: 24px 0 16px;">
            <div class="step-card">
              <div class="step-num">Step 1 — Essential</div>
              <div class="step-title">Verify your DNS Records</div>
              <p class="step-desc">Add your SPF (TXT), DKIM (CNAME), DMARC (TXT), and MX records in your domain registrar (Namecheap, GoDaddy, Cloudflare) to activate enterprise inbound and outbound email routing.</p>
            </div>

            <div class="step-card">
              <div class="step-num">Step 2</div>
              <div class="step-title">Provision Team Mailboxes & Roles</div>
              <p class="step-desc">Create custom email accounts (e.g. <code>info@${domain}</code>) for your staff and configure granular department permissions.</p>
            </div>

            <div class="step-card">
              <div class="step-num">Step 3</div>
              <div class="step-title">Access Integrated Apps</div>
              <p class="step-desc">Manage Payroll, POS billing, Sovereign Storage, Calendar, and Logistics directly inside your workspace.</p>
            </div>
          </div>

          <div style="text-align: center;">
            <a href="https://swiftmail-dashboard.vercel.app/admin/domains" class="btn">Configure & Verify DNS Domain &rarr;</a>
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.<br>
            Protected by End-to-End Cryptography & Real-Time Threat Intelligence.
          </div>
        </div>
      </body>
      </html>
    `;
        return this.sendEmail({ to, subject, html });
    }
    /**
     * Sends an invitation to a new team member
     */
    static async sendMemberInvitationEmail(to, name, organizationName, domain, tempPassword) {
        const subject = `You've been invited to join ${organizationName} on Nigerme`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8faf7; color: #18181b; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 20px; padding: 36px; }
          .logo { font-size: 22px; font-weight: 800; color: #09090b; margin-bottom: 24px; }
          .logo span { color: #84cc16; }
          .btn { display: inline-block; background-color: #84cc16; color: #09090b; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-size: 14px; margin-top: 16px; }
          .cred-box { background: #fafbfa; border: 1px solid #e4e4e7; border-radius: 12px; padding: 16px; margin: 16px 0; font-size: 13px; }
          .desc { font-size: 14px; color: #52525b; line-height: 1.6; }
          .footer { font-size: 12px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">niger<span>me</span></div>
          <h2 style="margin: 0 0 16px; font-size: 20px; color: #09090b;">Hello ${name},</h2>
          <p class="desc">You have been provisioned a sovereign business account under <strong>${organizationName}</strong> (<code>${domain}</code>).</p>
          ${tempPassword
            ? `<div class="cred-box">
                  <div><strong>Email:</strong> ${to}</div>
                  <div style="margin-top: 6px;"><strong>Temporary Password:</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${tempPassword}</code></div>
                </div>
                <p class="desc">Please sign in and set your personal password immediately.</p>`
            : ""}
          <p><a href="https://nigerme.com/mail/login" class="btn">Sign in to Mailbox</a></p>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Infrastructure.
          </div>
        </div>
      </body>
      </html>
    `;
        return this.sendEmail({ to, subject, html });
    }
    /**
     * Sends a Plan / Package Cancellation confirmation email to the workspace administrator
     */
    static async sendCancellationEmail(to, name, organizationName, cancelledPackageName) {
        const subject = `Subscription Update: ${cancelledPackageName} cancelled for ${organizationName}`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 580px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 24px; padding: 36px; color: #f8fafc; }
          .logo { font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 24px; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .badge { display: inline-block; background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px; }
          .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .desc { font-size: 14px; color: #cbd5e1; line-height: 1.6; }
          .box { background: #0f172a; border: 1px solid #334155; border-radius: 16px; padding: 18px; margin: 20px 0; }
          .footer { font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">niger<span>me</span></div>
          <div class="badge">Subscription Cancelled</div>
          <h2 class="title">Package Cancellation Notice</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">This is to confirm that the <strong>${cancelledPackageName}</strong> package has been removed and cancelled from your organization <strong>${organizationName}</strong>.</p>
          <div class="box">
            <div style="font-size: 13px; color: #94a3b8;">Cancelled Item: <strong style="color: #ffffff;">${cancelledPackageName}</strong></div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">Status: <strong style="color: #f87171;">Cancelled & Auto-debit removed</strong></div>
          </div>
          <p class="desc">If this cancellation was unintended, you can re-activate the package at any time in your <a href="https://app.nigerme.com/admin/subscription" style="color: #84cc16;">Subscription & Packages console</a>.</p>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Cloud Infrastructure.
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
    static async sendSubscriptionActivatedEmail(to, name, organizationName, packageName) {
        const subject = `Subscription Activated: ${packageName} is now live for ${organizationName}`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 580px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 24px; padding: 36px; color: #f8fafc; }
          .logo { font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 24px; letter-spacing: -0.5px; }
          .logo span { color: #84cc16; }
          .badge { display: inline-block; background: rgba(132, 204, 22, 0.15); color: #a3e635; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px; }
          .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .desc { font-size: 14px; color: #cbd5e1; line-height: 1.6; }
          .box { background: #0f172a; border: 1px solid #334155; border-radius: 16px; padding: 18px; margin: 20px 0; }
          .footer { font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">niger<span>me</span></div>
          <div class="badge">Subscription Activated</div>
          <h2 class="title">Package Activated Successfully</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">Congratulations! The <strong>${packageName}</strong> package has been successfully activated for your organization <strong>${organizationName}</strong>.</p>
          <div class="box">
            <div style="font-size: 13px; color: #94a3b8;">Subscribed Module: <strong style="color: #ffffff;">${packageName}</strong></div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">Status: <strong style="color: #84cc16;">Active & Provisioned</strong></div>
          </div>
          <p class="desc">All members in your workspace now have immediate access to this module.</p>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Cloud Infrastructure.
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
    static async sendSubscriptionDueReminder(to, name, organizationName, daysRemaining, amount, cycle) {
        const urgency = daysRemaining === 1 ? "Urgent: Renewal tomorrow" : `Renewal in ${daysRemaining} days`;
        const subject = `${urgency} — Nigerme subscription for ${organizationName}`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 580px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 24px; padding: 36px; color: #f8fafc; }
          .logo { font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 24px; }
          .logo span { color: #84cc16; }
          .badge { display: inline-block; background: rgba(234, 179, 8, 0.15); color: #facc15; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px; }
          .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .desc { font-size: 14px; color: #cbd5e1; line-height: 1.6; }
          .box { background: #0f172a; border: 1px solid #334155; border-radius: 16px; padding: 18px; margin: 20px 0; }
          .btn { display: inline-block; background-color: #84cc16; color: #09090b; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-size: 14px; margin-top: 14px; }
          .footer { font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">niger<span>me</span></div>
          <div class="badge">Upcoming Renewal</div>
          <h2 class="title">Subscription Renewal Notice</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">Your organization <strong>${organizationName}</strong> subscription will renew in <strong>${daysRemaining} day${daysRemaining === 1 ? "" : "s"}</strong>.</p>
          <div class="box">
            <div style="font-size: 13px; color: #94a3b8;">Renewal Amount: <strong style="color: #ffffff;">₦${amount.toLocaleString()}</strong></div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">Billing Frequency: <strong style="color: #ffffff;">${cycle}</strong></div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">Payment Method: <strong style="color: #84cc16;">Wallet Auto-Debit</strong></div>
          </div>
          <p class="desc">Please ensure your organization dedicated wallet has sufficient balance to prevent any service interruptions.</p>
          <a href="https://app.nigerme.com/admin/billing" class="btn">Check & Fund Wallet</a>
          <div class="footer">&copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Cloud.</div>
        </div>
      </body>
      </html>
    `;
        return this.sendEmail({ to, subject, html });
    }
    /**
     * Sends payment failure & 5-day grace period notice
     */
    static async sendPaymentFailedGracePeriodNotice(to, name, organizationName, amount, graceDaysLeft) {
        const subject = `Action Required: Subscription Payment Failed (5-Day Grace Period Active)`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 580px; margin: 0 auto; background: #1e293b; border: 1px solid #ef4444/40; border-radius: 24px; padding: 36px; color: #f8fafc; }
          .logo { font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 24px; }
          .logo span { color: #84cc16; }
          .badge { display: inline-block; background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px; }
          .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .desc { font-size: 14px; color: #cbd5e1; line-height: 1.6; }
          .box { background: #0f172a; border: 1px solid #334155; border-radius: 16px; padding: 18px; margin: 20px 0; }
          .btn { display: inline-block; background-color: #ef4444; color: #ffffff; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-size: 14px; margin-top: 14px; }
          .footer { font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">niger<span>me</span></div>
          <div class="badge">Payment Overdue • 5-Day Grace Period</div>
          <h2 class="title">Automatic Wallet Debit Failed</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">We were unable to renew the subscription for <strong>${organizationName}</strong> due to insufficient wallet balance (<strong>₦${amount.toLocaleString()}</strong> needed).</p>
          <div class="box">
            <div style="font-size: 13px; color: #f87171;">Grace Period Remaining: <strong>${graceDaysLeft} Days</strong></div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">After the 5-day grace period expires, all outbound and inbound email dispatch and operational service modules will be suspended.</div>
          </div>
          <p class="desc">Please fund your dedicated wallet immediately to restore active subscription status.</p>
          <a href="https://app.nigerme.com/admin/billing" class="btn">Fund Wallet Now</a>
          <div class="footer">&copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Cloud.</div>
        </div>
      </body>
      </html>
    `;
        return this.sendEmail({ to, subject, html });
    }
    /**
     * Sends complete service suspension notice
     */
    static async sendServiceSuspendedNotice(to, name, organizationName) {
        const subject = `Service Suspended: Grace period expired for ${organizationName}`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 580px; margin: 0 auto; background: #1e293b; border: 1.5px solid #ef4444; border-radius: 24px; padding: 36px; color: #f8fafc; }
          .logo { font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 24px; }
          .logo span { color: #84cc16; }
          .badge { display: inline-block; background: #ef4444; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px; }
          .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .desc { font-size: 14px; color: #cbd5e1; line-height: 1.6; }
          .btn { display: inline-block; background-color: #84cc16; color: #09090b; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 14px; margin-top: 16px; }
          .footer { font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">niger<span>me</span></div>
          <div class="badge">Workspace Suspended</div>
          <h2 class="title">Services Temporarily Suspended</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">The 5-day grace period for <strong>${organizationName}</strong> has expired without renewal. In accordance with policy:</p>
          <ul style="color: #cbd5e1; font-size: 13px; line-height: 1.8;">
            <li>All outbound email transmission is disabled</li>
            <li>Inbound email delivery is paused</li>
            <li>Modular service packages (Payroll, POS, Logistics, Hotel) are locked</li>
          </ul>
          <p class="desc">To immediately reactivate your workspace, fund your wallet and click reactivate.</p>
          <a href="https://app.nigerme.com/admin/billing" class="btn">Reactivate Workspace</a>
          <div class="footer">&copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Cloud.</div>
        </div>
      </body>
      </html>
    `;
        return this.sendEmail({ to, subject, html });
    }
    /**
     * Sends renewal wallet debit receipt
     */
    static async sendWalletDebitedReceipt(to, name, organizationName, amount, nextDueDate) {
        const subject = `Receipt: ₦${amount.toLocaleString()} subscription auto-renewed for ${organizationName}`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 580px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 24px; padding: 36px; color: #f8fafc; }
          .logo { font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 24px; }
          .logo span { color: #84cc16; }
          .badge { display: inline-block; background: rgba(132, 204, 22, 0.15); color: #a3e635; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px; }
          .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .desc { font-size: 14px; color: #cbd5e1; line-height: 1.6; }
          .box { background: #0f172a; border: 1px solid #334155; border-radius: 16px; padding: 18px; margin: 20px 0; }
          .footer { font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">niger<span>me</span></div>
          <div class="badge">Payment Successful</div>
          <h2 class="title">Subscription Renewal Receipt</h2>
          <p class="desc">Hello <strong>${name}</strong>,</p>
          <p class="desc">Your subscription for <strong>${organizationName}</strong> has been successfully renewed via wallet auto-debit.</p>
          <div class="box">
            <div style="font-size: 13px; color: #94a3b8;">Amount Paid: <strong style="color: #ffffff;">₦${amount.toLocaleString()}</strong></div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">Next Due Date: <strong style="color: #84cc16;">${nextDueDate}</strong></div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">Status: <strong style="color: #84cc16;">Active &amp; Paid</strong></div>
          </div>
          <div class="footer">&copy; ${new Date().getFullYear()} Nigerme Technologies Ltd. Sovereign Enterprise Cloud.</div>
        </div>
      </body>
      </html>
    `;
        return this.sendEmail({ to, subject, html });
    }
}
exports.ResendEmailService = ResendEmailService;
