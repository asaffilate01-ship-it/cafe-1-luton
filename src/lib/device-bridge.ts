import { ticketToText, type Ticket } from "./imin";

const CONFIG_KEY = "cafe1-device-bridge-v2";
export const DEVICE_BRIDGE_CONFIG_EVENT = "cafe1:device-bridge-config";
const REQUEST_TIMEOUT_MS = 5_000;

export type DeviceBridgeConfig = {
  baseUrl: string;
  token: string;
};

export type DeviceBridgeHealth = {
  ok: boolean;
  service?: string;
  printer?: { configured: boolean; transport: string };
  message: string;
};

function cleanBaseUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.username || url.password) throw new Error("Do not put credentials in the bridge URL");
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("The device bridge URL must use http or https");
  }
  return url.toString().replace(/\/$/, "");
}

export function getDeviceBridgeConfig(): DeviceBridgeConfig {
  if (typeof window === "undefined") return { baseUrl: "", token: "" };
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(CONFIG_KEY) ?? "null",
    ) as Partial<DeviceBridgeConfig> | null;
    return {
      baseUrl: typeof parsed?.baseUrl === "string" ? parsed.baseUrl : "",
      token: typeof parsed?.token === "string" ? parsed.token : "",
    };
  } catch {
    return { baseUrl: "", token: "" };
  }
}

export function setDeviceBridgeConfig(config: DeviceBridgeConfig) {
  if (typeof window === "undefined") return;
  if (!config.baseUrl.trim()) {
    window.localStorage.removeItem(CONFIG_KEY);
    window.dispatchEvent(new Event(DEVICE_BRIDGE_CONFIG_EVENT));
    return;
  }
  const value = {
    baseUrl: cleanBaseUrl(config.baseUrl),
    token: config.token.trim(),
  } satisfies DeviceBridgeConfig;
  if (value.token.length < 20)
    throw new Error("Use a bridge pairing token of at least 20 characters");
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(DEVICE_BRIDGE_CONFIG_EVENT));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getDeviceBridgeConfig();
  if (!config.baseUrl || !config.token) throw new Error("Cafe 1 Device Bridge is not paired");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const body = (await response.json().catch(() => null)) as
      (T & { error?: string; message?: string }) | null;
    if (!response.ok) {
      throw new Error(body?.error || body?.message || `Device Bridge returned ${response.status}`);
    }
    if (!body) throw new Error("Device Bridge returned an empty response");
    return body;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Device Bridge did not respond within 5 seconds");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function checkDeviceBridge(): Promise<DeviceBridgeHealth> {
  try {
    const health = await request<{
      ok: boolean;
      service: string;
      printer: { configured: boolean; transport: string };
    }>("/v1/health");
    return {
      ...health,
      message: health.printer.configured
        ? `Connected · ${health.printer.transport} printer ready`
        : "Bridge connected, but no printer is configured",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not reach Cafe 1 Device Bridge",
    };
  }
}

export async function printViaDeviceBridge(tickets: Ticket[]): Promise<DeviceBridgeHealth> {
  try {
    await request<{ ok: true }>("/v1/print", {
      method: "POST",
      body: JSON.stringify({
        jobs: tickets.map((ticket) => ({ text: ticketToText(ticket), logo: ticket.logo === true })),
      }),
    });
    return {
      ok: true,
      message: `${tickets.length} ticket${tickets.length === 1 ? "" : "s"} printed`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not print through Device Bridge",
    };
  }
}

export async function openDrawerViaDeviceBridge(): Promise<DeviceBridgeHealth> {
  try {
    await request<{ ok: true }>("/v1/drawer/open", { method: "POST", body: "{}" });
    return { ok: true, message: "Cash drawer opened" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not open the cash drawer",
    };
  }
}
