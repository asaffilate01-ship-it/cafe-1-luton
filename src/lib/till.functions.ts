import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type StaffContext = {
  userId: string;
  supabase: {
    rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" | "staff" }) => PromiseLike<{ data: unknown }>;
  };
};

async function assertStaff(context: StaffContext) {
  const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
  ]);
  if (!isAdmin && !isStaff) throw new Error("Forbidden");
}

/** Card readers (SumUp Solo) paired to this merchant account. */
export const listPairedReaders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { listReaders } = await import("./sumup-readers.server");
    try {
      const readers = await listReaders();
      return {
        ok: true as const,
        readers: readers.map((r) => ({ id: r.id, name: r.name, status: r.status ?? "unknown", model: r.device?.model ?? null })),
      };
    } catch (e) {
      return { ok: false as const, readers: [], error: e instanceof Error ? e.message : "Could not reach SumUp" };
    }
  });

/** Pairs a Solo device using the pairing code shown on its screen. */
export const pairSumupReader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ pairing_code: z.string().min(4).max(20), name: z.string().min(1).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { pairReader } = await import("./sumup-readers.server");
    const r = await pairReader(data.pairing_code, data.name);
    return { id: r.id, name: r.name };
  });

export const unpairSumupReader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reader_id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { unpairReader } = await import("./sumup-readers.server");
    await unpairReader(data.reader_id);
    return { ok: true };
  });

/** Pushes the basket total to the Solo device so the customer can tap. */
export const startReaderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        reader_id: z.string().min(1),
        amount_cents: z.number().int().min(1).max(500000),
        description: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { readerCheckout } = await import("./sumup-readers.server");
    const out = await readerCheckout({
      readerId: data.reader_id,
      amount_cents: data.amount_cents,
      description: data.description ?? "Cafe 1 counter sale",
    });
    return out;
  });

export const checkReaderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ client_transaction_id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { getReaderTransaction } = await import("./sumup-readers.server");
    const txn = await getReaderTransaction(data.client_transaction_id);
    const status = (txn?.status ?? "PENDING").toUpperCase();
    return {
      status,
      paid: status === "SUCCESSFUL" || status === "PAID",
      failed: status === "FAILED" || status === "CANCELLED",
      transaction_id: txn?.id ?? txn?.transaction_code ?? null,
    };
  });

export const cancelReaderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reader_id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { terminateReaderCheckout } = await import("./sumup-readers.server");
    try {
      await terminateReaderCheckout(data.reader_id);
    } catch {
      /* the reader may already be idle */
    }
    return { ok: true };
  });
