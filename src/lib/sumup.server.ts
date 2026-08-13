// Server-only helper for SumUp Online Checkouts API.
// Requires env vars: SUMUP_API_KEY (secret key), SUMUP_MERCHANT_CODE.
const BASE = "https://api.sumup.com";

export type SumUpCheckout = {
  id: string;
  checkout_reference: string;
  status: string;
  amount: number;
  currency: string;
  hosted_checkout_url?: string;
  transaction_id?: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}. Add it in Cloud secrets to enable SumUp payments.`);
  return v;
}

export async function createSumUpCheckout(input: {
  reference: string;
  amount_cents: number;
  currency?: string;
  description?: string;
  return_url?: string;
  /**
   * Browser return URL. SumUp only marks alternative payment methods
   * (Apple Pay / Google Pay) as eligible for a checkout when this is present,
   * so omitting it silently downgrades the widget to card-only.
   */
  redirect_url?: string;
  customer_email?: string;
}): Promise<SumUpCheckout> {
  const apiKey = requireEnv("SUMUP_API_KEY");
  const merchantCode = requireEnv("SUMUP_MERCHANT_CODE");

  const res = await fetch(`${BASE}/v0.1/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      checkout_reference: input.reference,
      amount: Number((input.amount_cents / 100).toFixed(2)),
      currency: input.currency ?? "GBP",
      merchant_code: merchantCode,
      description: input.description,
      return_url: input.return_url,
      redirect_url: input.redirect_url,
      pay_to_email: input.customer_email,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SumUp checkout create failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as SumUpCheckout;
}

export async function getSumUpCheckout(id: string): Promise<SumUpCheckout> {
  const apiKey = requireEnv("SUMUP_API_KEY");
  const res = await fetch(`${BASE}/v0.1/checkouts/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`SumUp checkout fetch failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as SumUpCheckout;
}

/**
 * Refunds a SumUp transaction, fully or partially.
 * Omit `amount_cents` for a full refund.
 */
export async function refundSumUpTransaction(
  transactionId: string,
  amount_cents?: number,
): Promise<void> {
  const apiKey = requireEnv("SUMUP_API_KEY");
  const res = await fetch(`${BASE}/v0.1/me/refund/${transactionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(
      amount_cents ? { amount: Number((amount_cents / 100).toFixed(2)) } : {},
    ),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`SumUp refund failed [${res.status}]: ${await res.text()}`);
  }
}