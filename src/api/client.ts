export const API_BASE_URL = ('https://server.onechatting.com').replace(/\/$/, '');
export type ApiSession = { token: string; username: string };

export class ApiError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
  }
}

const isPlainObject = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isApiEnvelope = (body: any) =>
  isPlainObject(body) && typeof body.success === 'boolean' && ('data' in body || 'error' in body);

/** Pagination aliases screens already read. */
function toScreenMeta(meta: Record<string, any>) {
  const screen = { ...meta };
  if (meta.page !== undefined) screen.page_no = meta.page;
  if (meta.total !== undefined) screen.total_records = meta.total;
  if (meta.total_pages !== undefined) screen.total_page = meta.total_pages;
  if (typeof meta.has_more === 'boolean') {
    screen.is_last_page = !meta.has_more;
    screen.has_more_next = meta.has_more;
  }
  if (typeof meta.has_previous === 'boolean') screen.has_more_previous = meta.has_previous;
  return screen;
}

const STANDARD_META_KEYS = ['page', 'limit', 'total', 'total_pages', 'has_more', 'has_previous', 'last_id', 'first_id', 'next_cursor', 'prev_cursor', 'count'];

/** Expand a success envelope into the fields existing screens read. */
export function toScreenBody(envelope: any) {
  const { data, message, meta } = envelope;
  const body: Record<string, any> = {};
  if (isPlainObject(data)) Object.assign(body, data);
  body.error = false;
  body.data = data;
  if (message !== null && message !== undefined) {
    body.msg = message;
    if (body.message === undefined) body.message = message;
  }
  if (isPlainObject(meta)) {
    const screenMeta = toScreenMeta(meta);
    body.meta = screenMeta;
    ['page_no', 'page', 'total_records', 'total_pages', 'has_more', 'last_id', 'first_id', 'count', 'has_more_next', 'has_more_previous'].forEach((key) => {
      if (screenMeta[key] !== undefined && body[key] === undefined) body[key] = screenMeta[key];
    });
    Object.keys(meta).forEach((key) => {
      if (!STANDARD_META_KEYS.includes(key) && body[key] === undefined) body[key] = meta[key];
    });
  }
  return body;
}

function authHeaders(session?: ApiSession) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  return headers;
}

async function request<T>(method: 'GET' | 'POST', path: string, payload: unknown, session?: ApiSession): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const url = `${API_BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: authHeaders(session),
      body: method === 'POST' ? JSON.stringify(payload ?? {}) : undefined,
    });

    const rawText = await response.text();
    let result: any = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch {
      result = {};
    }

    if (isApiEnvelope(result)) {
      if (!response.ok || result.success === false) {
        throw new ApiError(
          result.error?.message || result.message || `Request failed with status ${response.status}`,
          response.status,
          result.error?.code,
        );
      }
      return toScreenBody(result) as T;
    }

    if (!response.ok || result.error === true || typeof result.error === 'string') {
      throw new ApiError(
        result.message ||
          (typeof result.error === 'string' ? result.error : null) ||
          `Request failed with status ${response.status}`,
        response.status,
      );
    }
    return result as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    let loggedError: any = error;
    try {
      if (error && typeof error === 'object' && !(error instanceof Error)) loggedError = JSON.stringify(error);
    } catch (e) {
      loggedError = String(error);
    }
    console.error('API request failed', { path, error: loggedError });
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const generic = isAbort ? 'The request timed out. Please retry.' : 'Unable to reach the server. Check your connection.';
    if (typeof __DEV__ !== 'undefined' && __DEV__ && error instanceof Error && error.message) {
      throw new ApiError(`${generic} (${error.message})`);
    }
    throw new ApiError(generic);
  } finally {
    clearTimeout(timer);
  }
}

export async function post<T>(path: string, payload: unknown, session?: ApiSession): Promise<T> {
  return request<T>('POST', path, payload, session);
}

export async function get<T>(path: string, _?: unknown, session?: ApiSession): Promise<T> {
  return request<T>('GET', path, undefined, session);
}
