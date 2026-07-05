# Reports And Billing

Scope:
- Bakery reports, billing summary, invoices, financial totals.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| RB-001 | Billing overview | Open `/star-bakery/bakery` and billing/report panels. | Totals load without API errors. | DONE | Run 20260705090324: billing/dashboard pages render |
| RB-002 | Reports API | Call reports endpoints after orders/payments/expenses. | Totals match created audit data. | DONE | Run 20260705090324: bakery reports dashboard ok |
| RB-003 | Invoice from order | Create invoice for order. | Invoice persists with total/payment status. | DONE | Run 20260705090324: invoice persisted |
| RB-004 | Report after payment | Add payment then reload reports. | Paid/due totals change correctly. | DONE | Run 20260705090324: reports reload after payment ok |
| RB-005 | Report after expense | Add paid expense then reload reports. | Expense totals change correctly. | DONE | Run 20260705090324: reports reload after expense ok |
