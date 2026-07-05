# E2E Audit Run - 20260705083217

Environment:
- API: `http://localhost:4000`
- Web: `http://localhost:3000`
- Tenant: `star-bakery`
- Mode: non-destructive API and route-render audit using timestamped data
- Runner: `node scripts/e2e-audit.mjs`

Summary:
- Automated scenarios: 40
- DONE: 40
- FAILED: 0
- BLOCKED: 0

Generated audit actors:
- Bakery owner: `owner@starbakery.local`
- Customer phone: `+919700083217`
- Customer password: `123456`
- Vehicle phone: `+919800083217`
- Vehicle password: `123456`

Key generated records:
- Category: `cmr7j97bd002n11m5ld21u500`
- Product: `cmr7j97bi002p11m5uf4ynj58`
- Vehicle: `cmr7j97jw002s11m5y9c3n9x9`
- Route: `cmr7j97jz002u11m502nggjfh`
- Customer: `cmr7j97ry002x11m5v4ky9xdn`
- Order: `cmr7j988b003411m5si3gnmbp`
- Labour: `cmr7j989v003g11m56o1u8co0`
- Inventory item: `cmr7j98a3003m11m5wr3bm3oy`
- Supplier: `cmr7j98ae003r11m5pqxerf29`
- Purchase: `cmr7j98ah003u11m5p9p9sydr`
- Expense: `cmr7j98aw004311m5e07bzm7g`

Passed IDs:
- SYS-001, SYS-002
- PA-001, PA-002, PA-005, PA-006
- AU-001, AU-002, AU-003
- BD-001
- CP-001, CP-003, CP-005
- RV-001, RV-004
- CU-002, CU-003
- OR-001, OR-008, OR-009
- VW-003, VW-004, VW-009
- CPOR-004, CPOR-005, CPOR-006, CPOR-007, CPOR-009
- LB-001, LB-003, LB-005
- IN-001, IN-002, IN-005
- SP-001, SP-003, SP-005
- EX-001, EX-005
- RB-002

Runner fixes made during audit:
- Product stock adjustment returns `200`, not `201`; runner now accepts both.
- Bakery reports endpoint is `/reports/dashboard`, not `/reports/overview`.

Untested by this automated run:
- Full browser click flows and visual layout verification.
- Cleanup/reset workflow.
- Several negative/edge scenarios in module design files.
