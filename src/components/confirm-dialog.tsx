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
import {
  ALERT_EVENT,
  CONFIRM_EVENT,
  PROMPT_EVENT,
  type PendingAlert,
  type PendingConfirm,
  type PendingPrompt,
} from "@/lib/confirm";

export function ConfirmHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [prompt, setPrompt] = useState<PendingPrompt | null>(null);
  const [alert, setAlert] = useState<PendingAlert | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const onAsk = (e: Event) => setPending((e as CustomEvent<PendingConfirm>).detail);
    const onPrompt = (e: Event) => {
      const detail = (e as CustomEvent<PendingPrompt>).detail;
      setValue(detail.defaultValue ?? "");
      setPrompt(detail);
    };
    const onAlert = (e: Event) => setAlert((e as CustomEvent<PendingAlert>).detail);
    window.addEventListener(CONFIRM_EVENT, onAsk);
    window.addEventListener(PROMPT_EVENT, onPrompt);
    window.addEventListener(ALERT_EVENT, onAlert);
    return () => {
      window.removeEventListener(CONFIRM_EVENT, onAsk);
      window.removeEventListener(PROMPT_EVENT, onPrompt);
      window.removeEventListener(ALERT_EVENT, onAlert);
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

  const closeAlert = () => {
    alert?.resolve();
    setAlert(null);
  };

  return (
    <>
      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
      >
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
      <AlertDialog
        open={!!prompt}
        onOpenChange={(open) => {
          if (!open) closePrompt(null);
        }}
      >
        <AlertDialogContent className="print:hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>{prompt?.title ?? ""}</AlertDialogTitle>
            <AlertDialogDescription>
              {prompt?.description ?? "Enter a value to continue."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            {prompt?.label && (
              <label
                htmlFor="cafe1-prompt-input"
                className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
              >
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  closePrompt(value);
                }
              }}
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
      <AlertDialog
        open={!!alert}
        onOpenChange={(open) => {
          if (!open) closeAlert();
        }}
      >
        <AlertDialogContent className="print:hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>{alert?.title ?? "Notice"}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {alert?.description ?? "Review this information before continuing."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={closeAlert}>
              {alert?.confirmLabel ?? "OK"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
