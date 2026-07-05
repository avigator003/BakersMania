# Catalog, Products, And Pricing

Scope:
- Categories, products, customer price assignment, price history.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| CP-001 | Category create | Create active category. | Category appears in category list and product form. | DONE | Run 20260705090324: cmr7kd8om00h411m55mgqhg1x |
| CP-002 | Category validation | Submit short/empty category name. | Validation rejects invalid input. | DONE | Run 20260705090324: empty category rejected |
| CP-003 | Product create | Create product with category, price, tax rate. | Product appears active with correct category and price. | DONE | Run 20260705090324: cmr7kd8oz00h611m5byld7gvj |
| CP-004 | Product edit | Update price/category/status. | Changes persist and downstream order price uses current price. | DONE | Run 20260705090324: product update persisted |
| CP-005 | Customer price assign | Assign custom product price to customer. | Customer order uses custom price. | DONE | Run 20260705090324: customer-specific price saved |
| CP-006 | Price history | Change customer price twice. | Price history shows old/new records in order. | DONE | Run 20260705090324: 2 price history rows |
| CP-007 | Product stock display | Adjust stock via inventory. | Product stock shown in product/inventory surfaces. | DONE | Run 20260705090324: product stock visible |
