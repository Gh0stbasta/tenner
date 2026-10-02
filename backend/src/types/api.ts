/** Lambda / API Gateway HTTP API (payload 2.0) type aliases used across handlers. */

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export type ApiEvent = APIGatewayProxyEventV2;
export type ApiResult = APIGatewayProxyStructuredResultV2;
