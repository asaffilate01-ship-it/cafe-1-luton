# Attendance QR — privacy note for HMCTS sign-off

**Controller:** Café 1 Luton (Café 1), LU1 2AA — info@cafe1luton.co.uk
**Scheme:** HMCTS Juror Voucher Scheme, Luton Crown Court
**System:** cafe1luton.co.uk (Café 1 ordering platform)
**Document status:** issued for HMCTS Jury Office / HMCTS privacy sign-off

## 1. Purpose

The attendance QR proves that a juror who redeems a voucher online is physically in the
jury assembly area on the day of redemption. Without it, an activated Juror ID could be
used away from court. It exists solely to prevent misuse of publicly funded refreshment
allowance.

## 2. What is processed

| Data | Held by Café 1 | Notes |
| --- | --- | --- |
| Juror ID issued by the Jury Office | Yes | Pseudonymous reference supplied by HMCTS. No name, address, contact details, case or trial data is ever requested or stored. |
| One-time attendance token | Hash only | 192 bits of randomness, stored as a SHA-256 hash, valid 90 seconds, single use. |
| Approved room / location reference | Yes | Non-personal. |
| Redemption record | Yes | Date, time, voucher code, receipt number, amount. |
| Juror name, email, phone, case details | **No** | Never collected. Not present in any table, log, email or report. |

Café 1 cannot re-identify a juror from any record it holds. Only HMCTS holds the mapping
between a Juror ID and a person.

## 3. How the QR works

1. Court/Café 1 staff generate a QR in the staff console. The QR carries a random token only.
2. The juror scans it and enters their Juror ID and 6-digit PIN.
3. The token is verified against its stored hash, then consumed. It expires after 90 seconds
   and cannot be reused or replayed.
4. Only after that verification can a voucher be redeemed online for that day.

Public verification is rate limited; the consume operation is service-role only; every
generation and consumption appends an audit event containing no personal data.

## 4. Lawful basis and roles

- Café 1 processes pseudonymous scheme data to perform the refreshment contract with HMCTS
  and in Café 1's and HMCTS's legitimate interests in preventing misuse of public funds
  (UK GDPR Art. 6(1)(b) and 6(1)(f)).
- HMCTS remains controller of juror identity. Café 1 is controller only of the pseudonymous
  redemption and attendance records it creates.
- No special category data is processed. No profiling or automated decision-making with legal
  effect takes place. No data is transferred outside the UK/EEA by the scheme.

## 5. Retention

| Record | Retention |
| --- | --- |
| Attendance token hashes | Consumed/expired within 90 seconds; rows purged with routine housekeeping |
| Voucher activation and redemption records | 7 years (financial/claim evidence) |
| Daily HMCTS claim reports (CSV/email) | 7 years |
| Audit events | 7 years |

## 6. Security

Encryption in transit and at rest; role-based access with row-level security; manager
actions require multi-factor (AAL2) authentication; PINs stored as one-way hashes and shown
once; least-privilege service credentials; incident and rollback owners named in
`docs/PRODUCTION_RUNBOOK.md`.

## 7. Reporting to HMCTS

A nightly automated job emails Café 1 the day's claim summary (voucher code, receipt number,
time and amount) with a CSV attachment for the HMCTS claim. It contains paid orders only and
no juror-identifying data.

## 8. Sign-off

| Role | Name | Organisation | Signature | Date |
| --- | --- | --- | --- | --- |
| Jury Office manager |  | HMCTS |  |  |
| Privacy / DPO reviewer |  | HMCTS |  |  |
| Café 1 owner |  | Café 1 Luton |  |  |

Attendance QR functionality must not be enabled for live juror use until this page is signed
and the completed copy is attached to the `legal_hmcts_retention` operational acceptance gate
via `npm run record:gate`.
