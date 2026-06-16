// Copyright 2026 Sutyr Inc. SPDX-License-Identifier: Apache-2.0

const MAX_REQUEST_BODY = 512 * 1024; // 512KB

export interface ParseError {
  code: string;
  message: string;
}

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ParseError; status: number };

export async function parseJsonBody<T>(request: Request): Promise<ParseResult<T>> {
  const contentType = request.headers.get('content-type');
  if (!contentType?.toLowerCase().includes('application/json')) {
    return {
      ok: false,
      error: { code: 'INVALID_CONTENT_TYPE', message: 'Content-Type must be application/json' },
      status: 415,
    };
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_BODY) {
    return {
      ok: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: `Request body exceeds ${MAX_REQUEST_BODY} bytes` },
      status: 413,
    };
  }

  try {
    const text = await request.text();
    if (text.length > MAX_REQUEST_BODY) {
      return {
        ok: false,
        error: { code: 'PAYLOAD_TOO_LARGE', message: `Request body exceeds ${MAX_REQUEST_BODY} bytes` },
        status: 413,
      };
    }
    const data = JSON.parse(text) as T;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
      status: 400,
    };
  }
}
