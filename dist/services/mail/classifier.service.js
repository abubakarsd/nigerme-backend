"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailClassifierService = void 0;
class EmailClassifierService {
    /**
     * Intelligently categorizes an email into:
     * - "social": Social networks, communities, media notifications
     * - "promotions": Marketing, deals, discounts, newsletters, sales campaigns
     * - "updates": Transactional notices, receipts, statements, system alerts, status updates
     * - "primary": Direct human-to-human correspondence, personal communications, urgent security/2FA codes
     */
    static classify(input) {
        const fromEmail = (input.fromEmail || "").toLowerCase().trim();
        const fromName = (input.fromName || "").toLowerCase().trim();
        const subject = (input.subject || "").toLowerCase().trim();
        const body = ((input.bodyText || "") + " " + (input.bodyHtml || "")).toLowerCase();
        const senderDomain = fromEmail.split("@")[1] || "";
        // ── 0. High-Priority Overrides for PRIMARY: Direct 2FA, OTP, security verification ──
        const isSecurityOrOtp = subject.includes("verification code") ||
            subject.includes("otp") ||
            subject.includes("2fa") ||
            subject.includes("password reset") ||
            subject.includes("security code") ||
            subject.includes("confirm your email") ||
            subject.includes("one-time password");
        if (isSecurityOrOtp) {
            return "primary";
        }
        // ── 1. SOCIAL: Social media platforms, communities, professional networks ──
        const socialDomains = [
            "linkedin.com",
            "twitter.com",
            "x.com",
            "facebookmail.com",
            "facebook.com",
            "instagram.com",
            "youtube.com",
            "tiktok.com",
            "reddit.com",
            "redditmail.com",
            "discord.com",
            "slack.com",
            "pinterest.com",
            "meetup.com",
            "quora.com",
            "medium.com",
            "threads.net",
            "twitch.tv",
        ];
        const isSocialDomain = socialDomains.some((d) => senderDomain.endsWith(d));
        const isSocialKeyword = subject.includes("connected with you") ||
            subject.includes("new follower") ||
            subject.includes("invitation to connect") ||
            subject.includes("tagged you in a") ||
            subject.includes("commented on your post") ||
            subject.includes("friend request") ||
            subject.includes("shared a post") ||
            subject.includes("endorsed you for") ||
            fromName.includes("linkedin") ||
            fromName.includes("twitter") ||
            fromName.includes("facebook") ||
            fromName.includes("instagram");
        if (isSocialDomain || isSocialKeyword) {
            return "social";
        }
        // ── 2. PROMOTIONS: Marketing campaigns, discounts, coupons, newsletters, sales ──
        const promoKeywords = [
            "discount",
            "% off",
            "coupon",
            "promo code",
            "special offer",
            "exclusive offer",
            "limited time deal",
            "flash sale",
            "clearance",
            "black friday",
            "cyber monday",
            "free shipping",
            "buy one get one",
            "bogo",
            "save up to",
            "shop now",
            "dont miss out",
            "huge savings",
            "best price",
            "newsletter",
        ];
        const promoSenders = [
            "promo@",
            "promotions@",
            "marketing@",
            "deals@",
            "offers@",
            "newsletter@",
            "campaign@",
            "sales@",
            "discount@",
        ];
        const hasPromoSender = promoSenders.some((p) => fromEmail.includes(p));
        const hasPromoKeyword = promoKeywords.some((k) => subject.includes(k));
        const hasUnsubscribeHeader = Boolean(input.headers?.["list-unsubscribe"] ||
            input.headers?.["List-Unsubscribe"]);
        const hasMarketingFooter = body.includes("unsubscribe") &&
            (body.includes("manage preferences") ||
                body.includes("opt-out") ||
                body.includes("view in browser") ||
                body.includes("marketing communication"));
        if (hasPromoSender || hasPromoKeyword || (hasUnsubscribeHeader && hasMarketingFooter)) {
            return "promotions";
        }
        // ── 3. UPDATES: Automated notifications, receipts, invoices, statements, system digests ──
        const updateKeywords = [
            "receipt",
            "invoice",
            "statement",
            "order confirmation",
            "payment successful",
            "payment received",
            "tracking number",
            "shipment",
            "package delivered",
            "your delivery",
            "weekly digest",
            "monthly digest",
            "terms of service",
            "privacy policy update",
            "scheduled maintenance",
            "status update",
            "build passed",
            "build failed",
            "pull request",
            "ticket #",
            "support ticket",
            "case #",
        ];
        const updateSenders = [
            "no-reply@",
            "noreply@",
            "notifications@",
            "alerts@",
            "billing@",
            "receipts@",
            "invoices@",
            "system@",
            "support@",
            "mailer-daemon@",
            "service@",
            "updates@",
            "account@",
        ];
        const hasUpdateSender = updateSenders.some((u) => fromEmail.includes(u));
        const hasUpdateKeyword = updateKeywords.some((k) => subject.includes(k));
        if (hasUpdateSender || hasUpdateKeyword) {
            return "updates";
        }
        // ── 4. PRIMARY: Default for personal, direct human correspondence ──
        return "primary";
    }
}
exports.EmailClassifierService = EmailClassifierService;
