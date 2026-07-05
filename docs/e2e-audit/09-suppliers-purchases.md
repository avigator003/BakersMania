# Suppliers And Purchases

Scope:
- Supplier creation, raw material purchases, purchase payments.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| SP-001 | Supplier create | Add supplier with phone/email/address. | Supplier appears in list. | DONE | Run 20260705090324: cmr7kdb0s00ko11m5cwktih8t |
| SP-002 | Purchase full paid | Create purchase with FULL payment. | Purchase status paid, inventory updated if item selected. | DONE | Run 20260705090324: full purchase paid |
| SP-003 | Purchase partial paid | Create purchase with PARTIAL payment. | Paid/due/status reflect partial. | DONE | Run 20260705090324: cmr7kdb1900ky11m5au38g7mc |
| SP-004 | Purchase advance | Create purchase with ADVANCE payment. | Advance payment row saved. | DONE | Run 20260705090324: advance purchase saved |
| SP-005 | Additional payment | Add payment to existing purchase. | Purchase paid amount/status recalculates. | DONE | Run 20260705090324: additional payment saved |
| SP-006 | Supplier filtering/detail | Verify supplier purchase/payment rows. | Rows grouped under correct supplier. | DONE | Run 20260705090324: supplier filter ok |
