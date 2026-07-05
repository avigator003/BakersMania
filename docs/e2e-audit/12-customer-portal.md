# Customer Portal

Scope:
- Customer login, product ordering, order history, delivery/payment confirmation, billing, profile.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| CPOR-001 | Customer login | Login with customer phone + `123456`. | Customer shell opens. | DONE | Run 20260705170235: customer workspace login +919700170235 |
| CPOR-002 | Product list | Open customer shop. | Active products load. | DONE | Run 20260705170235: customer product list ok |
| CPOR-003 | Portal order create | Add product to cart and place order. | Order appears for customer and bakery. | DONE | Run 20260705170235: cmr81jikc002a5vzhh986m7da |
| CPOR-004 | Order history | Open customer orders. | Own orders only are shown. | DONE | Run 20260705170235: own orders only |
| CPOR-005 | Mark delivered | Customer marks delivered. | Same order is completed in bakery/vehicle views. | DONE | Run 20260705170235: customer delivered confirmation |
| CPOR-006 | Multiple partial payments | Customer records more than one partial/advance payment. | Payment rows are saved and due decreases after each payment. | DONE | Run 20260705170235: 2 customer partial payment rows saved |
| CPOR-007 | Full payment | Customer marks full payment. | Due becomes zero and paid status appears. | DONE | Run 20260705170235: customer full payment |
| CPOR-008 | Billing page | Open billing. | Paid/due/invoice rows match order history. | DONE | Run 20260705170235: billing route and ledger ok |
| CPOR-009 | Profile update | Update address/phone/city. | Profile persists and route/credit info remains read-only. | DONE | Run 20260705170235: profile update persisted |
| CPOR-010 | Access isolation | Try another customer/order id through API if available. | API rejects. | DONE | Run 20260705170235: other customer order rejected |
