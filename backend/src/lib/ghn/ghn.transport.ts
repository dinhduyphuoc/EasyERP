import { GHN_REQUEST_TIMEOUT_MS } from "@/config";
import type { GHNClientConfig, GHNTransport } from "./ghn.types";

const buildUrl = (baseUrl: string, path: string) => {
  return new URL(path, baseUrl).toString();
};

const parseResponseBody = async (response: Response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export const createGHNTransport = (config: Pick<GHNClientConfig, "baseUrl">): GHNTransport => {
  return {
    async request<TResponse, TInput>(
      options: {
        method: "GET" | "POST";
        path: string;
        baseUrl?: string;
        headers?: Record<string, string>;
        data?: TInput;
      },
    ) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GHN_REQUEST_TIMEOUT_MS);
      let response: Response;

      try {
        response = await fetch(buildUrl(options.baseUrl ?? config.baseUrl ?? "", options.path), {
          method: options.method,
          headers: options.headers,
          body: options.data === undefined ? undefined : JSON.stringify(options.data),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`GHN request timed out after ${GHN_REQUEST_TIMEOUT_MS}ms`);
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }

      const body = await parseResponseBody(response);

      if (!response.ok) {
        const message =
          body && typeof body === "object" && "message" in body && typeof body.message === "string"
            ? body.message
            : `GHN request failed with status ${response.status}`;
        throw new Error(message);
      }

      return body as TResponse;
    },
  };
};
