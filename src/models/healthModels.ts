import { createClient, type RedisClientType } from "redis";
import { config } from "#src/config.js";

export type RedisClientFactory = (options: { url: string }) => RedisClientType;

let clientFactory: RedisClientFactory = createClient;

export const setRedisClientFactory = (factory: RedisClientFactory): void => {
  clientFactory = factory;
};

export const pingRedis = async (): Promise<string> => {
  const redisUrl = config.session.redis_url;
  if (redisUrl === undefined || redisUrl === "") {
    throw new Error("SESSION_REDIS_URL is not configured");
  }

  const client = clientFactory({ url: redisUrl });
  await client.connect();

  try {
    return await client.ping();
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
  }
};
