type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

/**
 * Browsers routinely cancel route preloads and document requests when the user
 * navigates, refreshes, or closes a tab. These are control-flow events rather
 * than application failures and must not reach the preview runtime overlay.
 */
export function isExpectedCancellation(value: unknown): boolean {
  let current: unknown = value;
  for (let depth = 0; depth < 4 && current != null; depth += 1) {
    if (current instanceof DOMException && current.name === "AbortError") return true;
    if (current instanceof Error) {
      const code = (current as Error & { code?: unknown }).code;
      const message = current.message.trim().toLowerCase();
      if (
        current.name === "AbortError" ||
        code === "ABORT_ERR" ||
        code === "ECONNRESET" ||
        code === "ERR_STREAM_PREMATURE_CLOSE" ||
        message === "aborted" ||
        message === "the operation was aborted" ||
        message.includes("signal is aborted")
      ) {
        return true;
      }
      current = current.cause;
      continue;
    }
    break;
  }
  return false;
}

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  if (isExpectedCancellation(error)) return;
  window.__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
  // Prod React does not rethrow boundary-caught errors to window.onerror, so the
  // editor's telemetry never sees them. Forward to lovable.js's reporting hook,
  // which is present only inside the editor preview.
  // Loaders and server fns commonly throw a raw Response; String(it) is the
  // opaque "[object Response]", so pull out the status and URL instead.
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  window.__lovableReportRuntimeError?.({
    message,
    stack: error instanceof Error ? error.stack : undefined,
    filename: window.location.pathname,
  });
}
