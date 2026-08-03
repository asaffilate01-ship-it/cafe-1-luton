import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Password input with a show/hide toggle sized for touch on mobile. */
export function PasswordField({
  id,
  label = "Password",
  value,
  onChange,
  autoComplete = "current-password",
  minLength = 6,
  required = true,
  labelSlot,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  labelSlot?: React.ReactNode;
}) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="block text-sm font-medium">
          {label}
        </label>
        {labelSlot}
      </div>
      <div className="relative">
        <input
          id={inputId}
          name="password"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className="h-11 w-full rounded-xl border border-border bg-background pl-4 pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
