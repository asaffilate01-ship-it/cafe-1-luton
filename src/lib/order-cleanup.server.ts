/**
 * Reconciles stale payment orders without deleting financial records. A paid
 * SumUp checkout is recovered first; only authoritatively unpaid/expired rows
 * are marked abandoned and have their reserved benefits released.
 */
// Website/online checkouts are abandoned quickly; counter (reader) payments
// get longer to reconcile because a terminal can take minutes to respond.
const WEB_UNPAID_TTL_MS = 5 * 60 * 1000;
const COUNTER_UNPAID_TTL_MS = 30 * 60 * 1000;

async function reconcileReaderPayments(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getReaderTransaction } = await import("./sumup-readers.server");
  const { data: attempts } = await supabaseAdmin
    .from("payment_attempts")
    .select("*")
    .in("status", ["pending", "paid"])
    .lt("created_at", new Date(Date.now() - 30_000).toISOString())
    .limit(100);

  let recovered = 0;
  for (const attempt of attempts ?? []) {
    if (attempt.status === "pending" && attempt.client_transaction_id) {
      const transaction = await getReaderTransaction(attempt.client_transaction_id);
      const status = transaction?.status?.toUpperCase() ?? "PENDING";
      if (status === "SUCCESSFUL" || status === "PAID") {
        const amountCents = Math.round(Number(transaction?.amount ?? 0) * 100);
        const transactionId = transaction?.id ?? transaction?.transaction_code;
        if (
          amountCents === attempt.amount_cents &&
          (transaction?.currency ?? "GBP") === attempt.currency &&
          transactionId
        ) {
          await supabaseAdmin
            .from("payment_attempts")
            .update({ status: "paid", provider_transaction_id: transactionId })
            .eq("id", attempt.id)
            .eq("status", "pending");
          attempt.status = "paid";
          attempt.provider_transaction_id = transactionId;
        }
      } else if (["FAILED", "CANCELLED", "CANCELED"].includes(status)) {
        await supabaseAdmin
          .from("payment_attempts")
          .update({ status: "failed", failure_reason: `Reader returned ${status}` })
          .eq("id", attempt.id);
      }
    }

    if (attempt.status === "paid" && attempt.provider_transaction_id) {
      const { error } = await supabaseAdmin.rpc("finalize_counter_card", {
        _order_id: attempt.order_id,
        _payment_attempt_id: attempt.id,
      });
      if (!error) recovered++;
    }
  }
  return recovered;
}

export async function purgeStaleUnpaidOrders(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await reconcileReaderPayments();
  const cutoff = new Date(Date.now() - WEB_UNPAID_TTL_MS).toISOString();

  const { data: stale } = await supabaseAdmin
    .from("orders")
    .select(
      "id, source, created_at, total_cents, sumup_reference, promo_code, sumup_checkout_id, voucher_holder_id, voucher_cents, customer_id, loyalty_free_drinks_used",
    )
    .eq("status", "pending_payment")
    .eq("payment_status", "pending")
    .lt("created_at", cutoff)
    .limit(200);

  let abandoned = 0;
  for (const order of stale ?? []) {
    // Counter orders keep the longer grace period.
    if (
      order.source !== "web" &&
      Date.now() - new Date(order.created_at).getTime() < COUNTER_UNPAID_TTL_MS
    ) {
      continue;
    }
    if (order.sumup_checkout_id) {
      try {
        const { getSumUpCheckout } = await import("./sumup.server");
        const checkout = await getSumUpCheckout(order.sumup_checkout_id);
        if (checkout.status === "PAID") {
          const matches =
            checkout.id === order.sumup_checkout_id &&
            checkout.checkout_reference === order.sumup_reference &&
            checkout.currency === "GBP" &&
            Math.round(Number(checkout.amount) * 100) === order.total_cents &&
            Boolean(checkout.transaction_id);
          if (!matches) {
            console.error("[order-cleanup] paid checkout mismatch", order.id);
            continue;
          }
          const { error } = await supabaseAdmin
            .from("orders")
            .update({
              payment_status: "paid",
              status: "preparing",
              sumup_transaction_id: checkout.transaction_id ?? null,
            })
            .eq("id", order.id)
            .eq("payment_status", "pending");
          if (!error) {
            const { awardLoyaltyForOrder } = await import("./loyalty.server");
            await awardLoyaltyForOrder(order.id);
          }
          continue;
        }
        if (["PENDING", "PROCESSING"].includes(checkout.status)) continue;
      } catch (error) {
        console.error("[order-cleanup] SumUp reconciliation failed", order.id, error);
        continue;
      }
    }

    // A reader response that is still uncertain must never release benefits or
    // abandon the order. The next scheduler run will reconcile it again.
    if (order.source === "counter") {
      const { data: activeAttempt } = await supabaseAdmin
        .from("payment_attempts")
        .select("id")
        .eq("order_id", order.id)
        .in("status", ["created", "pending", "paid"])
        .limit(1)
        .maybeSingle();
      if (activeAttempt) continue;
    }

    await supabaseAdmin.from("voucher_redemptions").delete().eq("order_id", order.id);
    if (order.voucher_holder_id && order.voucher_cents > 0) {
      const { data: holder } = await supabaseAdmin
        .from("voucher_holders")
        .select("code")
        .eq("id", order.voucher_holder_id)
        .maybeSingle();
      if (holder) {
        await supabaseAdmin.from("voucher_events").insert({
          holder_id: order.voucher_holder_id,
          code: holder.code,
          event: "release",
          amount_cents: order.voucher_cents,
          order_id: order.id,
          detail: "Payment abandoned after provider reconciliation",
        });
      }
    }

    if (order.promo_code) {
      const { data: promo } = await supabaseAdmin
        .from("promo_codes")
        .select("id, uses")
        .ilike("code", order.promo_code)
        .maybeSingle();
      if (promo && promo.uses > 0) {
        await supabaseAdmin
          .from("promo_codes")
          .update({ uses: promo.uses - 1 })
          .eq("id", promo.id)
          .eq("uses", promo.uses);
      }
    }

    if (order.customer_id && order.loyalty_free_drinks_used > 0) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("free_drinks_available, free_drinks_redeemed")
        .eq("id", order.customer_id)
        .maybeSingle();
      if (profile) {
        await supabaseAdmin
          .from("profiles")
          .update({
            free_drinks_available: profile.free_drinks_available + order.loyalty_free_drinks_used,
            free_drinks_redeemed: Math.max(
              0,
              profile.free_drinks_redeemed - order.loyalty_free_drinks_used,
            ),
          })
          .eq("id", order.customer_id);
      }
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "failed",
        status: "cancelled",
        abandoned_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("payment_status", "pending");
    if (!error) abandoned++;
  }
  return abandoned;
}
