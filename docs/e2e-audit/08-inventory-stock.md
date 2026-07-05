# Inventory And Stock

Scope:
- Raw material inventory, ledger BUY/USE, product stock adjustments.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| IN-001 | Inventory item create | Add raw material item with unit, stock, reorder, unit price. | Item appears with stock. | DONE | Run 20260705170235: cmr81k1uq00375vzh7664uwza |
| IN-002 | Buy ledger | Add BUY ledger quantity. | Stock increases and ledger row appears. | DONE | Run 20260705170235: buy ledger saved |
| IN-003 | Use ledger | Add USE ledger quantity. | Stock decreases and ledger row appears. | DONE | Run 20260705170235: use ledger saved |
| IN-004 | Prevent invalid ledger | Submit missing item or nonpositive quantity. | Validation rejects. | DONE | Run 20260705170235: invalid ledger rejected |
| IN-005 | Product stock ADD | Add stock to finished product. | Product stock increases. | DONE | Run 20260705170235: product stock add |
| IN-006 | Product stock SET | Set stock to exact value. | Product stock equals requested value. | DONE | Run 20260705170235: product stock set |
| IN-007 | Reorder visibility | Item below reorder threshold. | Low/reorder signal appears where applicable. | DONE | Run 20260705170235: below reorder item visible |
