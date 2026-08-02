import { useEffect, useState } from "react";
import { askConfirm } from "@/lib/confirm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type Device = { id: string; device_ref: string; name: string; side: string; active: boolean };
type Side = "jury" | "judge" | "public";
const SIDE_TONE: Record<Side, string> = {
  jury: "bg-indigo-600",
  judge: "bg-fuchsia-700",
  public: "bg-teal-600",
};

/** Maps each physical card terminal to the jury or public side of the court cafe. */
export function PosDevicesCard() {
  const [rows, setRows] = useState<Device[]>([]);
  const [ref, setRef] = useState("");
  const [name, setName] = useState("");
  const [side, setSide] = useState<Side>("jury");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("pos_devices")
      .select("id, device_ref, name, side, active")
      .order("side");
    setRows((data ?? []) as Device[]);
  }
  useEffect(() => {
    void load();
  }, []);

  async function add() {
    if (!ref.trim() || !name.trim()) return toast.error("Add a terminal reference and a name");
    setBusy(true);
    const { error } = await supabase
      .from("pos_devices")
      .insert({ device_ref: ref.trim(), name: name.trim(), side });
    setBusy(false);
    if (error) return toast.error(error.message);
    setRef("");
    setName("");
    toast.success("Terminal saved");
    void load();
  }

  async function setSideFor(id: string, next: Side) {
    const { error } = await supabase.from("pos_devices").update({ side: next }).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  async function remove(id: string) {
    if (
      !(await askConfirm({
        title: "Remove this card terminal?",
        description:
          "Orders taken on it will no longer be tagged to a side until it is added again.",
        confirmLabel: "Remove terminal",
      }))
    )
      return;
    const { error } = await supabase.from("pos_devices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="font-semibold">Card terminals — jury, judge or public side</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Give each card machine its terminal reference (serial or reader ID shown on the device) so
        imported POS sales land on the kitchen display marked JURY, JUDGE or PUBLIC SIDE.
      </p>

      <div className="mt-3 space-y-2">
        {rows.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{d.name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{d.device_ref}</p>
            </div>
            {(["jury", "judge", "public"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSideFor(d.id, s)}
                className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                  d.side === s
                    ? `${SIDE_TONE[s]} text-white`
                    : "border border-border hover:border-primary"
                }`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => remove(d.id)}
              className="grid h-8 w-8 place-items-center rounded-full border border-border hover:border-primary"
              aria-label="Remove terminal"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-muted-foreground">No terminals mapped yet.</p>}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Terminal name (e.g. Jury counter)"
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        />
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Terminal reference / serial"
          className="h-10 rounded-lg border border-border bg-background px-3 font-mono text-sm"
        />
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as Side)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="jury">Jury side</option>
          <option value="judge">Judge side</option>
          <option value="public">Public side</option>
        </select>
        <button
          disabled={busy}
          onClick={add}
          className="inline-flex h-10 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
    </section>
  );
}
