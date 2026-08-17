import { API_BASE_URL } from '../api/client';

/**
 * Normalizes and formats image URLs from the server.
 * Handles full URLs, protocol-relative URLs, and relative paths (e.g. /uploads/... or uploads/...).
 */
export function formatImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Already an absolute URL or local data/file URI
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://')
  ) {
    return trimmed;
  }

  // Base URL without trailing slash
  const base = (API_BASE_URL || 'https://server.onechatting.com').replace(/\/$/, '');

  if (trimmed.startsWith('/')) {
    return `${base}${trimmed}`;
  }

  return `${base}/${trimmed}`;
}
