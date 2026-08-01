import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const EVENT = "cafe1:confirm";
const PROMPT_EVENT = "cafe1:prompt";

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

type PendingPrompt = PromptOptions & { resolve: (value: string | null) => void };

/** Accessible, focus-trapped replacement for window.prompt(). */
export function askPrompt(options: PromptOptions | string): Promise<string | null> {
  const opts = typeof options === "string" ? { title: options } : options;
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise<string | null>((resolve) => {
    const detail: PendingPrompt = { ...opts, resolve };
    const delivered = window.dispatchEvent(new CustomEvent<PendingPrompt>(PROMPT_EVENT, { detail }));
    if (!delivered) resolve(null);
  });
}

/**
 * Accessible, focus-trapped replacement for window.confirm().
 * Used to guard destructive admin/till actions.
 */
export function askConfirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === "string" ? { title: options } : options;
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const detail: Pending = { ...opts, resolve };
    const delivered = window.dispatchEvent(new CustomEvent<Pending>(EVENT, { detail }));
    if (!delivered) resolve(false);
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [prompt, setPrompt] = useState<PendingPrompt | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const onAsk = (e: Event) => setPending((e as CustomEvent<Pending>).detail);
    const onPrompt = (e: Event) => {
      const detail = (e as CustomEvent<PendingPrompt>).detail;
      setValue(detail.defaultValue ?? "");
      setPrompt(detail);
    };
    window.addEventListener(EVENT, onAsk);
    window.addEventListener(PROMPT_EVENT, onPrompt);
    return () => {
      window.removeEventListener(EVENT, onAsk);
      window.removeEventListener(PROMPT_EVENT, onPrompt);
    };
  }, []);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const closePrompt = (result: string | null) => {
    prompt?.resolve(result);
    setPrompt(null);
  };

  return (
    <>
    <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) close(false); }}>
      <AlertDialogContent className="print:hidden">
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title ?? "Are you sure?"}</AlertDialogTitle>
          {pending?.description ? (
            <AlertDialogDescription>{pending.description}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription className="sr-only">
              Confirm this action to continue.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {pending?.cancelLabel ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={
              pending?.destructive === false
                ? undefined
                : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            }
          >
            {pending?.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={!!prompt} onOpenChange={(open) => { if (!open) closePrompt(null); }}>
      <AlertDialogContent className="print:hidden">
        <AlertDialogHeader>
          <AlertDialogTitle>{prompt?.title ?? ""}</AlertDialogTitle>
          <AlertDialogDescription>
            {prompt?.description ?? "Enter a value to continue."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          {prompt?.label && (
            <label htmlFor="cafe1-prompt-input" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {prompt.label}
            </label>
          )}
          <input
            id="cafe1-prompt-input"
            autoFocus
            value={value}
            inputMode={prompt?.inputMode ?? "text"}
            placeholder={prompt?.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); closePrompt(value); } }}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => closePrompt(null)}>
            {prompt?.cancelLabel ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => closePrompt(value)}>
            {prompt?.confirmLabel ?? "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
