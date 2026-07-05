# Suppliers And Purchases

Scope:
- Supplier creation, raw material purchases, purchase payments.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| SP-001 | Supplier create | Add supplier with phone/email/address. | Supplier appears in list. | DONE | Run 20260705170235: cmr81k6sc003f5vzhuvmm8sa8 |
| SP-002 | Purchase full paid | Create purchase with FULL payment. | Purchase status paid, inventory updated if item selected. | DONE | Run 20260705170235: full purchase paid |
| SP-003 | Purchase partial paid | Create purchase with PARTIAL payment. | Paid/due/status reflect partial. | DONE | Run 20260705170235: cmr81k8lz003p5vzhak67wy4u |
| SP-004 | Purchase advance | Create purchase with ADVANCE payment. | Advance payment row saved. | DONE | Run 20260705170235: advance purchase saved |
| SP-005 | Additional payment | Add payment to existing purchase. | Purchase paid amount/status recalculates. | DONE | Run 20260705170235: additional payment saved |
| SP-006 | Supplier filtering/detail | Verify supplier purchase/payment rows. | Rows grouped under correct supplier. | DONE | Run 20260705170235: supplier filter ok |
