import type { HandleServerError } from "@sveltejs/kit/hooks";

/**
 * ISSUE-012: SvelteKit's default server error handler logs an unhelpful
 * `undefined` for uncaught SSR throws, so production 500s are undiagnosable.
 * This replacement logs a single structured JSON line (matching the request
 * logger / health job style) carrying the real error class, message, and
 * stack — or `String(error)` for non-Error throws — while returning a generic
 * body to the client so no internal detail leaks (Phase-12 posture).
 *
 * SvelteKit 3 passes every error here. Errors thrown with `error(...)` (`app`),
 * validation errors and SvelteKit's own errors (`framework`: 404, 405, 413, …)
 * keep their status and message and are not logged; only `unknown` errors are
 * logged and answered with the generic body.
 */
export const handleError: HandleServerError = (caught) => {
  if (caught.kind !== "unknown") return;
  const { error, event } = caught;
  const status = 500;
  const message = "Internal Error";
  const isError = error instanceof Error;

  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "unhandled_error",
      requestId: event.locals?.requestId ?? null,
      method: event.request.method,
      path: event.url.pathname,
      status,
      message,
      error: isError
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error),
    }),
  );

  return { message: "Internal Error" };
};
