import { ApiSession, post } from './client';

export async function topupWallet(session: ApiSession, amount: string) {
  return post<any>('/payment/wallet-topup', {
    amount,
  }, session);
}
