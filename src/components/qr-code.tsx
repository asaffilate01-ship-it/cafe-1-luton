import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renders a QR code as an <img>. Generated in the browser — nothing leaves the device. */
export function QrCode({
  value,
  size = 240,
  dark = "#111111",
  light = "#ffffff",
  className,
  alt = "QR code",
}: {
  value: string;
  size?: number;
  dark?: string;
  light?: string;
  className?: string;
  alt?: string;
}) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: "M", color: { dark, light } })
      .then((url) => { if (live) setSrc(url); })
      .catch(() => { if (live) setSrc(""); });
    return () => { live = false; };
  }, [value, size, dark, light]);

  if (!src) return <div style={{ width: size, height: size }} className={`animate-pulse rounded-xl bg-black/10 ${className ?? ""}`} />;
  return <img src={src} width={size} height={size} alt={alt} className={className} />;
}
