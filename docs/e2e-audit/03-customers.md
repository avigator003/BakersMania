# Customers

Scope:
- Bakery customer CRM plus customer credential creation.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| CU-001 | List customers | Open `/star-bakery/bakery/customers`. | Customer list/table loads. | DONE | Run 20260705170235: customer list and page render |
| CU-002 | Create customer credentials | Create customer with phone, route, address, credit limit. | Customer created and linked portal user can login with phone + `123456`. | DONE | Run 20260705170235: cmr81i46f000b5vzh296w90im |
| CU-003 | Missing phone validation | Attempt customer create without phone. | API/UI rejects because portal credentials need phone. | DONE | Run 20260705170235: missing phone rejected |
| CU-004 | Edit customer | Update city/state/address/credit limit/route. | Changes persist after refresh. | FAILED | Run 20260705170235: PATCH /t/star-bakery/customers/cmr81i46f000b5vzh296w90im -> 422: {"error":"Customer phone number is required f |
| CU-005 | Customer search | Search by name, phone, city, route, Aadhaar. | Relevant customer appears; unrelated hidden. | DONE | Run 20260705170235: phone search finds customer |
| CU-006 | Customer ledger | Open ledger for customer with orders/payments. | Order/payment entries, balance, credit limit display correctly. | DONE | Run 20260705170235: ledger includes order |
| CU-007 | Customer route assignment impact | Change customer route, create order. | New order inherits updated route. | FAILED | Run 20260705170235: PATCH /t/star-bakery/customers/cmr81i46f000b5vzh296w90im -> 422: {"error":"Customer phone number is required f |
| CU-008 | Customer-specific price visibility | Assign customer product price. | Ledger/product price surfaces reflect custom price. | DONE | Run 20260705170235: custom price verified by order pricing path |
