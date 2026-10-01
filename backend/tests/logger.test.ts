import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../src/utils/logger.js";

afterEach(() => vi.restoreAllMocks());

describe("createLogger", () => {
  it("writes JSON lines with level and fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    createLogger("INFO").info("hello", { a: 1 });
    expect(JSON.parse(info.mock.calls[0]?.[0] as string)).toEqual({ level: "INFO", message: "hello", a: 1 });
  });

  it("filters messages below the configured level", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logger = createLogger("WARN");

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(debug).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });

  it("writes debug messages at DEBUG level", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    createLogger("DEBUG").debug("d");
    expect(debug).toHaveBeenCalledOnce();
  });
});
