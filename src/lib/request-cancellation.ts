type ErrorLike = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  cause?: unknown;
};

function asErrorLike(value: unknown): ErrorLike | undefined {
  return value != null && typeof value === "object" ? (value as ErrorLike) : undefined;
}

/**
 * Client disconnects can cross Vite/Node VM boundaries, so `instanceof Error`
 * is not reliable. Inspect the small stable error shape and its cause chain.
 */
export function isRequestCancellation(value: unknown): boolean {
  let current: unknown = value;
  for (let depth = 0; depth < 5 && current != null; depth += 1) {
    const error = asErrorLike(current);
    if (!error) return false;

    const name = typeof error.name === "string" ? error.name : "";
    const message = typeof error.message === "string" ? error.message.trim().toLowerCase() : "";
    const code = typeof error.code === "string" ? error.code.toUpperCase() : "";

    if (
      name === "AbortError" ||
      code === "ABORT_ERR" ||
      code === "ECONNABORTED" ||
      code === "ECONNRESET" ||
      code === "ERR_STREAM_PREMATURE_CLOSE" ||
      message === "aborted" ||
      message === "the operation was aborted" ||
      message === "request aborted" ||
      message.includes("signal is aborted")
    ) {
      return true;
    }

    current = error.cause;
  }
  return false;
}