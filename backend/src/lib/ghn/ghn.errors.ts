export class GHNNotImplementedError extends Error {
  constructor(message = "GHN transport is not implemented") {
    super(message);
    this.name = "GHNNotImplementedError";
  }
}
