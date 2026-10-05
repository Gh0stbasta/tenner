import type { ResponseEnvelope } from "ask-sdk-model";

/** The SSML of a response, or undefined. */
export function ssml(response: ResponseEnvelope): string | undefined {
  const speech = response.response.outputSpeech;
  return speech?.type === "SSML" ? speech.ssml : undefined;
}
