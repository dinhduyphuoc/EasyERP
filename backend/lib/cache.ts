import { createClient } from "redis";

type CachedValue = {
  value: string;
  expiresAt: number;
};

class InMemoryCacheStore {
  private readonly store = new Map<string, CachedValue>();

  async get(key: string) {
    const cached = this.store.get(key);

    if (!cached) {
      return null;
    }

    if (cached.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return cached.value;
  }

  async set(key: string, value: string, ttlSeconds: number) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string) {
    this.store.delete(key);
  }

  async deleteByPrefix(prefix: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

class AppCache {
  private readonly redisUrl = process.env.REDIS_URL?.trim();
  private readonly memoryStore = new InMemoryCacheStore();
  private redisClient: ReturnType<typeof createClient> | null = null;
  private redisEnabled = false;

  get isRedisConfigured() {
    return Boolean(this.redisUrl);
  }

  async connect() {
    if (!this.redisUrl || this.redisClient) {
      return;
    }

    const client = createClient({ url: this.redisUrl });
    client.on("error", (error) => {
      console.error("Redis client error.");
      console.error(error);
    });

    try {
      await client.connect();
      this.redisClient = client;
      this.redisEnabled = true;
      console.log("Redis connection succeeded.");
    } catch (error) {
      console.error("Redis connection failed. Falling back to in-memory cache.");
      console.error(error);
      this.redisClient = null;
      this.redisEnabled = false;
    }
  }

  async disconnect() {
    if (!this.redisClient) {
      return;
    }

    await this.redisClient.quit();
    this.redisClient = null;
    this.redisEnabled = false;
  }

  async getJson<T>(key: string) {
    const rawValue = this.redisEnabled && this.redisClient
      ? await this.redisClient.get(key)
      : await this.memoryStore.get(key);

    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as T;
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number) {
    const serialized = JSON.stringify(value);

    if (this.redisEnabled && this.redisClient) {
      await this.redisClient.set(key, serialized, { EX: ttlSeconds });
      return;
    }

    await this.memoryStore.set(key, serialized, ttlSeconds);
  }

  async delete(key: string) {
    if (this.redisEnabled && this.redisClient) {
      await this.redisClient.del(key);
      return;
    }

    await this.memoryStore.del(key);
  }

  async deleteByPrefix(prefix: string) {
    if (this.redisEnabled && this.redisClient) {
      const keys: string[] = [];

      for await (const key of this.redisClient.scanIterator({
        MATCH: `${prefix}*`,
        COUNT: 100,
      })) {
        keys.push(...(Array.isArray(key) ? key : [key]));
      }

      for (const key of keys) {
        await this.redisClient.del(key);
      }

      return;
    }

    await this.memoryStore.deleteByPrefix(prefix);
  }
}

export const cache = new AppCache();
