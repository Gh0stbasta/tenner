/** FOOD-011: dish photos — key scope, presigned upload constraints, replace and remove. */

import { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import {
  createDishSchema,
  createImageStorage,
  DishImageService,
  DishService,
  imageUploadSchema,
  IngredientService,
  isDishImageKey,
  newDishImageKey,
  type ImageStorage,
} from "../src/meals/index.js";
import { ValidationError } from "../src/exceptions/index.js";
import { validate } from "../src/validators/index.js";
import { inMemoryMeals } from "./mocks/meals.js";
import { mockLogger, TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-09T10:00:00Z");
const PHOTO_ID = "11111111-1111-4111-8111-111111111111";

function setup() {
  const meals = inMemoryMeals();
  const ingredients = new IngredientService(meals.store, () => NOW);
  let next = 0;
  const ids = () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
  const dishes = new DishService(meals.store, (tenantId) => ingredients.ingredientsOf(tenantId), () => NOW, ids);
  const storage = {
    uploadUrl: vi.fn<ImageStorage["uploadUrl"]>(async () => ({ uploadUrl: "https://bucket.s3.test/put", headers: { "Content-Type": "image/jpeg" }, expiresInSeconds: 300 })),
    deleteQuietly: vi.fn<ImageStorage["deleteQuietly"]>(async () => undefined),
  };
  const images = new DishImageService(dishes, storage, () => PHOTO_ID);
  return { dishes, storage, images };
}

async function aDish(dishes: DishService) {
  const request = validate(createDishSchema, {
    name: "Onigiri",
    category: "RICE",
    slots: ["LUNCH"],
    lightness: "LIGHT",
    temperature: "COLD",
    activeMinutes: 15,
    ingredients: [{ ingredientId: "sushi-rice", quantity: 80, unit: "g" }],
  });
  return dishes.createDish(TEST_IDENTITY, request);
}

describe("dish image keys", () => {
  it("are built per tenant and dish and only accepted for that dish", () => {
    const key = newDishImageKey("default", "d-1", PHOTO_ID, "image/webp");
    expect(key).toBe(`images/meals/default/d-1/${PHOTO_ID}.webp`);
    expect(isDishImageKey(key, "default", "d-1")).toBe(true);
    expect(isDishImageKey(key, "other", "d-1")).toBe(false);
    expect(isDishImageKey(key, "default", "d-2")).toBe(false);
    expect(isDishImageKey(`images/meals/default/d-1/../../other/d-1/${PHOTO_ID}.jpg`, "default", "d-1")).toBe(false);
    expect(isDishImageKey(`images/meals/default/d-1/${PHOTO_ID}.gif`, "default", "d-1")).toBe(false);
  });

  it("uploads are limited to JPEG, PNG, WebP up to 2 MB", () => {
    expect(validate(imageUploadSchema, { contentType: "image/png", size: 2 * 1024 * 1024 })).toEqual({ contentType: "image/png", size: 2 * 1024 * 1024 });
    expect(() => validate(imageUploadSchema, { contentType: "image/svg+xml", size: 100 })).toThrow(ValidationError);
    expect(() => validate(imageUploadSchema, { contentType: "image/jpeg", size: 0 })).toThrow(ValidationError);
    expect(() => validate(imageUploadSchema, { contentType: "image/jpeg", size: 1.5 })).toThrow(ValidationError);
    expect(() => validate(imageUploadSchema, { contentType: "image/jpeg", size: 100, key: "x" })).toThrow(ValidationError);
  });
});

describe("DishImageService", () => {
  it("issues an upload for an existing dish with a key in the household's prefix", async () => {
    const { dishes, storage, images } = setup();
    const dish = await aDish(dishes);
    const upload = await images.createUpload(TEST_IDENTITY, dish.dishId, { contentType: "image/jpeg", size: 250_000 });
    expect(upload.imageKey).toBe(`images/meals/default/${dish.dishId}/${PHOTO_ID}.jpg`);
    expect(storage.uploadUrl).toHaveBeenCalledWith(upload.imageKey, "image/jpeg", 250_000);
    await expect(images.createUpload(TEST_IDENTITY, "00000000-0000-4000-8000-999999999999", { contentType: "image/jpeg", size: 1 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("sets a photo, deletes the replaced one and removes it", async () => {
    const { dishes, storage, images } = setup();
    const dish = await aDish(dishes);
    const first = newDishImageKey("default", dish.dishId, PHOTO_ID, "image/jpeg");
    const second = newDishImageKey("default", dish.dishId, "22222222-2222-4222-8222-222222222222", "image/webp");
    expect((await images.setImage(TEST_IDENTITY, dish.dishId, { imageKey: first })).imageKey).toBe(first);
    expect(storage.deleteQuietly).not.toHaveBeenCalled();
    expect((await images.setImage(TEST_IDENTITY, dish.dishId, { imageKey: second })).imageKey).toBe(second);
    expect(storage.deleteQuietly).toHaveBeenCalledWith(first);
    const removed = await images.removeImage(TEST_IDENTITY, dish.dishId);
    expect(removed.imageKey).toBeUndefined();
    expect(storage.deleteQuietly).toHaveBeenLastCalledWith(second);
    expect((await dishes.getDish("default", dish.dishId)).imageKey).toBeUndefined();
  });

  it("rejects another tenant's or another dish's key", async () => {
    const { dishes, images } = setup();
    const dish = await aDish(dishes);
    for (const imageKey of [newDishImageKey("other", dish.dishId, PHOTO_ID, "image/jpeg"), newDishImageKey("default", "d-x", PHOTO_ID, "image/jpeg"), "images/meals/default/x.jpg"]) {
      await expect(images.setImage(TEST_IDENTITY, dish.dishId, { imageKey })).rejects.toBeInstanceOf(ValidationError);
    }
    expect((await dishes.getDish("default", dish.dishId)).imageKey).toBeUndefined();
  });

  it("does not let the general dish update set a photo key", async () => {
    const { dishes } = setup();
    const dish = await aDish(dishes);
    await dishes.updateDish(TEST_IDENTITY, dish.dishId, { favorite: true });
    expect((await dishes.getDish("default", dish.dishId)).imageKey).toBeUndefined();
  });
});

describe("createImageStorage", () => {
  const client = new S3Client({ region: "eu-central-1", credentials: { accessKeyId: "AKIDTEST", secretAccessKey: "secret" } });

  it("presigns a 5-minute PUT with type, size and cache header in the signature", async () => {
    const storage = createImageStorage({ client, bucket: "tenner-meal-images-prod", logger: mockLogger() });
    const upload = await storage.uploadUrl(`images/meals/default/d-1/${PHOTO_ID}.jpg`, "image/jpeg", 250_000);
    const url = new URL(upload.uploadUrl);
    expect(url.hostname).toBe("tenner-meal-images-prod.s3.eu-central-1.amazonaws.com");
    expect(url.pathname).toBe(`/images/meals/default/d-1/${PHOTO_ID}.jpg`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(expect.arrayContaining(["content-length", "content-type", "cache-control", "host"]));
    expect(upload.headers).toEqual({ "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" });
    expect(upload.expiresInSeconds).toBe(300);
  });

  it("logs instead of failing when a delete fails", async () => {
    const logger = mockLogger();
    const failing = { send: vi.fn(async () => Promise.reject(new Error("AccessDenied"))) } as unknown as S3Client;
    const storage = createImageStorage({ client: failing, bucket: "b", logger });
    await expect(storage.deleteQuietly("images/meals/default/d-1/x.jpg")).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith("Dish image could not be deleted", expect.objectContaining({ event: "DishImageCleanupFailed" }));
  });

  it("deletes the object", async () => {
    const send = vi.fn(async () => ({}));
    const storage = createImageStorage({ client: { send } as unknown as S3Client, bucket: "b", logger: mockLogger() });
    await storage.deleteQuietly("images/meals/default/d-1/x.jpg");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ input: { Bucket: "b", Key: "images/meals/default/d-1/x.jpg" } }));
  });
});
