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
}
exports.ResendEmailService = ResendEmailService;
