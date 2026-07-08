# BakersMania E2E Audit

Status values:
- `NOT_RUN`: scenario is designed but not executed yet.
- `DONE`: scenario passed with evidence recorded.
- `FAILED`: scenario failed; defect/evidence must be recorded.
- `BLOCKED`: scenario could not be executed because setup, data, environment, or credentials were unavailable.

Audit rules:
- Test tenant: Star Bakery unless a scenario explicitly says platform-wide.
- Preserve platform admin, tenant row, and owner credentials during cleanup unless the audit owner changes scope.
- Record test date, actor, route, URL/API endpoint, and important IDs under each scenario before marking it `DONE`.
- Do not delete live data without explicit confirmation of local vs live DB.
- When a failure is found, leave the scenario `FAILED` until the fix is verified.

Module files:
- [00-platform-admin.md](./00-platform-admin.md)
- [01-auth-access.md](./01-auth-access.md)
- [02-bakery-dashboard.md](./02-bakery-dashboard.md)
- [03-customers.md](./03-customers.md)
- [04-catalog-products-pricing.md](./04-catalog-products-pricing.md)
- [05-orders-truck-loading.md](./05-orders-truck-loading.md)
- [06-routes-vehicles.md](./06-routes-vehicles.md)
- [07-labour-attendance-payments.md](./07-labour-attendance-payments.md)
- [08-inventory-stock.md](./08-inventory-stock.md)
- [09-suppliers-purchases.md](./09-suppliers-purchases.md)
- [10-expenses-finance.md](./10-expenses-finance.md)
- [11-reports-billing.md](./11-reports-billing.md)
- [12-customer-portal.md](./12-customer-portal.md)
- [13-vehicle-workspace.md](./13-vehicle-workspace.md)

Current run:
- Started: 2026-07-05
- Environment: `local`
- Tenant slug: `star-bakery`
- Cleanup status: `LOCAL_RESET_DONE`
- Latest automated run: [20260708193620-local-star-bakery.md](./runs/20260708193620-local-star-bakery.md)
- Latest automated result: `103 DONE / 0 FAILED / 0 BLOCKED`
- Overall status: `DONE`
