/**
 * Dish photos (FOOD-011): issue presigned uploads, attach an uploaded photo to a dish, remove it. The client never
 * chooses a key: it gets one with the upload URL and may only attach keys of its own household's dish.
 */

import type { Identity } from "../../auth/index.js";
import { ValidationError } from "../../exceptions/index.js";
import type { IdGenerator } from "../../utils/clock.js";
import { isDishImageKey, newDishImageKey, type ImageStorage, type ImageUpload } from "../images.js";
import type { DishResponse } from "../models/dish.js";
import type { DishImageRequest, ImageUploadRequest } from "../validators.js";
import type { DishService } from "./dish.service.js";

export interface ImageUploadResponse extends ImageUpload {
  readonly imageKey: string;
}

export class DishImageService {
  constructor(
    private readonly dishes: DishService,
    private readonly storage: ImageStorage,
    private readonly ids: IdGenerator,
  ) {}

  /** A presigned PUT for a new photo of an existing dish. */
  async createUpload(identity: Identity, dishId: string, request: ImageUploadRequest): Promise<ImageUploadResponse> {
    await this.dishes.getDish(identity.tenantId, dishId);
    const imageKey = newDishImageKey(identity.tenantId, dishId, this.ids(), request.contentType);
    return { imageKey, ...(await this.storage.uploadUrl(imageKey, request.contentType, request.size)) };
  }

  /** Attach an uploaded photo; the previous one is deleted after the dish is saved. */
  async setImage(identity: Identity, dishId: string, request: DishImageRequest): Promise<DishResponse> {
    if (!isDishImageKey(request.imageKey, identity.tenantId, dishId)) {
      throw new ValidationError("Validation failed.", [{ field: "imageKey", message: "The image key does not belong to this dish." }]);
    }
    const { dish, previousKey } = await this.dishes.setImageKey(identity, dishId, request.imageKey);
    if (previousKey !== undefined && previousKey !== request.imageKey) await this.storage.deleteQuietly(previousKey);
    return dish;
  }

  async removeImage(identity: Identity, dishId: string): Promise<DishResponse> {
    const { dish, previousKey } = await this.dishes.setImageKey(identity, dishId, null);
    if (previousKey !== undefined) await this.storage.deleteQuietly(previousKey);
    return dish;
  }
}
