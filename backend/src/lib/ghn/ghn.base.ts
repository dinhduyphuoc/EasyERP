import { GHNNotImplementedError } from "./ghn.errors";
import type { GHNClientConfig, GHNRequestOptions, GHNTransport } from "./ghn.types";

export abstract class GHNBaseAPI {
  protected readonly baseUrl: string;
  protected readonly token?: string;
  protected readonly shopId?: number | string;
  private readonly transport?: GHNTransport;

  constructor(config: GHNClientConfig) {
    this.baseUrl = config.baseUrl ?? "https://online-gateway.ghn.vn/shiip/public-api/v2/";
    this.token = config.token;
    this.shopId = config.shopId;
    this.transport = config.transport;
  }

  protected request<TResponse = unknown, TInput = unknown>(
    options: GHNRequestOptions<TInput>,
  ): Promise<TResponse> {
    if (!this.transport) {
      throw new GHNNotImplementedError(
        `No GHN transport configured for ${options.method} ${options.path}`,
      );
    }

    return this.transport.request<TResponse, TInput>({
      ...options,
      baseUrl: options.baseUrl ?? this.baseUrl,
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Token: this.token } : {}),
        ...(this.shopId !== undefined && this.shopId !== null
          ? { ShopId: String(this.shopId) }
          : {}),
        ...(options.headers ?? {}),
      },
    });
  }
}
