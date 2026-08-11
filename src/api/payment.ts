import { ApiSession, post } from './client';

// ─── Response Types ──────────────────────────────────────────────────────────

export interface TopupWalletResponse {
  gateway: 'razorpay' | 'cashfree' | 'zwitch';
  /** For Razorpay: razorpay_order_id. For Cashfree: payment_session_id. For Zwitch: payment_token_id. */
  token_id: string;
  /** Our internal order_id stored in payment_orders table */
  order_id: string;
  /** Razorpay API key to pass to the SDK */
  key_id?: string;
  /** Amount — in PAISE for Razorpay (e.g. ₹2000 = 200000), in INR for Cashfree/Zwitch */
  amount: number;
  currency: string;
  /** Cashfree only */
  payment_session_id?: string;
  cf_order_id?: string;
  environment?: 'production' | 'sandbox';
  msg?: string;
}

export interface PaymentStatusResponse {
  order_id: string;
  /** 'PENDING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN' */
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';
  type?: string;
  payment_id?: string;
  amount: number;
  utr?: string;
  name?: string;
  email?: string;
  mobile?: string;
  create_date?: string;
  create_by?: {
    name?: string;
    mobile?: string;
    email?: string;
    status?: boolean;
  };
}

// ─── API Functions ───────────────────────────────────────────────────────────

/** Step 1: Create a payment order on the server and get gateway credentials. */
export async function topupWallet(
  session: ApiSession,
  amount: string,
): Promise<TopupWalletResponse> {
  return post<TopupWalletResponse>('/payment/wallet-topup', { amount }, session);
}

/**
 * Step 6: Poll this after the payment SDK returns to confirm the wallet was credited.
 * The server webhook updates the DB; this endpoint reads current order status.
 *
 * Status mapping:
 *   DB '0' → 'PENDING'
 *   DB '1' → 'SUCCESS'
 *   DB '2' → 'FAILED'
 */
export async function checkPaymentStatus(
  session: ApiSession,
  order_id: string,
): Promise<PaymentStatusResponse> {
  return post<PaymentStatusResponse>('/payment/payment-status', { order_id }, session);
}

export type TransactionHistoryParams = {
  page_no: number;
  limit: number;
  project_ids?: string[];
  from_date?: string;
  to_date?: string;
  transaction_type?: string;
  type?: '0' | '1';
};

export const getTransactionHistory = (session: ApiSession, params: TransactionHistoryParams) =>
  post<any>('/payment/transaction-history', params, session);
