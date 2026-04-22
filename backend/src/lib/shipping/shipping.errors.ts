export class UnsupportedShippingProviderError extends Error {
  constructor(providerCode: string) {
    super(`Shipping provider "${providerCode}" is not registered`);
    this.name = "UnsupportedShippingProviderError";
  }
}
