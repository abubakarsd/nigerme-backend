// /src/infrastructure/services/payment.service.ts
import dotenv from 'dotenv';
import crypto from 'crypto';
import { ENV } from '../../config/env.js';
dotenv.config();

// Native fetch-based HTTP client replacing axios dependency
const httpClient = {
    get: async (url: string, config?: { headers?: any; params?: any }) => {
        let finalUrl = url;
        if (config?.params) {
            const u = new URL(url);
            Object.entries(config.params).forEach(([k, v]) => {
                if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
            });
            finalUrl = u.toString();
        }
        const res = await fetch(finalUrl, {
            method: 'GET',
            headers: config?.headers || {},
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err: any = new Error(data.message || `HTTP ${res.status}`);
            err.response = { status: res.status, data };
            throw err;
        }
        return { data, status: res.status };
    },
    post: async (url: string, body?: any, config?: { headers?: any; params?: any }) => {
        let finalUrl = url;
        if (config?.params) {
            const u = new URL(url);
            Object.entries(config.params).forEach(([k, v]) => {
                if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
            });
            finalUrl = u.toString();
        }
        const res = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config?.headers || {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err: any = new Error(data.message || `HTTP ${res.status}`);
            err.response = { status: res.status, data };
            throw err;
        }
        return { data, status: res.status };
    },
    put: async (url: string, body?: any, config?: { headers?: any }) => {
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(config?.headers || {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err: any = new Error(data.message || `HTTP ${res.status}`);
            err.response = { status: res.status, data };
            throw err;
        }
        return { data, status: res.status };
    },
    delete: async (url: string, config?: { headers?: any; data?: any }) => {
        const res = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(config?.headers || {}),
            },
            body: config?.data !== undefined ? JSON.stringify(config.data) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err: any = new Error(data.message || `HTTP ${res.status}`);
            err.response = { status: res.status, data };
            throw err;
        }
        return { data, status: res.status };
    },
};

export type PaymentGateway = 'paystack' | 'fiatmatch';
export type DirectDebitChannel = 'direct_debit';

export class PaymentService {
    private paystackSecret = ENV.PAYSTACK_SECRET_KEY;
    private flutterwaveSecret = ENV.FLUTTERWAVE_SECRET_KEY;

    // --- Paystack ---
    public async initializePaystackPayment(email: string, amount: number, reference: string) {
        const response = await httpClient.post(
            'https://api.paystack.co/transaction/initialize',
            { email, amount, reference },
            { headers: { Authorization: `Bearer ${this.paystackSecret}` } }
        );
        return response.data;
    }

