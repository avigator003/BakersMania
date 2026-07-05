# Routes And Vehicles

Scope:
- Vehicle onboarding, credentials, route assignment, document fields.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| RV-001 | Vehicle onboard | Create vehicle with number, driver, phone, document dates. | Vehicle appears active. | DONE | Run 20260705090324: cmr7kd8x600h911m5iljr46fr |
| RV-002 | Vehicle credentials | Login with driver phone + `123456`. | Vehicle workspace opens. | DONE | Run 20260705090324: vehicle login +919800090324 |
| RV-003 | Vehicle without phone | Try creating vehicle without driver phone. | Vehicle saves but no login user is expected, or validation decision is recorded. | DONE | Run 20260705090324: vehicle without phone saved without credentials |
| RV-004 | Route create | Create route assigned to vehicle. | Route appears with vehicle/driver. | DONE | Run 20260705090324: cmr7kd95g00hd11m5j7wky4tq |
| RV-005 | Route validation | Assign nonexistent vehicle id through API. | API rejects selected vehicle. | DONE | Run 20260705090324: bad vehicle rejected |
| RV-006 | Route/customer/order linkage | Assign customer to route and create order. | Vehicle assigned to route sees that order. | DONE | Run 20260705090324: assigned route order visible |
