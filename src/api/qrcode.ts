import { ApiSession, get, post } from './client';

export type QRCodeItem = {
  id?: string | number;
  qr_id?: string;
  project_id?: string;
  title?: string;
  label?: string;
  name?: string;
  target_type?: string;
  target_value?: string;
  scan_count?: number;
  is_active?: boolean | number;
  created_at?: string;
  [key: string]: any;
};

export type ProjectQRCodesResponse = {
  error?: boolean | string;
  message?: string;
  qr_codes?: QRCodeItem[];
  list?: QRCodeItem[];
  data?: QRCodeItem[] | { qr_codes?: QRCodeItem[]; list?: QRCodeItem[] };
};

/**
 * Fetch QR codes generated for a specific project.
 */
export async function getProjectQRCodes(
  session: ApiSession,
  projectId: string,
): Promise<{ qr_codes: QRCodeItem[] }> {
  try {
    const response = await post<any>(
      '/qrcode/list',
      { project_id: projectId },
      session,
    );

    const source = response.data || response;
    let list: QRCodeItem[] = [];

    if (Array.isArray(source)) {
      list = source;
    } else if (Array.isArray(source.qr_codes)) {
      list = source.qr_codes;
    } else if (Array.isArray(source.list)) {
      list = source.list;
    } else if (Array.isArray(response.qr_codes)) {
      list = response.qr_codes;
    }

    return { qr_codes: list };
  } catch (error) {
    console.error('Failed to get project QR codes:', error);
    return { qr_codes: [] };
  }
}

/**
 * Public: Validate QR Code when scanned.
 */
export async function validateQRCode(qrId: string): Promise<any> {
  return get<any>(`/qrcode/validate/${qrId}`);
}

/**
 * Public: Process Scan Action (register / login / auto-assign / open chat).
 */
export async function processScanAction(payload: Record<string, unknown>): Promise<any> {
  return post<any>('/qrcode/scan-action', payload);
}
