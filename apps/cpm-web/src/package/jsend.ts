/** The JSend envelope every registry JSON endpoint responds with. */
export type JSend<T> =
  | { status: "success"; data: T }
  | { status: "fail"; data: { message: string } }
  | { status: "error"; message: string };

export class RegistryError extends Error {}

/** Unwraps a JSend envelope into its data, throwing on fail/error envelopes. */
export function unwrapJSend<T>(body: JSend<T>): T {
  if (body.status === "success") return body.data;
  throw new RegistryError(body.status === "fail" ? body.data.message : body.message);
}
