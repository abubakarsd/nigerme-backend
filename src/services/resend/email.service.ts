import { Resend } from "resend";
import { env } from "../../config/env.js";

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
  static async sendOtpEmail(to: string, name: string, otpCode: string, expiresInMinutes = 10): Promise<{ success: boolean; id?: string; error?: string }> {
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
  static async sendWelcomeEmail(to: string, name: string, organizationName: string, domain: string): Promise<{ success: boolean; id?: string }> {
    const subject = `Welcome to Nigerme — Workspace Provisioned for ${organizationName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8faf7; color: #18181b; margin: 0; padding: 24px; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 20px; padding: 36px; }
          .logo { font-size: 22px; font-weight: 800; color: #09090b; margin-bottom: 24px; }
          .logo span { color: #84cc16; }
          .btn { display: inline-block; background-color: #84cc16; color: #09090b; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-size: 14px; margin-top: 16px; }
          .desc { font-size: 14px; color: #52525b; line-height: 1.6; }
          .footer { font-size: 12px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 20px; margin-top: 28px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">niger<span>me</span></div>
          <h2 style="margin: 0 0 16px; font-size: 22px; color: #09090b;">Welcome, ${name}!</h2>
          <p class="desc">Your sovereign company workspace for <strong>${organizationName}</strong> (<code>${domain}</code>) is ready.</p>
          <p class="desc">You can now access your encrypted mailboxes, task boards, organizational calendars, and domain security verification tools.</p>
          <p><a href="https://nigerme.com/admin" class="btn">Open Workspace Admin</a></p>
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
   * Sends an invitation to a new team member
   */
  static async sendMemberInvitationEmail(to: string, name: string, organizationName: string, domain: string, tempPassword?: string): Promise<{ success: boolean; id?: string }> {
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
          ${
            tempPassword
              ? `<div class="cred-box">
                  <div><strong>Email:</strong> ${to}</div>
                  <div style="margin-top: 6px;"><strong>Temporary Password:</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${tempPassword}</code></div>
                </div>
                <p class="desc">Please sign in and set your personal password immediately.</p>`
              : ""
          }
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
