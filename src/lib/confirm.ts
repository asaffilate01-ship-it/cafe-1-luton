export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export type PromptOptions = {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputMode?: "text" | "decimal" | "numeric";
};

export type AlertOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
};

export type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void };
export type PendingPrompt = PromptOptions & { resolve: (value: string | null) => void };
export type PendingAlert = AlertOptions & { resolve: () => void };

export const CONFIRM_EVENT = "cafe1:confirm";
export const PROMPT_EVENT = "cafe1:prompt";
export const ALERT_EVENT = "cafe1:alert";

/** Accessible, focus-trapped replacement for window.prompt(). */
export function askPrompt(options: PromptOptions | string): Promise<string | null> {
  const opts = typeof options === "string" ? { title: options } : options;
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise<string | null>((resolve) => {
    const detail: PendingPrompt = { ...opts, resolve };
    const delivered = window.dispatchEvent(
      new CustomEvent<PendingPrompt>(PROMPT_EVENT, { detail }),
    );
    if (!delivered) resolve(null);
  });
}

/** Accessible, focus-trapped replacement for window.confirm(). */
export function askConfirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === "string" ? { title: options } : options;
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const detail: PendingConfirm = { ...opts, resolve };
    const delivered = window.dispatchEvent(
      new CustomEvent<PendingConfirm>(CONFIRM_EVENT, { detail }),
    );
    if (!delivered) resolve(false);
  });
}

/** Accessible, focus-trapped replacement for window.alert(). */
export function askAlert(options: AlertOptions | string): Promise<void> {
  const opts = typeof options === "string" ? { title: options } : options;
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const detail: PendingAlert = { ...opts, resolve };
    const delivered = window.dispatchEvent(new CustomEvent<PendingAlert>(ALERT_EVENT, { detail }));
    if (!delivered) resolve();
  });
}
