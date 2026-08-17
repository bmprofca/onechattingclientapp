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

export type ScannedUser = {
  id?: number;
  scan_id: string;
  project_id: string;
  qr_id?: string | null;
  name: string;
  mobile: string;
  email?: string | null;
  dob?: string | null;
  anniversary?: string | null;
  address?: string | null;
  company?: string | null;
  notes?: string | null;
  tags?: string | null;
  added_by?: string;
  status?: string;
  create_date?: string;
  modify_date?: string;
  qr_label?: string | null;
};

export type ScannedUsersListResponse = {
  error?: boolean | string;
  data?: ScannedUser[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
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
 * Fetch scanned users for a project (authenticated project owner).
 */
export async function getScannedUsers(
  session: ApiSession,
  projectId: string,
  search: string = '',
  page: number = 1,
  limit: number = 20,
): Promise<ScannedUsersListResponse> {
  try {
    const response = await post<ScannedUsersListResponse>(
      '/qrcode/scanned-users/list',
      { project_id: projectId, search, page, limit },
      session,
    );
    return response;
  } catch (error) {
    console.error('Failed to get scanned users:', error);
    return { error: 'Failed to fetch scanned users' };
  }
}

/**
 * Manually add a scanned user (authenticated project owner).
 */
export async function addScannedUser(
  session: ApiSession,
  payload: {
    project_id: string;
    qr_id?: string;
    name: string;
    mobile: string;
    email?: string;
    dob?: string;
    anniversary?: string;
    company?: string;
    address?: string;
    notes?: string;
    tags?: string;
  },
): Promise<{ error: boolean | string; msg?: string; scan_id?: string }> {
  return post('/qrcode/scanned-users/add', payload, session);
}

/**
 * Update an existing scanned user record.
 */
export async function updateScannedUser(
  session: ApiSession,
  payload: {
    scan_id: string;
    project_id: string;
    qr_id?: string;
    name: string;
    mobile: string;
    email?: string;
    dob?: string;
    anniversary?: string;
    company?: string;
    address?: string;
    notes?: string;
    tags?: string;
  },
): Promise<{ error: boolean | string; msg?: string }> {
  return post('/qrcode/scanned-users/update', payload, session);
}

/**
 * Soft-delete a scanned user record.
 */
export async function deleteScannedUser(
  session: ApiSession,
  scanId: string,
  projectId: string,
): Promise<{ error: boolean | string; msg?: string }> {
  return post('/qrcode/scanned-users/delete', { scan_id: scanId, project_id: projectId }, session);
}

/**
 * Get total scanned users count for project.
 */
export async function getScannedUsersCount(
  session: ApiSession,
  projectId: string,
): Promise<{ error: boolean | string; total?: number }> {
  return post('/qrcode/scanned-users/count', { project_id: projectId }, session);
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
