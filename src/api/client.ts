import { encryptPayload } from '../crypto/encryptPayload';
import Toast from 'react-native-toast-message';
import { REACT_APP_API_BASE_URL } from '@env';

export const API_BASE_URL = (REACT_APP_API_BASE_URL || 'https://server.onechatting.com').replace(/\/$/, '');
export type ApiSession = { token: string; username: string };

export class ApiError extends Error { constructor(message: string, public status?: number) { super(message); } }

export async function post<T>(path: string, payload: unknown, session?: ApiSession): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const url = `${API_BASE_URL}${path}`;
  try {
    // if (typeof __DEV__ !== 'undefined' && __DEV__) {
    //   Toast.show({ type: 'info', text1: 'API request', text2: url, visibilityTime: 4000 });
    // }
    const response = await fetch(url, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(session ? { token: session.token, username: session.username } : {}) },
      body: JSON.stringify(encryptPayload(payload)),
    });

    // --- ADDED: read raw text first so we can see exactly what the server sent ---
    const rawText = await response.text();
    console.log(`[post ${path}] status:`, response.status);
    console.log(`[post ${path}] raw response:`, rawText);

    let result: any = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch {
      console.log(`[post ${path}] response was not valid JSON`);
    }
    // --- END ADDED ---

    if (!response.ok || result.error === true || typeof result.error === 'string') {
      throw new ApiError(
        result.message ||
          (typeof result.error === 'string' ? result.error : null) ||
          `Request failed with status ${response.status}`, // more specific than the old generic fallback
        response.status,
      );
    }
    return result as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Surface more detailed error when debugging locally, but keep a generic message in production.
    // Also log the original error for diagnostics.
    // eslint-disable-next-line no-console
    // Normalize error for logging: if it's an object, stringify it so logs show helpful info.
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
  } finally { clearTimeout(timer); }
}

export async function get<T>(path: string, _?: unknown, session?: ApiSession): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const url = `${API_BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      method: 'GET', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(session ? { token: session.token, username: session.username } : {}) },
    });

    const rawText = await response.text();
    console.log(`[get ${path}] status:`, response.status);
    console.log(`[get ${path}] raw response:`, rawText);

    let result: any = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch {
      console.log(`[get ${path}] response was not valid JSON`);
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
  } finally { clearTimeout(timer); }
}