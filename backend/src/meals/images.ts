/**
 * Dish photos (FOOD-011, ADR 0007): the browser uploads straight to the private image bucket with a presigned PUT
 * URL; CloudFront serves the object under /images/*. Keys are built here, never by the client:
 * images/meals/<tenantId>/<dishId>/<uuid>.<ext>. The API role may only write and delete under images/meals/.
 */

import { DeleteObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Logger } from "../utils/logger.js";
import { IMAGE_LIMITS, type ImageContentType } from "./models/image.js";

export { IMAGE_CONTENT_TYPES, IMAGE_LIMITS, type ImageContentType } from "./models/image.js";

const EXTENSIONS: Readonly<Record<ImageContentType, string>> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Cache for a year: a new photo always gets a new key. */
const CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Key prefix of one dish's photos. */
export function dishImagePrefix(tenantId: string, dishId: string): string {
  return `images/meals/${tenantId}/${dishId}/`;
}

export function newDishImageKey(tenantId: string, dishId: string, id: string, contentType: ImageContentType): string {
  return `${dishImagePrefix(tenantId, dishId)}${id}.${EXTENSIONS[contentType]}`;
}

/** Whether a key was issued for this household's dish (rejects other tenants, other dishes and made-up keys). */
export function isDishImageKey(key: string, tenantId: string, dishId: string): boolean {
  const prefix = dishImagePrefix(tenantId, dishId);
  return key.startsWith(prefix) && /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key.slice(prefix.length));
}

export interface ImageUpload {
  readonly uploadUrl: string;
  /** Headers the PUT must send exactly as signed. */
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresInSeconds: number;
}

export interface ImageStorage {
  /** Presigned PUT URL; content type, size and cache header are part of the signature. */
  uploadUrl(key: string, contentType: ImageContentType, size: number): Promise<ImageUpload>;
  /** Deletes an object; failures are logged, never thrown (an orphaned photo only costs a few KB). */
  deleteQuietly(key: string): Promise<void>;
}

export function createImageStorage(deps: { readonly client: S3Client; readonly bucket: string; readonly logger: Logger }): ImageStorage {
  return {
    async uploadUrl(key, contentType, size) {
      const command = new PutObjectCommand({ Bucket: deps.bucket, Key: key, ContentType: contentType, ContentLength: size, CacheControl: CACHE_CONTROL });
      const uploadUrl = await getSignedUrl(deps.client, command, {
        expiresIn: IMAGE_LIMITS.uploadExpirySeconds,
        signableHeaders: new Set(["content-type", "content-length", "cache-control"]),
        unhoistableHeaders: new Set(["content-type", "cache-control"]),
      });
      return {
        uploadUrl,
        headers: { "Content-Type": contentType, "Cache-Control": CACHE_CONTROL },
        expiresInSeconds: IMAGE_LIMITS.uploadExpirySeconds,
      };
    },
    async deleteQuietly(key) {
      try {
        await deps.client.send(new DeleteObjectCommand({ Bucket: deps.bucket, Key: key }));
      } catch (error) {
        deps.logger.warn("Dish image could not be deleted", { event: "DishImageCleanupFailed", imageKey: key, error: error instanceof Error ? error.name : "Unknown" });
      }
    },
  };
}
