// src/infrastructure/services/sms.service.ts
import dotenv from 'dotenv';
dotenv.config();

export class SMSService {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly senderId: string;

    constructor() {
        this.apiKey = process.env.TERMII_API_LIVE || process.env.TERMII_API_KEY || 'TLNbHuwrgiWHdDfvPFmMdBAOwliaktnGeMeIUPbklyajzPYrUYWSrPSBCRTkXI';
        let base = (process.env.TERMII_BASE_URL || 'https://api.ng.termii.com/api').trim().replace(/\/$/, '');
        if (!base.endsWith('/api')) {
            base = `${base}/api`;
        }
        this.baseUrl = base;
        this.senderId = process.env.TERMII_SENDER_ID || 'buystreem';
    }

    /**
     * Core Termii SMS sender (handles payload, routes, & automatic fallback)
     */
    public async sendSMS(phoneNumber: string, messageText: string, channel: 'dnd' | 'generic' = 'dnd'): Promise<boolean> {
        let cleanPhone = (phoneNumber || '').replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '234' + cleanPhone.slice(1);
        }

        const endpointUrl = `${this.baseUrl}/sms/send`;
        const senderCandidates = Array.from(new Set([this.senderId, 'N-Alert', 'Termii'])).filter(Boolean);

        for (const sender of senderCandidates) {
            for (const ch of [channel, 'generic']) {
                try {
                    const payload = {
                        api_key: this.apiKey,
                        to: cleanPhone,
                        from: sender,
                        sms: messageText,
                        type: 'plain',
                        channel: ch,
                    };

                    console.log(`[SMSService] Sending Termii SMS (${ch} channel via ${sender}) to ${cleanPhone}...`);
                    const res = await fetch(endpointUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });

                    const data: any = await res.json().catch(() => ({}));

                    if (data && (data.message === 'Successfully Sent' || data.code === 'ok' || data.message_id)) {
                        console.log(`[SMSService] Termii SMS sent successfully (${sender}/${ch})`);
                        return true;
                    }
                } catch (error: any) {
                    const errMsg = error.message || '';
                    if (errMsg.includes('SENDER_ID_NOT_APPROVED')) {
                        console.warn(`[SMSService] Sender ID '${sender}' is pending approval on Termii. Falling back to default sender ID...`);
                        break; // Skip inner channel loop to try next sender candidate
                    } else {
                        console.warn(`[SMSService] Termii dispatch attempt (${sender}/${ch}) failed:`, errMsg);
                    }
                }
            }
        }

        console.error(`[SMSService] All Termii SMS dispatch attempts failed for ${cleanPhone}`);
        return false;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FREE AUTH MESSAGES (Sample Messages 1, 2, 3)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Sample Message 1: Registration Verification OTP (FREE)
     * "Your Buytok verification code is: {{code}}. Valid for 10 minutes. Do not share this code with anyone."
     */
    public async sendRegistrationOTP(phoneNumber: string, code: string): Promise<boolean> {
        const msg = `Your Buytok verification code is: ${code}. Valid for 10 minutes. Do not share this code with anyone.`;
        return this.sendSMS(phoneNumber, msg, 'dnd');
    }

    /**
     * Sample Message 2: Login 2FA Verification OTP (FREE)
     * "Your Buytok login verification OTP is: {{code}}. Valid for 5 minutes. If you did not request this, please secure your account immediately."
     */
    public async sendLogin2FAOTP(phoneNumber: string, code: string): Promise<boolean> {
        const msg = `Your Buytok login verification OTP is: ${code}. Valid for 5 minutes. If you did not request this, please secure your account immediately.`;
        return this.sendSMS(phoneNumber, msg, 'dnd');
    }

    /**
     * Sample Message 3: Password Reset OTP (FREE)
     * "Use {{code}} to reset your Buytok account password. Code is valid for 10 minutes."
     */
    public async sendPasswordResetOTP(phoneNumber: string, code: string): Promise<boolean> {
        const msg = `Use ${code} to reset your Buytok account password. Code is valid for 10 minutes.`;
        return this.sendSMS(phoneNumber, msg, 'dnd');
    }

    /**
     * Unified sendOTP method for backwards compatibility with purpose support
     */
    public async sendOTP(phoneNumber: string, otp: string, purpose?: 'registration' | 'forgotPassword' | 'login2FA'): Promise<boolean> {
        if (purpose === 'login2FA') {
            return this.sendLogin2FAOTP(phoneNumber, otp);
        }
        if (purpose === 'forgotPassword') {
            return this.sendPasswordResetOTP(phoneNumber, otp);
        }
        return this.sendRegistrationOTP(phoneNumber, otp);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PAID TRANSACTIONAL MESSAGES (Sample Messages 4, 5, 6)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Sample Message 4: Escrow Payment Secured Notification (PAID)
     * "Hello {{name}}, your escrow payment of {{amount}} for Order #{{order_id}} has been secured on Buytok."
     */
    public async sendEscrowSecuredNotification(
        phoneNumber: string,
        name: string,
        amount: string,
        orderId: string
    ): Promise<boolean> {
        const msg = `Hello ${name}, your escrow payment of ${amount} for Order #${orderId} has been secured on Buytok.`;
        return this.sendSMS(phoneNumber, msg, 'dnd');
    }

    /**
     * Sample Message 5: Escrow Released Notification (PAID)
     * "Escrow Released: {{amount}} for Order #{{order_id}} has been credited to your Buytok wallet."
     */
    public async sendEscrowReleasedNotification(
        phoneNumber: string,
        amount: string,
        orderId: string
    ): Promise<boolean> {
        const msg = `Escrow Released: ${amount} for Order #${orderId} has been credited to your Buytok wallet.`;
        return this.sendSMS(phoneNumber, msg, 'dnd');
    }

    /**
     * Sample Message 6: Wallet Withdrawal Notification (PAID)
     * "Your Buytok wallet withdrawal of {{amount}} to {{bank_name}} ({{account_number}}) has been processed successfully."
     */
    public async sendWithdrawalSuccessNotification(
        phoneNumber: string,
        amount: string,
        bankName: string,
        accountNumber: string
    ): Promise<boolean> {
        const msg = `Your Buytok wallet withdrawal of ${amount} to ${bankName} (${accountNumber}) has been processed successfully.`;
        return this.sendSMS(phoneNumber, msg, 'dnd');
    }
}
