import {
  describe,
  expect,
  it,
  mock,
  spyOn,
  beforeEach,
  afterEach,
} from "bun:test";
import type { Request, Response } from "express";
import { logger } from "#src/utils/logger.js";
import * as healthModels from "#src/models/healthModels.js";
import {
  getHealth,
  getLiveness,
  getReadiness,
} from "#src/controllers/healthController.js";

describe("getHealth", () => {
  let pingRedisSpy: ReturnType<typeof spyOn<typeof healthModels, "pingRedis">>;
  let logErrorSpy: ReturnType<typeof spyOn<typeof logger, "logError">>;

  beforeEach(() => {
    pingRedisSpy = spyOn(healthModels, "pingRedis");
    logErrorSpy = spyOn(logger, "logError").mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
  });

  it("returns 200 with an UP payload when Redis responds with PONG", async () => {
    pingRedisSpy.mockResolvedValue("PONG");
    const json = mock();
    const status = mock(() => ({ json }));
    const setHeader = mock();
    const req = {} as Request;
    const res = { status, set: setHeader } as unknown as Response;

    await getHealth(req, res);

    expect(pingRedisSpy).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      status: "UP",
      components: { redis: { status: "UP" } },
    });
    expect(logErrorSpy).not.toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "no-cache, no-store, max-age=0, must-revalidate",
    );
  });

  it("returns 503 with a DOWN payload and logs the error when Redis rejects (connection error, timeout, or auth failure)", async () => {
    const redisError = new Error("connect ECONNREFUSED 127.0.0.1:6379");
    pingRedisSpy.mockRejectedValue(redisError);
    const json = mock();
    const status = mock(() => ({ json }));
    const setHeader = mock();
    const req = {} as Request;
    const res = { status, set: setHeader } as unknown as Response;

    await getHealth(req, res);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      status: "DOWN",
      components: { redis: { status: "DOWN" } },
    });
    expect(logErrorSpy).toHaveBeenCalledWith(
      "healthController.getHealth",
      "Redis health check failed",
      redisError,
      req,
    );
    expect(setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "no-cache, no-store, max-age=0, must-revalidate",
    );

    const [payload] = json.mock.calls[0] as [Record<string, unknown>];
    expect(JSON.stringify(payload)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(payload)).not.toContain(redisError.stack);
  });

  it("returns 503 with a DOWN payload when Redis responds with something other than PONG", async () => {
    pingRedisSpy.mockResolvedValue("UNEXPECTED");
    const json = mock();
    const status = mock(() => ({ json }));
    const setHeader = mock();
    const req = {} as Request;
    const res = { status, set: setHeader } as unknown as Response;

    await getHealth(req, res);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      status: "DOWN",
      components: { redis: { status: "DOWN" } },
    });
    expect(logErrorSpy).toHaveBeenCalledWith(
      "healthController.getHealth",
      "Redis health check failed",
      expect.anything(),
      req,
    );
    expect(setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "no-cache, no-store, max-age=0, must-revalidate",
    );
  });
});

describe("getLiveness", () => {
  afterEach(() => {
    mock.restore();
  });

  it("returns 200 with a static UP payload without checking Redis", () => {
    const pingRedisSpy = spyOn(healthModels, "pingRedis");
    const json = mock();
    const status = mock(() => ({ json }));
    const setHeader = mock();
    const res = { status, set: setHeader } as unknown as Response;

    getLiveness({} as Request, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ status: "UP" });
    expect(pingRedisSpy).not.toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "no-cache, no-store, max-age=0, must-revalidate",
    );
  });
});

describe("getReadiness", () => {
  afterEach(() => {
    mock.restore();
  });

  it("returns 200 with a static UP payload without checking Redis", () => {
    const pingRedisSpy = spyOn(healthModels, "pingRedis");
    const json = mock();
    const status = mock(() => ({ json }));
    const setHeader = mock();
    const res = { status, set: setHeader } as unknown as Response;

    getReadiness({} as Request, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ status: "UP" });
    expect(pingRedisSpy).not.toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "no-cache, no-store, max-age=0, must-revalidate",
    );
  });
});
