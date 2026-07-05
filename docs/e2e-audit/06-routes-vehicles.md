# Routes And Vehicles

Scope:
- Vehicle onboarding, credentials, route assignment, document fields.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| RV-001 | Vehicle onboard | Create vehicle with number, driver, phone, document dates. | Vehicle appears active. | DONE | Run 20260705170235: cmr81hxmr00065vzh4xgaswe7 |
| RV-002 | Vehicle credentials | Login with driver phone + `123456`. | Vehicle workspace opens. | DONE | Run 20260705170235: vehicle login +919800170235 |
| RV-003 | Vehicle without phone | Try creating vehicle without driver phone. | API/UI rejects because vehicle portal credentials need phone. | NOT_RUN | Pending rerun after scenario expectation update. |
| RV-004 | Route create | Create route assigned to vehicle. | Route appears with vehicle/driver. | DONE | Run 20260705170235: cmr81i0ol00085vzhidcwmhau |
| RV-005 | Route validation | Assign nonexistent vehicle id through API. | API rejects selected vehicle. | DONE | Run 20260705170235: bad vehicle rejected |
| RV-006 | Route/customer/order linkage | Assign customer to route and create order. | Vehicle assigned to route sees that order. | DONE | Run 20260705170235: assigned route order visible |
