import { UnsupportedShippingProviderError } from "./shipping.errors";
import type {
  ShippingProviderDefinition,
  ShippingProviderStrategy,
} from "./shipping.types";

export class ShippingFacade {
  private readonly strategyMap: Map<string, ShippingProviderStrategy>;

  constructor(strategies: ShippingProviderStrategy[]) {
    this.strategyMap = new Map(
      strategies.map((strategy) => [strategy.definition.code.toLowerCase(), strategy]),
    );
  }

  listProviders(): ShippingProviderDefinition[] {
    return [...this.strategyMap.values()].map((strategy) => strategy.definition);
  }

  useProvider(providerCode: string): ShippingProviderStrategy {
    const strategy = this.strategyMap.get(providerCode.toLowerCase());

    if (!strategy) {
      throw new UnsupportedShippingProviderError(providerCode);
    }

    return strategy;
  }
}
