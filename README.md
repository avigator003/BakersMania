# BakersMania — Scalable CRM for Bakeries and Food Businesses

This repository is being re-scoped from a single-bakery operations tool into a fresh, scalable SaaS product: BakersMania. The goal is to build a generic CRM platform for bakeries, cafes, dessert shops, and other food businesses that can be sold as a subscription service.

## Why this shift matters
The original system was highly specialized around one bakery workflow. That made it useful for a specific operation, but not flexible enough to become a product that can serve many businesses.

BakersMania will instead focus on a reusable, multi-tenant foundation that supports:
- many independent business accounts
- configurable workflows per business
- recurring subscription billing
- role-based access for staff and managers
- scalable reporting and automation

## Product vision
BakersMania should become a modern CRM and operations platform for food businesses that need to manage:
- customers and leads
- orders and invoices
- products, pricing, and catalogs
- inventory and purchasing
- staff and roles
- subscriptions and billing

The product should be simple enough for a small bakery to adopt quickly, while powerful enough to scale into a larger multi-location operation.

## Core product pillars
1. Multi-tenant SaaS platform
   - each business gets its own workspace
   - isolated data and permissions
   - tenant-level settings and onboarding

2. Customer and sales CRM
   - lead capture and customer profiles
   - order history and follow-up tracking
   - quotes, invoices, and payment visibility

3. Operations management
   - product catalog and pricing rules
   - inventory stock and reorder alerts
   - production planning and supplier purchasing

4. Bakery and food-business operations foundation
   - order creation with pricing rules and due tracking
   - route-based or delivery-based sales workflows
   - stock updates tied to completed orders
   - raw material purchasing, usage, and history tracking
   - labour attendance, salary, and payment tracking
   - expense, rent, supplier, and vehicle management
   - invoice generation and export reports for dispatch planning

5. Team and admin control
   - staff roles and approvals
   - audit logs and activity history
   - configurable dashboards for owners and managers

6. Subscription and growth
   - free trial and paid plans
   - Stripe-based billing
   - usage-based or tiered plan controls

## Implemented technical direction
- Frontend/PWA: Next.js, TypeScript, Tailwind CSS, TanStack Query, mobile-first responsive screens.
- Backend: plain Node.js with Express and TypeScript, organized by routes, middleware, validation, and domain modules.
- Database: PostgreSQL with Prisma schema and generated Prisma Client.
- Cache and queues: Redis/BullMQ planned in the API dependency set for PDFs, exports, reminders, reports, and billing sync.
- File storage: S3-compatible object storage planned for invoice PDFs, exports, logos, and attachments.
- Payments: Stripe foundation planned through billing module and subscription models.
- Deployment: Vercel for frontend/PWA, Render or Railway for API, Neon/Supabase for Postgres, Upstash/Render Redis.

## MVP scope for launch
The first release should focus on the essentials needed to validate the subscription model:
- tenant signup and workspace creation
- authentication and role-based access
- platform admin onboarding/offboarding and support visibility
- customer management
- customer portal ordering
- product catalog and pricing
- order creation and invoicing
- basic inventory tracking
- suppliers, purchases, expenses, attendance, salary payments, vehicles, and routes
- reporting dashboard
- billing and subscription management

## Workspace layout
- `apps/api` — Express API, Prisma schema, auth/tenant middleware, and domain route modules.
- `apps/web` — Next.js PWA with platform admin, bakery CRM, customer portal, and login surfaces.
- `packages/shared` — shared role, order-source, and subscription constants.

## Local development
1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `JWT_SECRET`.
2. Install dependencies with `npm install`.
3. Generate Prisma Client with `npm run prisma:generate`.
4. Start the API with `npm run dev:api`.
5. Start the PWA with `npm run dev:web`.

Useful checks:
- `npm run typecheck`
- `npm run build`

## Repository purpose
This folder now acts as the product strategy and rebuild blueprint for BakersMania. The docs in this repository should guide the implementation of a scalable CRM foundation rather than a one-off bakery system.

## Documents in this folder
- [PROJECT_FEATURE_INVENTORY.md](PROJECT_FEATURE_INVENTORY.md) — feature inventory for the new generic CRM product.
- [REBUILD_CHECKLIST.md](REBUILD_CHECKLIST.md) — phased implementation roadmap for building BakersMania from scratch.
