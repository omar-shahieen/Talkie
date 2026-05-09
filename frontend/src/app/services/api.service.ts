import { getAccessToken } from '../authStorage';

// Default API URL. In development the backend runs on port 3000.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
  token?: string | null;
  credentials?: RequestCredentials;
};

function appendQuery(url: URL, query?: RequestOptions['query']): URL {
  if (!query) {
    return url;
  }

  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url;
}

export function buildApiUrl(
  path: string,
  query?: RequestOptions['query'],
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${API_URL}${normalizedPath}`);
  return appendQuery(url, query).toString();
}

export function normalizeBlobUrl(url?: string | null): string {
  if (!url) {
    return '';
  }

  return url.replace(/\/image\/blob/gi, '/file/blob');
}

export function getAuthToken() {
  return getAccessToken();
}

export function buildAuthHeaders(extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    ...extraHeaders,
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function requestJson<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = 'GET',
    query,
    headers = {},
    body,
    token,
    credentials = 'include',
  } = options;

  const requestHeaders = { ...headers };
  const authToken = token ?? getAuthToken();
  const hasFormDataBody =
    typeof FormData !== 'undefined' && body instanceof FormData;

  if (authToken) {
    requestHeaders.Authorization = `Bearer ${authToken}`;
  }

  if (body !== undefined && body !== null && !hasFormDataBody) {
    requestHeaders['Content-Type'] =
      requestHeaders['Content-Type'] || 'application/json';
  }

  const response = await fetch(buildApiUrl(path, query), {
    method,
    headers: requestHeaders,
    credentials,
    body:
      body === undefined || body === null
        ? undefined
        : hasFormDataBody
          ? (body as FormData)
          : JSON.stringify(body),
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    const message =
      (payload as { message?: string; error?: string } | null)?.message ||
      (payload as { message?: string; error?: string } | null)?.error ||
      response.statusText ||
      'Request failed';
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}
