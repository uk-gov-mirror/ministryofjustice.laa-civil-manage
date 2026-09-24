import { describe, it, expect, afterEach, mock } from "bun:test";
import { createClient, type RedisClientType } from "redis";
import { config } from "#src/config.js";
import { pingRedis, setRedisClientFactory } from "#src/models/healthModels.js";

describe("pingRedis", () => {
  const originalRedisUrl = config.session.redis_url;

  afterEach(() => {
    config.session.redis_url = originalRedisUrl;
    setRedisClientFactory(createClient);
  });

  it("connects, pings, returns the reply, and closes the connection", async () => {
    config.session.redis_url = "redis://test-host:6379";
    const connect = mock().mockResolvedValue(undefined);
    const ping = mock().mockResolvedValue("PONG");
    const quit = mock().mockResolvedValue(undefined);
    const fakeClient = {
      connect,
      ping,
      quit,
      isOpen: true,
    } as unknown as RedisClientType;
    const factory = mock(() => fakeClient);
    setRedisClientFactory(factory);

    const reply = await pingRedis();

    expect(factory).toHaveBeenCalledWith({ url: "redis://test-host:6379" });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(ping).toHaveBeenCalledTimes(1);
    expect(quit).toHaveBeenCalledTimes(1);
    expect(reply).toBe("PONG");
  });

  it("closes the connection even when the ping call fails", async () => {
    config.session.redis_url = "redis://test-host:6379";
    const connect = mock().mockResolvedValue(undefined);
    const pingError = new Error("PING timed out");
    const ping = mock().mockRejectedValue(pingError);
    const quit = mock().mockResolvedValue(undefined);
    const fakeClient = {
      connect,
      ping,
      quit,
      isOpen: true,
    } as unknown as RedisClientType;
    setRedisClientFactory(mock(() => fakeClient));

    const error = await pingRedis().catch((err: unknown) => err);

    expect(error).toBe(pingError);
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it("propagates a connection/auth error without quitting a connection that was never opened", async () => {
    const connectError = new Error("WRONGPASS invalid username-password pair");
    const connect = mock().mockRejectedValue(connectError);
    const ping = mock();
    const quit = mock();
    const fakeClient = {
      connect,
      ping,
      quit,
      isOpen: false,
    } as unknown as RedisClientType;
    config.session.redis_url = "redis://test-host:6379";
    setRedisClientFactory(mock(() => fakeClient));

    const error = await pingRedis().catch((err: unknown) => err);

    expect(error).toBe(connectError);
    expect(ping).not.toHaveBeenCalled();
    expect(quit).not.toHaveBeenCalled();
  });

  it("throws without attempting to connect when SESSION_REDIS_URL is not configured", async () => {
    config.session.redis_url = undefined;
    const factory = mock();
    setRedisClientFactory(factory);

    const error = await pingRedis().catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("SESSION_REDIS_URL");
    expect(factory).not.toHaveBeenCalled();
  });
});