    public async verifyPaystackPayment(reference: string) {
        const response = await httpClient.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            { headers: { Authorization: `Bearer ${this.paystackSecret}` } }
        );
        return response.data;
    }

    // --- Flutterwave ---
    public async initializeFlutterwavePayment(data: { tx_ref: string; amount: number; currency: string; redirect_url: string; customer: { email: string; name: string } }) {
        const response = await httpClient.post(
            'https://api.flutterwave.com/v3/payments',
            data,
            { headers: { Authorization: `Bearer ${this.flutterwaveSecret}` } }
        );
        return response.data;
    }

    public async verifyFlutterwavePayment(transactionId: string) {
        const response = await httpClient.get(
            `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
            { headers: { Authorization: `Bearer ${this.flutterwaveSecret}` } }
        );
        return response.data;
    }

    // --- Generic wrapper to satisfy use case ---
    public async verifyTransaction(reference: string, gateway: PaymentGateway = 'paystack'): Promise<boolean> {
        if (gateway === 'paystack') {
            const result = await this.verifyPaystackPayment(reference);
            return result?.data?.status === 'success';
        } else if (gateway === 'fiatmatch') {
            const result = await this.verifyFlutterwavePayment(reference);
            return result?.status === 'successful';
        }
        return false;
    }

    /**
     * Verifies a transaction AND returns the gateway-authoritative amount (in the
     * smallest currency unit) and currency. Callers must credit the wallet with
     * THIS amount, never a client-supplied one, to prevent amount-inflation fraud.
     */
    public async verifyTransactionDetails(
        reference: string,
        gateway: PaymentGateway = 'paystack'
    ): Promise<{ success: boolean; amount: number; currency: string }> {
        if (gateway === 'paystack') {
            const result = await this.verifyPaystackPayment(reference);
            const d = result?.data;
            return {
                success: d?.status === 'success',
                amount: Number(d?.amount) || 0, // Paystack returns kobo
                currency: d?.currency || 'NGN',
            };
        } else if (gateway === 'fiatmatch') {
            const result = await this.verifyFlutterwavePayment(reference);
            const d = result?.data ?? result;
            return {
                success: d?.status === 'successful',
                amount: Math.round((Number(d?.amount) || 0) * 100), // Flutterwave returns major unit
                currency: d?.currency || 'NGN',
            };
        }
        return { success: false, amount: 0, currency: 'NGN' };
    }

    // --- Paystack Customer Management ---

    /**
     * Creates a Paystack customer
     * @param email Customer email
     * @param firstName Optional first name
     * @param lastName Optional last name
     * @param phone Optional phone number
     * @returns Paystack customer data including customer_code
     */
    public async createPaystackCustomer(
        email: string,
        firstName?: string,
        lastName?: string,
        phone?: string,
        metadata?: any
    ) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.post(
                'https://api.paystack.co/customer',
                {
                    email,
                    first_name: firstName,
                    last_name: lastName,
                    phone,
                    metadata,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Paystack customer creation response:', {
                status: response.status,
                success: response.data.status,
                hasData: !!response.data.data,
                customerCode: response.data.data?.customer_code,
            });

            return response.data;
        } catch (error: any) {
            console.error('Paystack customer creation error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                email,
            });
            throw error;
        }
    }

    /**
     * Gets an existing customer or creates a new customer on Paystack.
     */
    public async getOrCreatePaystackCustomer(
        email: string,
        firstName?: string,
        lastName?: string,
        phone?: string,
        metadata?: any
    ): Promise<string> {
        // 1. Try fetching existing customer by email
        try {
            const existing = await this.getPaystackCustomer(email);
            if (existing?.data?.customer_code) {
                const code = existing.data.customer_code;
                if (firstName || lastName || phone) {
                    await this.updatePaystackCustomer(code, {
                        first_name: firstName,
                        last_name: lastName,
                        phone: phone,
                        metadata,
                    }).catch((e) => console.log('[PaymentService] Paystack update customer note:', e.message));
                }
                return code;
            }
        } catch (err: any) {
            // Not found (404) or error, continue to creation
        }

        // 2. Create customer if not found
        try {
            const created = await this.createPaystackCustomer(email, firstName, lastName, phone, metadata);
            const customerCode = created.data?.customer_code;
            if (!customerCode) {
                throw new Error('Failed to get customer_code from Paystack creation response');
            }
            return customerCode;
        } catch (err: any) {
            // Handle duplicate customer error gracefully
            const errMsg = err.response?.data?.message?.toLowerCase() || '';
            if (errMsg.includes('already exists') || errMsg.includes('duplicate')) {
                const existing = await this.getPaystackCustomer(email);
                if (existing?.data?.customer_code) {
                    return existing.data.customer_code;
                }
            }
            throw err;
        }
    }

    /**
     * Updates an existing Paystack customer.
     */
    public async updatePaystackCustomer(
        customerCode: string,
        data: {
            first_name?: string;
            last_name?: string;
            phone?: string;
            metadata?: any;
        }
    ) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.put(
                `https://api.paystack.co/customer/${customerCode}`,
                data,
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('Paystack customer update error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                customerCode,
            });
            throw error;
        }
    }

    /**
     * Gets a Paystack customer by email or customer code
     * @param identifier Email or customer code
     * @returns Paystack customer data
     */
    public async getPaystackCustomer(identifier: string) {
        const response = await httpClient.get(
            `https://api.paystack.co/customer/${identifier}`,
            { headers: { Authorization: `Bearer ${this.paystackSecret}` } }
        );
        return response.data;
    }

    /**
     * Submits KYC identification details to validate a Paystack customer
     */
    public async validateCustomerIdentification(
        customerCode: string,
        data: {
            country: string;
            type: 'bvn';
            value: string;
            first_name: string;
            last_name: string;
        }
    ) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.post(
                `https://api.paystack.co/customer/${customerCode}/identification`,
                data,
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('Paystack customer validation error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                customerCode,
            });
            throw error;
        }
    }

    // --- Paystack Dedicated Virtual Account Management ---

    /**
     * Single-step DVA assignment: creates customer, validates (if required), and assigns a
     * dedicated virtual account — all in one request to /dedicated_account/assign.
     *
     * For optional-compliance businesses: pass email, names, phone, preferred_bank, country.
     * For required-compliance (Financial Services/Betting): also pass bvn, account_number, bank_code.
     *
     * The response is async — the actual account number arrives via webhook:
     *   dedicatedaccount.assign.success OR dedicatedaccount.assign.failed
     */
    public async assignDedicatedVirtualAccount(data: {
        email: string;
        first_name: string;
        middle_name?: string;
        last_name: string;
        phone: string;
        preferred_bank: string;
        country: string;
        // Required-compliance fields for Financial Services / Betting categories (Nigeria).
        // All three must be provided together when your business falls under these categories.
        bvn?: string;
        account_number?: string; // Customer's own bank account number for identity validation
        bank_code?: string;      // Paystack bank code for the above account (e.g. '058' for GTB)
    }) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.post(
                'https://api.paystack.co/dedicated_account/assign',
                data,
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            console.log('[Paystack] assignDedicatedVirtualAccount response:', {
                status: response.status,
                success: response.data?.status,
                message: response.data?.message,
            });

            return response.data;
        } catch (error: any) {
            console.error('[Paystack] assignDedicatedVirtualAccount error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                email: data.email,
            });
            throw error;
        }
    }

    /**
     * Fetches available banks/providers for Dedicated Virtual Accounts.
     * Use this to populate the preferred_bank field.
     */
    public async getDVAProviders() {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }
        const response = await httpClient.get(
            'https://api.paystack.co/dedicated_account/available_providers',
            { headers: { Authorization: `Bearer ${this.paystackSecret}` } }
        );
        return response.data;
    }

    /**
     * Creates a dedicated virtual account for a customer
     * @param customerCode Paystack customer code
     * @param preferredBank Optional preferred bank code (e.g., '057' for Zenith)
     * @param subaccount Optional subaccount code for split payments
     * @returns Paystack dedicated account data
     */
    public async createDedicatedAccount(
        customerCode: string,
        preferredBank?: string,
        subaccount?: string
    ) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        const payload: any = {
            customer: customerCode,
        };

        if (preferredBank) {
            payload.preferred_bank = preferredBank;
        }

        if (subaccount) {
            payload.subaccount = subaccount;
        }

        try {
            const response = await httpClient.post(
                'https://api.paystack.co/dedicated_account',
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Log response for debugging
            console.log('Paystack dedicated account creation response:', {
                status: response.status,
                success: response.data.status,
                hasData: !!response.data.data,
            });

            return response.data;
        } catch (error: any) {
            console.error('Paystack API error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                customerCode,
            });
            throw error;
        }
    }

    /**
     * Lists all dedicated accounts for a customer
     * @param customerCode Paystack customer code
     * @returns List of dedicated accounts
     */
    public async listDedicatedAccounts(customerCode: string) {
        const response = await httpClient.get(
            `https://api.paystack.co/dedicated_account?customer=${customerCode}`,
            { headers: { Authorization: `Bearer ${this.paystackSecret}` } }
        );
        return response.data;
    }

    /**
     * Deactivates a dedicated account
     * @param dedicatedAccountId The dedicated account ID
     * @returns Deactivation response
     */
    public async deactivateDedicatedAccount(dedicatedAccountId: string) {
        const response = await httpClient.delete(
            `https://api.paystack.co/dedicated_account/${dedicatedAccountId}`,
            { headers: { Authorization: `Bearer ${this.paystackSecret}` } }
        );
        return response.data;
    }

    // --- Paystack Subaccount Management ---

    /**
     * Creates a Paystack subaccount (for escrow, revenue, etc.)
     * @param businessName Business name for the subaccount
     * @param settlementBank Bank code for settlement
     * @param accountNumber Bank account number
     * @param percentageCharge Percentage charge (e.g., 1.5 for 1.5%)
     * @param description Optional description
     * @returns Paystack subaccount data
     */
    public async createSubaccount(
        businessName: string,
        settlementBank: string,
        accountNumber: string,
        percentageCharge: number,
        description?: string
    ) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.post(
                'https://api.paystack.co/subaccount',
                {
                    business_name: businessName,
                    settlement_bank: settlementBank,
                    account_number: accountNumber,
                    percentage_charge: percentageCharge,
                    description: description || `Subaccount for ${businessName}`,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            console.log('Paystack subaccount creation response:', {
                status: response.status,
                success: response.data.status,
                subaccountCode: response.data.data?.subaccount_code,
            });

            return response.data;
        } catch (error: any) {
            console.error('Paystack subaccount creation error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
            });
            throw error;
        }
    }

    /**
     * Gets a subaccount by code
     * @param subaccountCode The subaccount code
     * @returns Subaccount data
     */
    public async getSubaccount(subaccountCode: string) {
        const response = await httpClient.get(
            `https://api.paystack.co/subaccount/${subaccountCode}`,
            { headers: { Authorization: `Bearer ${this.paystackSecret}` } }
        );
        return response.data;
    }

    // --- Paystack Transfer Management ---

    /**
     * Creates a transfer recipient (bank account or mobile money)
     * @param type 'nuban' for bank account, 'mobile_money' for mobile money
     * @param name Recipient name
     * @param accountNumber Account number
     * @param bankCode Bank code (for nuban)
     * @param currency Currency code (default: NGN)
     * @returns Recipient data including recipient_code
     */
    public async createTransferRecipient(
        type: 'nuban' | 'mobile_money',
        name: string,
        accountNumber: string,
        bankCode: string,
        currency: string = 'NGN'
    ) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const payload: any = {
                type,
                name,
                currency,
            };

            if (type === 'nuban') {
                payload.account_number = accountNumber;
                payload.bank_code = bankCode;
            } else {
                payload.account_number = accountNumber;
            }

            const response = await httpClient.post(
                'https://api.paystack.co/transferrecipient',
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            console.log('Paystack transfer recipient creation response:', {
                status: response.status,
                success: response.data.status,
                recipientCode: response.data.data?.recipient_code,
            });

            return response.data;
        } catch (error: any) {
            const paystackMsg = error.response?.data?.message;
            const errMsg = paystackMsg || error.message || 'Paystack recipient creation failed';
            console.error('Paystack transfer recipient creation error:', {
                message: errMsg,
                response: error.response?.data,
                status: error.response?.status,
            });
            throw new Error(errMsg);
        }
    }

    /**
     * Initiates a transfer to a recipient
     * @param recipientCode The recipient code from createTransferRecipient
     * @param amount Amount in kobo/cents
     * @param reason Reason for transfer
     * @param reference Optional reference
     * @param source Optional source (balance, subaccount code, etc.)
     * @returns Transfer data
     */
    public async initiateTransfer(
        recipientCode: string,
        amount: number,
        reason: string,
        reference?: string,
        source?: string
    ) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const payload: any = {
                source: source || 'balance', // 'balance' or subaccount code
                amount,
                recipient: recipientCode,
                reason,
            };

            if (reference) {
                payload.reference = reference;
            }

            const response = await httpClient.post(
                'https://api.paystack.co/transfer',
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            console.log('Paystack transfer initiation response:', {
                status: response.status,
                success: response.data.status,
                transferCode: response.data.data?.transfer_code,
                reference: response.data.data?.reference,
            });

            return response.data;
        } catch (error: any) {
            const paystackMsg = error.response?.data?.message;
            const errMsg = paystackMsg || error.message || 'Paystack transfer failed';
            console.error('Paystack transfer initiation error:', {
                message: errMsg,
                response: error.response?.data,
                status: error.response?.status,
            });
            throw new Error(errMsg);
        }
    }

    /**
     * Finalizes a transfer using OTP
     * @param transferCode Transfer code returned from initiateTransfer (e.g. TRF_1bg988h00a35607)
     * @param otp 6-digit OTP code sent by Paystack
     */
    public async finalizeTransfer(transferCode: string, otp: string) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.post(
                'https://api.paystack.co/transfer/finalize_transfer',
                {
                    transfer_code: transferCode,
                    otp,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            console.log('Paystack transfer finalization response:', {
                status: response.status,
                success: response.data.status,
                message: response.data.message,
            });

            return response.data;
        } catch (error: any) {
            const paystackMsg = error.response?.data?.message;
            const errMsg = paystackMsg || error.message || 'Paystack transfer finalization failed';
            console.error('Paystack transfer finalization error:', {
                message: errMsg,
                response: error.response?.data,
            });
            throw new Error(errMsg);
        }
    }

    /**
     * Resends OTP for a transfer
     * @param transferCode Transfer code
     * @param reason Reason for resending OTP
     */
    public async resendTransferOTP(transferCode: string, reason: string = 'resend_otp') {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.post(
                'https://api.paystack.co/transfer/resend_otp',
                {
                    transfer_code: transferCode,
                    reason,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data;
        } catch (error: any) {
            const paystackMsg = error.response?.data?.message;
            const errMsg = paystackMsg || error.message || 'Failed to resend transfer OTP';
            console.error('Paystack resend OTP error:', {
                message: errMsg,
                response: error.response?.data,
            });
            throw new Error(errMsg);
        }
    }

    /**
     * Requests to disable OTP requirement for transfers on Paystack account
     */
    public async disableTransferOTP() {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.post(
                'https://api.paystack.co/transfer/disable_otp',
                {},
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data;
        } catch (error: any) {
            const paystackMsg = error.response?.data?.message;
            const errMsg = paystackMsg || error.message || 'Failed to request disable transfer OTP';
            console.error('Paystack disable OTP request error:', {
                message: errMsg,
                response: error.response?.data,
            });
            throw new Error(errMsg);
        }
    }

    /**
     * Finalizes disabling OTP requirement for transfers
     */
    public async finalizeDisableTransferOTP(otp: string) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.post(
                'https://api.paystack.co/transfer/finalize_disable_otp',
                { otp },
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data;
        } catch (error: any) {
            const paystackMsg = error.response?.data?.message;
            const errMsg = paystackMsg || error.message || 'Failed to finalize disable transfer OTP';
            console.error('Paystack finalize disable OTP error:', {
                message: errMsg,
                response: error.response?.data,
            });
            throw new Error(errMsg);
        }
    }

    /**
     * Bulk create transfer recipients
     */
    public async createTransferRecipientBulk(batch: Array<{ type: string; name: string; account_number: string; bank_code: string; currency?: string }>) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.post(
                'https://api.paystack.co/transferrecipient/bulk',
                { batch },
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('[Paystack] createTransferRecipientBulk error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to bulk create transfer recipients');
        }
    }

    /**
     * List transfer recipients
     */
    public async listTransferRecipients(params?: { perPage?: number; page?: number; from?: string; to?: string }) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.get('https://api.paystack.co/transferrecipient', {
                headers: { Authorization: `Bearer ${this.paystackSecret}` },
                params,
            });
            return response.data;
        } catch (error: any) {
            console.error('[Paystack] listTransferRecipients error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to list transfer recipients');
        }
    }

    /**
     * Fetch single transfer recipient
     */
    public async fetchTransferRecipient(idOrCode: string) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.get(`https://api.paystack.co/transferrecipient/${idOrCode}`, {
                headers: { Authorization: `Bearer ${this.paystackSecret}` },
            });
            return response.data;
        } catch (error: any) {
            console.error('[Paystack] fetchTransferRecipient error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to fetch transfer recipient');
        }
    }

    /**
     * Update transfer recipient
     */
    public async updateTransferRecipient(idOrCode: string, name: string, email?: string) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        const payload: any = { name };
        if (email) payload.email = email;

        try {
            const response = await httpClient.put(
                `https://api.paystack.co/transferrecipient/${idOrCode}`,
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('[Paystack] updateTransferRecipient error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to update transfer recipient');
        }
    }

    /**
     * Delete transfer recipient (sets as inactive)
     */
    public async deleteTransferRecipient(idOrCode: string) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.delete(`https://api.paystack.co/transferrecipient/${idOrCode}`, {
                headers: { Authorization: `Bearer ${this.paystackSecret}` },
            });
            return response.data;
        } catch (error: any) {
            console.error('[Paystack] deleteTransferRecipient error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to delete transfer recipient');
        }
    }

    /**
     * Verifies a transfer status by reference
     * @param reference The transfer reference (e.g. WD_...)
     */
    public async verifyTransferByReference(reference: string) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.get(
                `https://api.paystack.co/transfer/verify/${reference}`,
                { headers: { Authorization: `Bearer ${this.paystackSecret}` } }
            );
            return response.data;
        } catch (error: any) {
            console.error('[Paystack] verifyTransferByReference error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to verify transfer by reference');
        }
    }

    /**
     * Gets transfer by reference
     * @param reference The transfer reference
     * @returns Transfer data
     */
    public async getTransferByReference(reference: string) {
        const response = await httpClient.get(
            `https://api.paystack.co/transfer?reference=${reference}`,
            { headers: { Authorization: `Bearer ${this.paystackSecret}` } }
        );
        return response.data;
    }

    // --- Paystack Bank List & Account Resolution ---

    /**
     * Lists banks supported by Paystack for a given currency/country.
     * @param currency Currency code (default NGN)
     * @returns Array of { name, code, ... }
     */
    public async listBanks(currency: string = 'NGN') {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }
        const response = await httpClient.get(
            `https://api.paystack.co/bank?currency=${encodeURIComponent(currency)}`,
            { headers: { Authorization: `Bearer ${this.paystackSecret}` } }
        );
        return response.data;
    }

    /**
     * Resolves a bank account number to the registered account name.
     * @param accountNumber The NUBAN account number
     * @param bankCode The Paystack bank code
     * @returns { account_number, account_name }
     */
    public async resolveAccount(accountNumber: string, bankCode: string) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }
        const response = await httpClient.get(
            `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
            { headers: { Authorization: `Bearer ${this.paystackSecret}` } }
        );
        return response.data;
    }

    // --- Paystack Direct Debit ---

    /**
     * Initializes a direct debit authorization request for a customer.
     * Sends a mandate request — customer must approve via the redirect_url.
     *
     * @param email Customer email (must match Paystack customer)
     * @param callbackUrl URL to redirect customer after consent
     * @param account Optional: pre-fill customer bank account { number, bank_code }
     * @param address Optional: pre-fill customer address { state, city, street }
     * @returns Response with redirect_url for customer consent
     */
    public async initializeDirectDebitAuthorization(
        email: string,
        callbackUrl: string,
        account?: { number: string; bank_code: string },
        address?: { state: string; city: string; street: string }
    ) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        const payload: any = {
            channel: 'direct_debit',
            email,
            callback_url: callbackUrl,
        };

        // Both objects are optional, but if provided, ALL fields in each are compulsory
        if (account && account.number && account.bank_code) {
            payload.account = account;
        }
        if (address && address.state && address.city && address.street) {
            payload.address = address;
        }

        try {
            const response = await httpClient.post(
                'https://api.paystack.co/customer/authorization/initialize',
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            console.log('[Paystack] initializeDirectDebitAuthorization response:', {
                status: response.status,
                email,
                redirectUrl: response.data?.data?.redirect_url,
            });

            return response.data;
        } catch (error: any) {
            console.error('[Paystack] initializeDirectDebitAuthorization error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                email,
            });
            throw error;
        }
    }

    /**
     * Verifies the status of a direct debit authorization.
     * Returns authorization_code and active status when approved.
     *
     * @param reference The reference from the initialization response
     */
    public async verifyDirectDebitAuthorization(reference: string) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.get(
                `https://api.paystack.co/customer/authorization/verify/${reference}`,
                { headers: { Authorization: `Bearer ${this.paystackSecret}` } }
            );
            return response.data;
        } catch (error: any) {
            // 404 means not yet approved or doesn't exist
            if (error.response?.status === 404) {
                return { status: false, message: 'Authorization not yet approved or does not exist' };
            }
            console.error('[Paystack] verifyDirectDebitAuthorization error:', {
                message: error.message,
                response: error.response?.data,
                reference,
            });
            throw error;
        }
    }

    /**
     * Charges a customer's account using an active direct debit authorization_code.
     * Used for recurring payments without customer interaction.
     *
     * @param authorizationCode The authorization_code from the approved mandate
     * @param email Customer email (must match the authorization)
     * @param amount Amount in kobo (smallest currency unit)
     * @param currency Currency code (default: NGN)
     * @param reference Optional idempotency reference
     */
    public async chargeWithAuthorization(
        authorizationCode: string,
        email: string,
        amount: number,
        currency: string = 'NGN',
        reference?: string
    ) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        const payload: any = {
            authorization_code: authorizationCode,
            email,
            amount,
            currency,
        };

        if (reference) {
            payload.reference = reference;
        }

        try {
            const response = await httpClient.post(
                'https://api.paystack.co/transaction/charge_authorization',
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            console.log('[Paystack] chargeWithAuthorization response:', {
                status: response.status,
                reference: response.data?.data?.reference,
                chargeStatus: response.data?.data?.status,
                amount,
                email,
            });

            return response.data;
        } catch (error: any) {
            console.error('[Paystack] chargeWithAuthorization error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                authorizationCode,
                email,
            });
            throw error;
        }
    }

    /**
     * Deactivates a direct debit authorization.
     * Call this when a customer revokes consent or completes a one-time mandate.
     *
     * @param authorizationCode The authorization_code to deactivate
     */
    public async deactivateAuthorization(authorizationCode: string) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.post(
                'https://api.paystack.co/customer/authorization/deactivate',
                { authorization_code: authorizationCode },
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('[Paystack] deactivateAuthorization error:', {
                message: error.message,
                response: error.response?.data,
                authorizationCode,
            });
            throw error;
        }
    }

    /**
     * Retries activation charge for a pending direct debit authorization.
     * Paystack will debit NGN 50 (refunded) to confirm the account is chargeable.
     *
     * @param customerId Paystack customer numeric ID
     * @param authorizationId Paystack authorization numeric ID
     */
    public async retryDirectDebitActivation(customerId: string, authorizationId: number) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.put(
                `https://api.paystack.co/customer/${customerId}/directdebit-activation-charge`,
                { authorization_id: authorizationId },
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('[Paystack] retryDirectDebitActivation error:', {
                message: error.message,
                response: error.response?.data,
                customerId,
                authorizationId,
            });
            throw error;
        }
    }

    // --- Paystack Refunds API ---

    /**
     * Create a refund on Paystack
     * @param transaction Transaction reference or numeric ID
     * @param amount Optional amount in kobo (if omitted, full refund is initiated)
     * @param merchantNote Optional note for merchant internal records
     * @param customerNote Optional note for customer
     */
    public async createPaystackRefund(
        transaction: string,
        amount?: number,
        merchantNote?: string,
        customerNote?: string
    ) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        const payload: any = { transaction };
        if (amount && amount > 0) payload.amount = amount;
        if (merchantNote) payload.merchant_note = merchantNote;
        if (customerNote) payload.customer_note = customerNote;

        try {
            const response = await httpClient.post(
                'https://api.paystack.co/refund',
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('[Paystack] createPaystackRefund error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to create refund on Paystack');
        }
    }

    /**
     * Retry a refund with customer bank account details (when status becomes needs-attention)
     * @param refundId ID or reference of the refund requiring customer details
     * @param accountDetails Customer bank account details
     */
    public async retryPaystackRefund(
        refundId: string,
        accountDetails: {
            currency?: string;
            account_number: string;
            bank_id: string;
        }
    ) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        const payload = {
            refund_account_details: {
                currency: accountDetails.currency || 'NGN',
                account_number: accountDetails.account_number,
                bank_id: accountDetails.bank_id,
            },
        };

        try {
            const response = await httpClient.post(
                `https://api.paystack.co/refund/retry_with_customer_details/${refundId}`,
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('[Paystack] retryPaystackRefund error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to retry refund on Paystack');
        }
    }

    /**
     * Fetch list of refunds from Paystack
     */
    public async listPaystackRefunds(params?: {
        reference?: string;
        currency?: string;
        from?: string;
        to?: string;
        perPage?: number;
        page?: number;
    }) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.get('https://api.paystack.co/refund', {
                headers: { Authorization: `Bearer ${this.paystackSecret}` },
                params,
            });
            return response.data;
        } catch (error: any) {
            console.error('[Paystack] listPaystackRefunds error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to list Paystack refunds');
        }
    }

    /**
     * Fetch single refund details from Paystack
     */
    public async fetchPaystackRefund(identifier: string) {
        if (!this.paystackSecret) {
            throw new Error('Paystack secret key is not configured');
        }

        try {
            const response = await httpClient.get(`https://api.paystack.co/refund/${identifier}`, {
                headers: { Authorization: `Bearer ${this.paystackSecret}` },
            });
            return response.data;
        } catch (error: any) {
            console.error('[Paystack] fetchPaystackRefund error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to fetch Paystack refund');
        }
    }

    // --- Paystack Webhook Verification ---

    /**
     * Verifies Paystack webhook signature
     * @param signature The x-paystack-signature header value
     * @param body The raw request body (should be string)
     * @returns True if signature is valid
     */
    public verifyWebhookSignature(signature: string, body: string): boolean {
        if (!signature) {
            return false;
        }

        const hash = crypto
            .createHmac('sha512', this.paystackSecret)
            .update(body)
            .digest('hex');

        return hash === signature;
    }
}

export const paymentService = new PaymentService();