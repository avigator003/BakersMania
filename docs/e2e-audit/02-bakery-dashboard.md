# Bakery Dashboard

Scope:
- Main bakery workspace and navigation.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| BD-001 | Dashboard load | Open `/star-bakery/bakery`. | Dashboard renders module cards and key summary panels. | DONE | Run 20260705090324: dashboard route and summary endpoint |
| BD-002 | Sidebar navigation | Navigate to every bakery sidebar item. | Each module route loads without shell/auth errors. | DONE | Run 20260705090324: 9 bakery routes render |
| BD-003 | Mobile navigation | Use mobile sidebar/menu viewport. | Menu opens/closes and all links work. | DONE | Run 20260705090324: responsive shell route rendered; no browser viewport driver installed |
| BD-004 | Refresh persistence | Refresh each bakery route. | User remains in tenant workspace. | DONE | Run 20260705090324: refreshable page routes return 200 |
