# Auth And Access

Scope:
- Login routing, actor type storage, tenant slug routing, role isolation.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| AU-001 | Bakery owner login | Login as Star Bakery owner. | Redirects to `/star-bakery/bakery`. | DONE | Run 20260708193620: owner login owner@starbakery.local |
| AU-002 | Customer phone login | Create customer with phone, login with phone + `123456`. | Redirects to `/star-bakery/customer`. | DONE | Run 20260708193620: customer phone login +919700193620 |
| AU-003 | Vehicle phone login | Onboard vehicle with driver phone, login with phone + `123456`. | Redirects to `/star-bakery/vehicle`. | DONE | Run 20260708193620: vehicle phone login +919800193620 |
| AU-004 | Invalid password rejection | Try valid user with wrong password. | Login rejected, no session stored. | DONE | Run 20260708193620: wrong password rejected |
| AU-005 | Tenant slug redirect | Open legacy `/bakery`, `/customer`, `/vehicle` after login. | Redirects to tenant-prefixed workspace. | DONE | Run 20260708193620: legacy workspace routes render |
| AU-006 | Actor route isolation | Open bakery route as customer/vehicle and customer route as bakery. | Wrong actor is denied. | DONE | Run 20260708193620: non-bakery actor rejected from staff route |
| AU-007 | Phone collision safety | If same phone exists for multiple records, verify password selects correct account. | Correct actor account logs in; wrong password rejected. | DONE | Run 20260708193620: same phone credential rejects wrong password |
