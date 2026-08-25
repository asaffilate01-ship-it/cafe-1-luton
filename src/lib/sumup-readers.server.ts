// Server-only helpers for SumUp physical card readers (Solo / Solo Lite).
// Uses the SumUp Readers API so the till can push a payment straight to the device.
const BASE = "https://api.sumup.com/v0.1";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Add it in Cloud secrets to use the SumUp reader.`);
  return v;
}

export type SumUpReader = {
  id: string;
  name: string;
  status: string;
  device?: { identifier?: string; model?: string };
  created_at?: string;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env("SUMUP_API_KEY")}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SumUp reader call failed [${res.status}]: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function merchantPath(suffix = ""): string {
  return `/merchants/${env("SUMUP_MERCHANT_CODE")}/readers${suffix}`;
}

export async function listReaders(): Promise<SumUpReader[]> {
  const out = await call<{ items?: SumUpReader[] } | SumUpReader[]>(merchantPath());
  return Array.isArray(out) ? out : (out?.items ?? []);
}

export async function pairReader(pairing_code: string, name: string): Promise<SumUpReader> {
  return call<SumUpReader>(merchantPath(), {
    method: "POST",
    body: JSON.stringify({ pairing_code: pairing_code.trim().toUpperCase(), name }),
  });
}

export async function unpairReader(readerId: string): Promise<void> {
  await call<void>(merchantPath(`/${readerId}`), { method: "DELETE" });
}

/** Sends an amount to the reader's screen. Returns SumUp's client transaction id. */
export async function readerCheckout(input: {
  readerId: string;
  amount_cents: number;
  description?: string;
  reference?: string;
}): Promise<{ client_transaction_id: string }> {
  const affiliateKey = process.env["SUMUP_AFFILIATE_KEY"];
  // Cloud API pushes the final transaction result here in real time.
  const siteUrl = process.env["PUBLIC_SITE_URL"] ?? "https://cafe1luton.co.uk";
  const returnUrl = `${siteUrl.replace(/\/$/, "")}/api/public/sumup-reader-webhook`;
  const out = await call<{ data?: { client_transaction_id?: string } }>(
    merchantPath(`/${input.readerId}/checkout`),
    {
      method: "POST",
      body: JSON.stringify({
        total_amount: { value: input.amount_cents, currency: "GBP", minor_unit: 2 },
        description: input.description,
        return_url: returnUrl,
        ...(affiliateKey
          ? {
              affiliate: {
                key: affiliateKey,
                app_id: "cafe1-till",
                foreign_transaction_id: input.reference ?? crypto.randomUUID(),
              },
            }
          : {}),
      }),
    },
  );
  const id = out?.data?.client_transaction_id;
  if (!id) throw new Error("SumUp did not return a transaction id for that reader payment");
  return { client_transaction_id: id };
}

export async function terminateReaderCheckout(readerId: string): Promise<void> {
  await call<void>(merchantPath(`/${readerId}/terminate`), { method: "POST" });
}

export type ReaderTxn = {
  id?: string;
  transaction_code?: string;
  status?: string;
  amount?: number;
  currency?: string;
};

/** Polls the transaction created by a reader checkout. */
export async function getReaderTransaction(clientTransactionId: string): Promise<ReaderTxn | null> {
  try {
    const result = await call<ReaderTxn | { items?: ReaderTxn[] } | ReaderTxn[]>(
      `/me/transactions?client_transaction_id=${encodeURIComponent(clientTransactionId)}`,
    );
    if (Array.isArray(result)) return result[0] ?? null;
    if ("items" in result) return result.items?.[0] ?? null;
    return result as ReaderTxn;
  } catch {
    return null;
  }
}
