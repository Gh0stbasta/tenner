import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger, errorFields } from "../src/utils/logger.js";

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

describe("child loggers", () => {
  it("add context fields such as correlationId to every entry", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    createLogger("INFO", { app: "tenner" }).child({ correlationId: "c-1" }).info("hi", { x: 1 });
    expect(JSON.parse(info.mock.calls[0]?.[0] as string)).toEqual({ level: "INFO", message: "hi", app: "tenner", correlationId: "c-1", x: 1 });
  });

  it("inherit the level threshold", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    createLogger("ERROR").child({ a: 1 }).info("hidden");
    expect(info).not.toHaveBeenCalled();
  });
});

describe("errorFields", () => {
  it("serializes errors without stack traces", () => {
    const error = Object.assign(new Error("boom"), { code: "ConditionalCheckFailed" });
    expect(errorFields(error)).toEqual({ errorName: "Error", errorMessage: "boom", errorCode: "ConditionalCheckFailed" });
    expect(errorFields(new TypeError("t"))).toEqual({ errorName: "TypeError", errorMessage: "t" });
    expect(errorFields("plain")).toEqual({ errorMessage: "plain" });
  });
});
