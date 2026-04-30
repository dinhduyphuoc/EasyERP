import { GHN_GATEWAY_ORIGIN } from "@/config";

export type GHNPrintFormat = "a5" | "80x80" | "52x70";

export type GHNPrintUrls = Record<GHNPrintFormat, string>;

const PRINT_PATHS: Record<GHNPrintFormat, string> = {
  a5: "/a5/public-api/printA5",
  "80x80": "/a5/public-api/print80x80",
  "52x70": "/a5/public-api/print52x70",
};

const resolveGatewayOrigin = (baseUrl?: string) => {
  const fallback = GHN_GATEWAY_ORIGIN;
  const resolved = baseUrl ?? fallback;
  return new URL(resolved).origin;
};

export const buildGHNPrintUrls = (token: string, baseUrl?: string): GHNPrintUrls => {
  const origin = resolveGatewayOrigin(baseUrl);

  return {
    a5: `${origin}${PRINT_PATHS.a5}?token=${encodeURIComponent(token)}`,
    "80x80": `${origin}${PRINT_PATHS["80x80"]}?token=${encodeURIComponent(token)}`,
    "52x70": `${origin}${PRINT_PATHS["52x70"]}?token=${encodeURIComponent(token)}`,
  };
};
