import { ShippingFacade } from "./shipping.facade";
import type { ShippingProviderStrategy } from "./shipping.types";

export const createShippingFacade = (strategies: ShippingProviderStrategy[]) => {
  return new ShippingFacade(strategies);
};
