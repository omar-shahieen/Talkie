import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '../authStorage';

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

type ApiSuccessEnvelope = {
  success?: boolean;
  message?: string;
  results?: unknown;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatApiFailureMessage(
  payload: unknown,
  fallback: string,
): string {
  if (payload && typeof payload === 'object' && 'errors' in payload) {
    const errors = (payload as { errors?: Record<string, string[]> }).errors;
    if (errors && typeof errors === 'object') {
      const parts = Object.entries(errors).flatMap(([key, msgs]) =>
        Array.isArray(msgs)
          ? msgs.map((m) => `${key}: ${m}`)
          : [`${key}: ${String(msgs)}`],
      );
      if (parts.length) {
        return parts.join('; ');
      }
    }
  }

  const msg =
    (payload as { message?: string; error?: string } | null)?.message ||
    (payload as { message?: string; error?: string } | null)?.error;
  return msg || fallback;
}

function isNumericKeyedRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
}

function normalizeNumericRecord(value: Record<string, unknown>) {
  const orderedValues = Object.keys(value)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => value[key]);

  if (
    orderedValues.length > 0 &&
    orderedValues.every((item) => typeof item === 'string' && item.length <= 1)
  ) {
    return orderedValues.join('');
  }

  return orderedValues;
}

export function unwrapApiPayload<T = unknown>(payload: unknown): T {
  if (!isRecord(payload) || !('success' in payload) || !('results' in payload)) {
    return payload as T;
  }

  const envelope = payload as ApiSuccessEnvelope;
  const results = envelope.results;

  if (isNumericKeyedRecord(results)) {
    return normalizeNumericRecord(results) as unknown as T;
  }

  if (
    isRecord(results) &&
    Object.keys(results).length === 0 &&
    envelope.message
  ) {
    return { message: envelope.message } as unknown as T;
  }

  return results as T;
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

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(buildApiUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    });

    const payload = await parseResponse(response);

    if (!response.ok) {
      clearAccessToken();
      return null;
    }

    const data = unwrapApiPayload<{ access_token?: string }>(payload);
    if (data?.access_token) {
      setAccessToken(data.access_token);
      return data.access_token;
    }

    return null;
  } catch {
    return null;
  }
}

export async function requestJson<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return requestJsonInternal<T>(path, options, false);
}

async function requestJsonInternal<T>(
  path: string,
  options: RequestOptions,
  hasRetriedAfterRefresh: boolean,
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
    const canRefresh =
      response.status === 401 &&
      !hasRetriedAfterRefresh &&
      token === undefined &&
      path !== '/auth/login' &&
      path !== '/auth/refresh' &&
      path !== '/auth/tfa/verify';

    if (canRefresh) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        return requestJsonInternal<T>(path, options, true);
      }
    }

    const message = formatApiFailureMessage(
      payload,
      response.statusText || 'Request failed',
    );
    throw new ApiError(message, response.status, payload);
  }

  return unwrapApiPayload<T>(payload);
}
