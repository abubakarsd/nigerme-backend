import { OrganizationModel } from "../../infrastructure/database/models/organization.model.js";
import { UserModel } from "../../infrastructure/database/models/user.model.js";
import { ResendEmailService } from "../resend/email.service.js";
import { INITIAL_PACKAGES } from "../../infrastructure/database/seeds/package.seed.js";

export class SubscriptionCronService {
  private static timer: NodeJS.Timeout | null = null;

  /**
   * Starts the recurring subscription audit worker (runs hourly)
   */
  static startScheduler(intervalMs = 60 * 60 * 1000) {
    if (this.timer) clearInterval(this.timer);
    console.log("⏱️ Subscription Lifecycle & Auto-Debit Cron Worker initialized.");
    // Run an initial audit shortly after startup
    setTimeout(() => this.auditSubscriptions(), 5000);
    this.timer = setInterval(() => this.auditSubscriptions(), intervalMs);
  }

  static stopScheduler() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Audits all organizations for 4-day, 1-day reminders, wallet auto-debit renewals, 5-day grace period, and suspensions
   */
  static async auditSubscriptions() {
    try {
      const now = new Date();
      const orgs = await OrganizationModel.find({
        domain: { $exists: true },
      });

      for (const org of orgs) {
        try {
          const owner = await UserModel.findById(org.ownerId);
          if (!owner || !owner.email) continue;

          const cycle = org.billingCycle || "MONTHLY";
          const seats = org.totalSeats || 15;
          const subscribed = org.subscribedPackages || ["org-email"];

          // Calculate required subscription price
          let totalCostInNaira = 0;
          for (const pkgId of subscribed) {
            const pkg = INITIAL_PACKAGES.find((p) => p.packageId === pkgId);
            if (pkg) {
              const basePrice = cycle === "ANNUAL" ? pkg.priceAnnual : pkg.priceMonthly;
              totalCostInNaira += basePrice;
            }
          }
          if (totalCostInNaira === 0) totalCostInNaira = 15000; // Base tier fallback

          const costInKobo = totalCostInNaira * 100;
          const expiresAt = org.subscriptionExpiresAt ? new Date(org.subscriptionExpiresAt) : null;
          const graceEndsAt = org.gracePeriodEndsAt ? new Date(org.gracePeriodEndsAt) : null;

          if (!expiresAt) continue;

          const msRemaining = expiresAt.getTime() - now.getTime();
          const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

          // 1. 4-Day Reminder
          if (daysRemaining <= 4 && daysRemaining > 1 && org.lastBillingReminderType !== "4_DAYS") {
            await ResendEmailService.sendSubscriptionDueReminder(
              owner.email,
              owner.name || "Administrator",
              org.name,
              daysRemaining,
              totalCostInNaira,
              cycle
            );
            org.lastBillingReminderType = "4_DAYS";
            org.lastBillingReminderSentAt = now;
            await org.save();
            continue;
          }

          // 2. 1-Day Urgent Reminder
          if (daysRemaining === 1 && org.lastBillingReminderType !== "1_DAY") {
            await ResendEmailService.sendSubscriptionDueReminder(
              owner.email,
              owner.name || "Administrator",
              org.name,
              1,
              totalCostInNaira,
              cycle
            );
            org.lastBillingReminderType = "1_DAY";
            org.lastBillingReminderSentAt = now;
            await org.save();
            continue;
          }

          // 3. Due Date / Past Due Check
          if (now >= expiresAt) {
            // Attempt wallet auto-debit if balance is sufficient
            if ((org.walletBalance || 0) >= costInKobo) {
              org.walletBalance = (org.walletBalance || 0) - costInKobo;
              const periodDays = cycle === "ANNUAL" ? 365 : 30;
              const nextDue = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

              org.subscriptionExpiresAt = nextDue;
              org.subscriptionStatus = "ACTIVE";
              org.gracePeriodEndsAt = undefined;
              org.isSuspended = false;
              org.lastBillingReminderType = undefined;
              await org.save();

              await ResendEmailService.sendWalletDebitedReceipt(
                owner.email,
                owner.name || "Administrator",
                org.name,
                totalCostInNaira,
                nextDue.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              );
              console.log(`✅ Subscription renewed via wallet auto-debit for ${org.name} (₦${totalCostInNaira})`);
            } else {
              // Insufficient wallet funds -> enter 5-Day Grace Period
              if (org.subscriptionStatus !== "GRACE_PERIOD" && org.subscriptionStatus !== "SUSPENDED") {
                const graceDeadline = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
                org.subscriptionStatus = "GRACE_PERIOD";
                org.gracePeriodEndsAt = graceDeadline;
                org.lastBillingReminderType = "GRACE_STARTED";
                await org.save();

                await ResendEmailService.sendPaymentFailedGracePeriodNotice(
                  owner.email,
                  owner.name || "Administrator",
                  org.name,
                  totalCostInNaira,
                  5
                );
                console.warn(`⚠️ Insufficient wallet balance for ${org.name}. 5-day grace period initiated.`);
              } else if (org.subscriptionStatus === "GRACE_PERIOD" && graceEndsAt && now >= graceEndsAt) {
                // 4. Grace Period Expired -> Suspend service
                org.subscriptionStatus = "SUSPENDED";
                org.isSuspended = true;
                org.lastBillingReminderType = "SUSPENDED";
                await org.save();

                await ResendEmailService.sendServiceSuspendedNotice(
                  owner.email,
                  owner.name || "Administrator",
                  org.name
                );
                console.error(`🚨 5-Day grace period expired for ${org.name}. Service suspended (sending/receiving disabled).`);
              }
            }
          }
        } catch (orgErr) {
          console.error(`❌ Failed to audit subscription for organization ${org.name}:`, orgErr);
        }
      }
    } catch (err) {
      console.error("❌ SubscriptionCronService audit loop failed:", err);
    }
  }
}
