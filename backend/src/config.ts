const DEFAULT_GHN_GATEWAY_ORIGIN_DEV = "https://dev-online-gateway.ghn.vn";
const DEFAULT_GHN_GATEWAY_ORIGIN_PROD = "https://online-gateway.ghn.vn";
const DEFAULT_GHN_REQUEST_TIMEOUT_MS = 8_000;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const resolveGhnGatewayOrigin = () => {
  const configured = process.env.GHN_GATEWAY_ORIGIN?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  return trimTrailingSlash(
    process.env.NODE_ENV === "production"
      ? DEFAULT_GHN_GATEWAY_ORIGIN_PROD
      : DEFAULT_GHN_GATEWAY_ORIGIN_DEV,
  );
};

export const GHN_GATEWAY_ORIGIN = resolveGhnGatewayOrigin();
export const GHN_PUBLIC_API_BASE_URL = `${GHN_GATEWAY_ORIGIN}/shiip/public-api/`;
export const GHN_V2_API_BASE_URL = `${GHN_GATEWAY_ORIGIN}/shiip/public-api/v2/`;
export const GHN_ORDER_TRACKING_PUBLIC_API_BASE_URL = `${GHN_GATEWAY_ORIGIN}/`;
export const GHN_REQUEST_TIMEOUT_MS = Number(process.env.GHN_REQUEST_TIMEOUT_MS ?? DEFAULT_GHN_REQUEST_TIMEOUT_MS);
