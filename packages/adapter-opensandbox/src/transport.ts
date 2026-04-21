export interface OpenSandboxRequest {
  body?: unknown;
  method: "DELETE" | "GET" | "POST" | "PUT";
  path: string;
  query?: Record<string, string>;
  timeoutMs?: number;
}

export interface OpenSandboxResponse {
  body?: unknown;
  headers?: Record<string, string>;
  status: number;
}

export type OpenSandboxTransport = (
  request: OpenSandboxRequest
) => Promise<OpenSandboxResponse>;

export interface OpenSandboxFetchTransportOptions {
  apiBaseUrl: string;
  apiKey?: string;
}

export function createOpenSandboxFetchTransport(
  options: OpenSandboxFetchTransportOptions
): OpenSandboxTransport {
  const baseUrl = options.apiBaseUrl.replace(/\/+$/, "");

  return async (request: OpenSandboxRequest): Promise<OpenSandboxResponse> => {
    const url = new URL(`${baseUrl}${request.path}`);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const hasBody = request.body !== undefined;
    const headers: Record<string, string> = {
      ...(hasBody ? { "Content-Type": "application/json" } : {})
    };
    if (options.apiKey !== undefined && options.apiKey.length > 0) {
      headers.Authorization = `Bearer ${options.apiKey}`;
      headers["x-api-key"] = options.apiKey;
    }

    const controller = new AbortController();
    let timeoutHandle: NodeJS.Timeout | undefined;
    if (request.timeoutMs !== undefined && request.timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        controller.abort();
      }, request.timeoutMs);
    }

    try {
      const response = await fetch(url, {
        body: hasBody ? JSON.stringify(request.body) : undefined,
        headers,
        method: request.method,
        signal: controller.signal
      });

      const contentType = response.headers.get("content-type") ?? "";
      let body: unknown = undefined;
      if (contentType.includes("application/json")) {
        body = await response.json();
      } else {
        const text = await response.text();
        body = text.length > 0 ? text : undefined;
      }

      return {
        body,
        headers: {
          "content-type": contentType
        },
        status: response.status
      };
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }
  };
}
