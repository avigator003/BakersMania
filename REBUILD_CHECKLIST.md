# Rebuild Checklist for BakersMania

## Phase 0 — Product foundation
- Define the tenant model and business ownership structure.
- Document the core user roles: owner, manager, staff, accountant, customer.
- Finalize the MVP feature set for the first paid release.
- Choose the initial subscription model and pricing tiers.

## Phase 1 — Platform foundation
- [x] Set up a monorepo for frontend and backend services.
- [x] Create the Express API foundation with tenant-aware auth surfaces.
- [x] Design the Prisma database schema for multi-tenancy, platform admin, customer portal, and RBAC.
- [x] Add environment configuration, request logging, validation, and error handling.
- [ ] Wire production file storage, background jobs, and observability providers.

## Phase 2 — Core CRM and bakery operations
- [x] Scaffold customer management API and UI surface.
- [x] Scaffold product catalog and pricing API and UI surface.
- [x] Scaffold unified order flow for customer portal and staff-created orders.
- [x] Scaffold invoice generation endpoint and payment status model.
- [x] Scaffold route/delivery, inventory, suppliers, finance, staff, and report modules.
- [ ] Implement production-ready stock consumption tied to completed orders.
- [ ] Implement PDF invoice generation and dispatch exports.
- [ ] Replace dashboard sample data with live API integration.

## Phase 3 — Operations and inventory
- Add inventory management and stock adjustments.
- Create supplier and purchase-order workflows.
- Add expense and bill tracking.
- Support basic production planning and batch records.

## Phase 4 — Team and reporting
- Build dashboards for owners and managers.
- Add role-based permissions and approval flows.
- Create reporting for sales, inventory, and payments.
- Support data export and activity history.

## Phase 5 — Subscription and growth
- Build manual controls for trial, recurring billing, and plan upgrades.
- Add billing history and plan limits.
- Create admin tools for tenant management and support.
- Prepare onboarding flows for new businesses.

## Phase 6 — Quality and launch readiness
- Add automated tests for core workflows.
- Add security hardening and rate limiting.
- Validate tenant isolation and backup strategy.
- Prepare documentation, support processes, and launch checklist.
