import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFetch, ok } from "../../tests/fetchMock";
import { dish } from "../../tests/dishFixtures";
import { dishImageUrl, fitWithin, PhotoError, placeholderFor, resizePhoto, uploadDishPhoto, type ImageTools } from "./dishImages";

const jpeg = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });

function tools(width: number, height: number, sizes: number[]): ImageTools & { encode: ReturnType<typeof vi.fn> } {
  const encode = vi.fn(async () => jpeg(sizes.shift() ?? 1));
  return { decode: async () => ({ width, height, source: {} as CanvasImageSource, close: vi.fn() }), encode } as never;
}

afterEach(() => vi.unstubAllGlobals());

describe("dish photos (FOOD-011)", () => {
  it("fits photos into 1200 px without upscaling", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(1080, 1920)).toEqual({ width: 675, height: 1200 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("lowers the JPEG quality until the photo is about 300 KB", async () => {
    const fake = tools(4000, 3000, [900_000, 500_000, 250_000]);
    const result = await resizePhoto(new Blob(["x"], { type: "image/heic" }), fake);
    expect(result.size).toBe(250_000);
    expect(fake.encode.mock.calls.map((call) => call.slice(1))).toEqual([
      [1200, 900, 0.85],
      [1200, 900, 0.75],
      [1200, 900, 0.65],
    ]);
  });

  it("keeps a photo between 300 KB and 2 MB after the last step, rejects bigger ones and non-images", async () => {
    expect((await resizePhoto(jpeg(10), tools(100, 100, [400_000, 400_000, 400_000, 400_000]))).size).toBe(400_000);
    await expect(resizePhoto(jpeg(10), tools(100, 100, [3e6, 3e6, 3e6, 3e6]))).rejects.toThrow("Das Foto ist zu groß.");
    await expect(resizePhoto(new Blob(["x"], { type: "application/pdf" }), tools(1, 1, []))).rejects.toThrow("Bitte ein Foto wählen.");
    const broken: ImageTools = { decode: () => Promise.reject(new Error("decode")), encode: vi.fn() };
    await expect(resizePhoto(jpeg(10), broken)).rejects.toBeInstanceOf(PhotoError);
  });

  it("uploads to the presigned URL without the API's auth header, then attaches the key", async () => {
    const fetchMock = mockFetch({
      "POST /meals/dishes/d-1/image-upload": ok({
        imageKey: "images/meals/default/d-1/k.jpg",
        uploadUrl: "https://bucket.s3.test/images/meals/default/d-1/k.jpg?X-Amz-Signature=x",
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
        expiresInSeconds: 300,
      }),
      "PUT /meals/dishes/d-1/image": ok(dish({ dishId: "d-1", imageKey: "images/meals/default/d-1/k.jpg" })),
    });
    const put = vi.fn(async () => new Response(null, { status: 200 }));
    const saved = await uploadDishPhoto("d-1", jpeg(1234), put);
    expect(saved.imageKey).toBe("images/meals/default/d-1/k.jpg");
    expect(fetchMock.calls().find((call) => call.key === "POST /meals/dishes/d-1/image-upload")?.body).toEqual({ contentType: "image/jpeg", size: 1234 });
    expect(put).toHaveBeenCalledWith(expect.stringContaining("https://bucket.s3.test/"), {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
      body: expect.any(Blob),
    });
    expect(fetchMock.calls().find((call) => call.key === "PUT /meals/dishes/d-1/image")?.body).toEqual({ imageKey: "images/meals/default/d-1/k.jpg" });
  });

  it("stops when S3 rejects the upload", async () => {
    const fetchMock = mockFetch({
      "POST /meals/dishes/d-1/image-upload": ok({ imageKey: "k", uploadUrl: "https://bucket.s3.test/k", headers: {}, expiresInSeconds: 300 }),
    });
    await expect(uploadDishPhoto("d-1", jpeg(1), async () => new Response(null, { status: 403 }))).rejects.toThrow("Das Foto konnte nicht hochgeladen werden.");
    expect(fetchMock.calls().map((call) => call.key)).not.toContain("PUT /meals/dishes/d-1/image");
  });

  it("serves photos from this origin and has a placeholder per category", () => {
    expect(dishImageUrl("images/meals/default/d-1/k.jpg")).toBe("/images/meals/default/d-1/k.jpg");
    expect(placeholderFor("PASTA")).toBe("🍝");
    expect(placeholderFor("SOUP")).toBe("🍲");
    expect(placeholderFor("UNKNOWN")).toBe("🍽️");
  });
});
