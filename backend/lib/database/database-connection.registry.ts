import type { DatabaseConnectionName, DatabaseConnectionStrategy } from "./database-connection.types";

export class DatabaseConnectionRegistry {
  private readonly strategies = new Map<DatabaseConnectionName, DatabaseConnectionStrategy>();

  register(strategy: DatabaseConnectionStrategy) {
    this.strategies.set(strategy.name, strategy);
    return this;
  }

  get(name: DatabaseConnectionName) {
    const strategy = this.strategies.get(name);

    if (!strategy) {
      throw new Error(`Database connection "${name}" is not registered`);
    }

    return strategy;
  }

  names() {
    return Array.from(this.strategies.keys());
  }
}
