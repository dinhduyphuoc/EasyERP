const DEFAULT_GHN_GATEWAY_ORIGIN = "https://dev-online-gateway.ghn.vn";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const resolveGhnGatewayOrigin = () => {
  const configured = process.env.GHN_GATEWAY_ORIGIN?.trim();
  return trimTrailingSlash(configured || DEFAULT_GHN_GATEWAY_ORIGIN);
};

export const GHN_GATEWAY_ORIGIN = resolveGhnGatewayOrigin();
export const GHN_PUBLIC_API_BASE_URL = `${GHN_GATEWAY_ORIGIN}/shiip/public-api/`;
export const GHN_V2_API_BASE_URL = `${GHN_GATEWAY_ORIGIN}/shiip/public-api/v2/`;
