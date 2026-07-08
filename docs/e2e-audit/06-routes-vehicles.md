# Routes And Vehicles

Scope:
- Vehicle onboarding, credentials, route assignment, document fields.

Scenarios:

| ID | Scenario | Steps | Expected | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| RV-001 | Vehicle onboard | Create vehicle with number, driver, phone, document dates. | Vehicle appears active. | DONE | Run 20260708193620: cmrchbef00006yrc5e4h4s1h0 |
| RV-002 | Vehicle credentials | Login with driver phone + `123456`. | Vehicle workspace opens. | DONE | Run 20260708193620: vehicle login +919800193620 |
| RV-003 | Vehicle without phone | Try creating vehicle without driver phone. | API/UI rejects because vehicle portal credentials need phone. | DONE | Run 20260708193620: vehicle without phone rejected because portal credentials require phone |
| RV-004 | Route create | Create route assigned to vehicle. | Route appears with vehicle/driver. | DONE | Run 20260708193620: cmrchbied0008yrc5zps8binx |
| RV-005 | Route validation | Assign nonexistent vehicle id through API. | API rejects selected vehicle. | DONE | Run 20260708193620: bad vehicle rejected |
| RV-006 | Route/customer/order linkage | Assign customer to route and create order. | Vehicle assigned to route sees that order. | DONE | Run 20260708193620: assigned route order visible |
