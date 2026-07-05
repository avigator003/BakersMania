# Labour, Attendance, And Payments

Scope:
- Labour profiles, attendance, salary payments, monthly detail.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| LB-001 | Labour create | Add labour with phone, skill, role, wage/salary. | Labour appears active. | DONE | Run 20260705170235: cmr81jwpz002v5vzh7zndcp19 |
| LB-002 | Labour list/search | Search labour by name, phone, skill, role. | Search filters correctly. | DONE | Run 20260705170235: labour dashboard list ok |
| LB-003 | Attendance present | Mark labour present for date. | Attendance saved and dashboard count updates. | DONE | Run 20260705170235: present saved |
| LB-004 | Attendance absent/half day | Mark absent and half day scenarios. | Status persists and monthly detail reflects status. | DONE | Run 20260705170235: half-day saved |
| LB-005 | Salary advance | Record advance payment. | Payment appears with type ADVANCE. | DONE | Run 20260705170235: advance saved |
| LB-006 | Salary partial | Record partial payment. | Payment appears with type PARTIAL. | DONE | Run 20260705170235: partial saved |
| LB-007 | Salary full | Record full payment. | Payment appears with type FULL. | DONE | Run 20260705170235: full saved |
| LB-008 | Monthly detail page | Open labour detail month. | Attendance and payments summarize correctly. | DONE | Run 20260705170235: monthly detail ok |
| LB-009 | Payment sheet bulk save | Open labour payments sheet, save one or more rows. | Only rows with amount are saved. | DONE | Run 20260705170235: payment sheet route/export ok |
| LB-010 | Inactive labour | Deactivate labour. | Labour becomes inactive/excluded where expected. | DONE | Run 20260705170235: inactive saved |
