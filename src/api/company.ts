import { get, ApiSession } from './client';

export type SupportContact = {
  number?: string;
  email?: string;
  type: string;
};

export type SupportData = {
  phone: SupportContact[];
  whatsapp: SupportContact[];
  email: SupportContact[];
};

export async function getSupportInfo(session?: ApiSession) {
  // It's an open endpoint, so session is optional, but passing it if available is fine.
  return get<SupportData>('/company/support', undefined, session);
}
