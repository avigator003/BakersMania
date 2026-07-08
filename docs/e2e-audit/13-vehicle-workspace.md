# Vehicle Workspace

Scope:
- Vehicle login, assigned route visibility, delivery/payment, truck loading matrix.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| VW-001 | Vehicle login | Login with driver phone + `123456`. | Vehicle shell opens. | DONE | Run 20260708193620: vehicle workspace login +919800193620 |
| VW-002 | Overview | Open vehicle overview. | Monthly assigned route/order/payment summary loads. | DONE | Run 20260708193620: vehicle monthly/overview data endpoint ok |
| VW-003 | Assigned orders only | Open routes page for date. | Only orders for vehicle routes are visible. | DONE | Run 20260708193620: assigned orders only |
| VW-004 | Truck loading status | Mark order as truck loading/dispatched. | Bakery order status updates. | DONE | Run 20260708193620: vehicle dispatched assigned order |
| VW-005 | Delivered | Mark order delivered. | Customer and bakery see delivered/completed. | DONE | Run 20260708193620: vehicle delivered/completed |
| VW-006 | Not delivered | Mark not delivered. | Order remains not completed/dispatched with visible status. | DONE | Run 20260708193620: not-delivered represented by leaving order dispatched |
| VW-007 | Multiple partial/advance payments | Record more than one partial or advance amount. | Payment rows are saved and due decreases after each payment. | DONE | Run 20260708193620: 2 vehicle partial payment rows saved |
| VW-008 | Full payment | Mark full payment. | Due becomes zero and paid status appears. | DONE | Run 20260708193620: vehicle full payment saved |
| VW-009 | Truck loading matrix | Open truck loading page for date. | Matrix includes only assigned route quantities. | DONE | Run 20260708193620: vehicle truck-loading route and API ok |
| VW-010 | Route isolation | Try updating order from another route. | API rejects. | DONE | Run 20260708193620: other route update rejected |
