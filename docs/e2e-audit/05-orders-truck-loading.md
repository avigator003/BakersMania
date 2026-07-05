# Orders And Truck Loading

Scope:
- Bakery order creation/editing, repeat orders, status/payment, invoices, route statements, truck loading.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| OR-001 | Create staff order | Create order for customer/product/date. | Order appears with route from customer and calculated totals. | DONE | Run 20260705170235: cmr81iero000n5vzhm8degtab |
| OR-002 | Edit order | Change quantity/product/date. | Totals and truck loading update. | DONE | Run 20260705170235: order edit persisted |
| OR-003 | Order status update | Move order through accepted/dispatched/completed. | Status persists and filters update. | DONE | Run 20260705170235: accepted/dispatched/completed |
| OR-004 | Multiple partial payments | Record two partial payments on the same order. | Both payment rows are saved, status stays partial, due decreases. | DONE | Run 20260705170235: 2 partial payment rows saved |
| OR-005 | Full payment | Mark full payment. | Due becomes zero, status paid. | DONE | Run 20260705170235: full payment saved |
| OR-006 | Prevent invalid unpaid | Try unpaid after payment exists. | API rejects. | DONE | Run 20260705170235: unpaid after payment rejected |
| OR-007 | Invoice export/create | Generate invoice from order. | Invoice number and export data created. | DONE | Run 20260705170235: INV-00001 |
| OR-008 | Route statement export | Export route statement for date/range. | CSV contains route/customer/order totals. | DONE | Run 20260705170235: route statement ok |
| OR-009 | Truck loading sheet | Open truck tab for date/category. | Route/product quantity matrix matches orders. | DONE | Run 20260705170235: truck loading matrix ok |
| OR-010 | Repeat orders | Repeat previous date orders to target date. | New orders copied with target due date. | DONE | Run 20260705170235: repeat orders created |
