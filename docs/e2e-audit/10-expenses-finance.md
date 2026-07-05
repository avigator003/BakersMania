# Expenses And Finance

Scope:
- Expenses, recurring expenses, route expenses, status transitions.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| EX-001 | Misc expense create | Create miscellaneous expense. | Expense appears with pending/paid status. | DONE | Run 20260705090324: cmr7kdb1y00le11m5lw53oqqs |
| EX-002 | Rent expense create | Create rent expense. | Expense type/category display correctly. | DONE | Run 20260705090324: rent expense saved |
| EX-003 | Route expense | Create expense linked to route. | Route shown on expense row. | DONE | Run 20260705090324: route expense saved |
| EX-004 | Recurring expense | Create recurring expense with period. | Recurring flags/period persist. | DONE | Run 20260705090324: recurring expense saved |
| EX-005 | Expense status paid | Mark expense paid. | Status updates and persists. | DONE | Run 20260705090324: expense paid |
| EX-006 | Expense status canceled | Mark expense canceled. | Status updates and reporting excludes/includes as expected. | DONE | Run 20260705090324: expense canceled |
