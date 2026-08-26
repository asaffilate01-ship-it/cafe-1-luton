# Café 1 mobile POS, KDS and branch login setup

## Branches

The till and KDS use the same routes for both cafés:

- Till: `/till`
- Kitchen display: `/kds`

The signed-in account decides which branch is opened. Staff do not choose a
branch at login and cannot change it afterwards.

## First-time setup

1. Sign in as an administrator.
2. Open **Admin → Sites & legal entities**.
3. Confirm that these two active sites exist:
   - Luton Crown Court — postcode `LU1 2AA`
   - Café 1 Futures House — code `FUTURES_HOUSE`, postcode `LU3 3QB`
4. If Futures House is missing, use **Add Futures House till + KDS**, review the
   pre-filled details, and save it.
5. Open **Admin → Users & roles**.
6. Grant each person the **staff** role and choose exactly one staff branch.
7. The staff member signs out and back in so the new branch assignment is added
   to their secure session.

## Access rules

- Crown Court staff can open only the Crown Court till and Crown Court KDS.
- Futures House staff can open only the Futures House till and Futures House KDS.
- Administrators can use the branch switcher and access both.
- An unassigned staff account is stopped at a “Branch assignment required”
  screen.
- Branch checks are enforced by server functions for KDS reads, till shifts,
  sales, cancellations, refunds, order edits and kitchen status changes.

## Online order routing

The branch selected by the customer is saved as the order's `site_id`. The KDS
feed reads only that site, so the order appears on the selected branch's kitchen
screen with:

- ASAP or the requested later time
- dine-in or takeaway
- customer name
- order items and quantities
- item modifications
- order notes

If a selected branch has not been configured as an active site, checkout stops
with a configuration message. It does not send the order to the other café.

## Branch-specific behaviour

- Crown Court retains Jury, Judges and Public hand-off choices, house tabs and
  marketplace watcher indicators.
- Futures House uses its own till shift and simplified Public/Web KDS feeds,
  without court or marketplace controls.
