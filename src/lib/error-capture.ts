// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  if (isClientAbort(error)) return;
  lastCapturedError = { error, at: Date.now() };
}

// h3's HTTPError serializes to {"status":500,"unhandled":true,"message":"HTTPError"} —
// no stack, no cause — so a plain console.error(error) reaches the log pipeline with
// the failure detail stripped. Expand Error-like args into a string that keeps the
// message, stack, and the full cause chain.
const CAUSE_DEPTH_LIMIT = 5;
const DESCRIPTION_LENGTH_LIMIT = 8_000;

export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < CAUSE_DEPTH_LIMIT && current != null; depth++) {
    if (!(current instanceof Error)) {
      parts.push(typeof current === "string" ? current : safeStringify(current));
      break;
    }
    const label = depth === 0 ? "" : "caused by: ";
    const status = describeStatus(current);
    parts.push(`${label}${current.stack ?? `${current.name}: ${current.message}`}${status}`);
    current = current.cause;
  }
  return parts.join("\n").slice(0, DESCRIPTION_LENGTH_LIMIT);
}

function describeStatus(error: Error): string {
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const value = status ?? statusCode;
  return typeof value === "number" ? ` (status ${value})` : "";
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function isErrorLike(value: unknown): value is Error {
  return value instanceof Error;
}

// A browser that navigates away (or a cancelled preload) closes the socket
// mid-response; Node surfaces that as `Error: aborted` from _http_server.
// It is a client disconnect, not an app fault, so never record or log it.
export function isClientAbort(value: unknown): boolean {
  if (!(value instanceof Error)) return false;
  const code = (value as { code?: unknown }).code;
  return (
    value.message === "aborted" ||
    code === "ECONNRESET" ||
    code === "ERR_STREAM_PREMATURE_CLOSE" ||
    value.name === "AbortError"
  );
}

// Wrap console.error so errors logged by any layer — including h3's internal
// unhandled-error logging, which this file cannot hook directly — are both
// recorded for consumeLastCapturedError and expanded before serialization.
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  if (args.some((arg) => isClientAbort(arg))) return;
  const expanded = args.map((arg) => {
    if (!isErrorLike(arg)) return arg;
    record(arg);
    return describeError(arg);
  });
  originalConsoleError(...expanded);
};

if (typeof globalThis.addEventListener === "function") {
  // Capture phase + stopImmediatePropagation so a client disconnect never
  // reaches downstream reporters (which would surface it as a runtime error
  // with a blank-screen flag even though nothing in the app failed).
  globalThis.addEventListener(
    "error",
    (event) => {
      const error = (event as ErrorEvent).error ?? event;
      if (isClientAbort(error)) {
        event.stopImmediatePropagation();
        event.preventDefault?.();
        return;
      }
      record(error);
    },
    true,
  );
  globalThis.addEventListener(
    "unhandledrejection",
    (event) => {
      const reason = (event as PromiseRejectionEvent).reason;
      if (isClientAbort(reason)) {
        event.stopImmediatePropagation();
        event.preventDefault?.();
        return;
      }
      record(reason);
    },
    true,
  );
}

// The dev/Node HTTP server emits `Error: aborted` from _http_server when a
// browser navigates away mid-response. It arrives as a process-level
// uncaughtException, bypassing the listeners above — swallow just that case.
const nodeProcess = (globalThis as { process?: NodeJS.Process }).process;
if (nodeProcess && typeof nodeProcess.on === "function") {
  nodeProcess.on("uncaughtException", (error: unknown) => {
    if (isClientAbort(error)) return;
    record(error);
    originalConsoleError(describeError(error));
  });
  nodeProcess.on("unhandledRejection", (reason: unknown) => {
    if (isClientAbort(reason)) return;
    record(reason);
    originalConsoleError(describeError(reason));
  });
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
