/** S3 client for dish photos (FOOD-011). One shared client per Lambda container. */

import { S3Client } from "@aws-sdk/client-s3";

let sharedClient: S3Client | undefined;

export function getS3Client(): S3Client {
  sharedClient ??= new S3Client({ maxAttempts: 2 });
  return sharedClient;
}
