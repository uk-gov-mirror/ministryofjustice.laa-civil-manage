import type { Request, Response } from "express";
import { logger } from "#src/utils/logger.js";
import { pingRedis } from "#src/models/healthModels.js";

const SUCCESSFUL_REQUEST = 200;
const SERVICE_UNAVAILABLE = 503;
const CACHE_CONTROL_HEADER = "no-cache, no-store, max-age=0, must-revalidate";

export const getHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const reply = await pingRedis();
    if (reply !== "PONG") {
      throw new Error(`Unexpected Redis PING reply: ${reply}`);
    }

    res.set("Cache-Control", CACHE_CONTROL_HEADER);
    res.status(SUCCESSFUL_REQUEST).json({
      status: "UP",
      components: { redis: { status: "UP" } },
    });
  } catch (error: unknown) {
    logger.logError(
      "healthController.getHealth",
      "Redis health check failed",
      error,
      req,
    );

    res.set("Cache-Control", CACHE_CONTROL_HEADER);
    res.status(SERVICE_UNAVAILABLE).json({
      status: "DOWN",
      components: { redis: { status: "DOWN" } },
    });
  }
};

export const getLiveness = (_req: Request, res: Response): void => {
  res.set("Cache-Control", CACHE_CONTROL_HEADER);
  res.status(SUCCESSFUL_REQUEST).json({ status: "UP" });
};

export const getReadiness = (_req: Request, res: Response): void => {
  res.set("Cache-Control", CACHE_CONTROL_HEADER);
  res.status(SUCCESSFUL_REQUEST).json({ status: "UP" });
};
