# Platform Admin

Scope:
- Platform login, tenant visibility, onboarding, subscription/billing admin, reports navigation.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| PA-001 | Platform admin login | Login as platform admin. Open `/admin`. | Admin shell loads and rejects non-admin actors. | DONE | Run 20260705090324: platform admin login admin@bakersmania.local |
| PA-002 | Tenant list loads | Open `/admin/tenants`. | Star Bakery appears with status/subscription data. | DONE | Run 20260705090324: tenant star-bakery |
| PA-003 | Tenant create/onboard form validation | Submit missing required fields, then valid tenant data in a disposable test if needed. | Invalid submit shows validation; valid submit creates tenant + owner + subscription. | DONE | Run 20260705090324: invalid tenant payload rejected |
| PA-004 | Tenant billing details edit | Update billing status/amount/recurrence for test tenant. | Billing row updates and persists after refresh. | DONE | Run 20260705090324: cmr7kd7bb00h211m5a06d3ifj |
| PA-005 | Billing payment marking | Open `/admin/billing`, mark payment period and amount. | Next due date/payment fields update correctly. | DONE | Run 20260705090324: billing payment/status updated |
| PA-006 | Platform reports route | Open `/admin/reports`. | Reports surface renders without auth/API errors. | DONE | Run 20260705090324: reports endpoint and page render |
| PA-007 | Cross-role rejection | Try admin route as bakery/customer/vehicle token. | Access denied and redirected to login. | DONE | Run 20260705090324: owner denied admin API |

Notes:
- Do not create/delete production tenants without explicit confirmation.
