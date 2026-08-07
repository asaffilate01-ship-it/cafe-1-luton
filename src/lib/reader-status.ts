/** SumUp reports paired/online devices with these labels; anything else is not payment-ready. */
export function isReaderOnline(status: string | undefined | null): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "paired" || value === "online" || value === "connected" || value === "ready";
}

export function readerStatusLabel(status: string | undefined | null): string {
  const value = (status ?? "").toLowerCase();
  if (isReaderOnline(value)) return "Online";
  if (!value || value === "unknown") return "Checking";
  if (value === "expired") return "Pairing expired";
  return "Offline";
}
