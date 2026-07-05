# Graph Report - BakersMania  (2026-07-05)

## Corpus Check
- 199 files · ~71,724 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 861 nodes · 1543 edges · 62 communities (52 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d2ff9a83`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_3. Platform modules|3. Platform modules]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_shell.tsx|shell.tsx]]
- [[_COMMUNITY_staff.routes.ts|staff.routes.ts]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_orders.routes.ts|orders.routes.ts]]
- [[_COMMUNITY_platform-admin.routes.ts|platform-admin.routes.ts]]
- [[_COMMUNITY_useToast|useToast]]
- [[_COMMUNITY_catalog.routes.ts|catalog.routes.ts]]
- [[_COMMUNITY_inventory.routes.ts|inventory.routes.ts]]
- [[_COMMUNITY_http.ts|http.ts]]
- [[_COMMUNITY_suppliers.routes.ts|suppliers.routes.ts]]
- [[_COMMUNITY_prisma.ts|prisma.ts]]
- [[_COMMUNITY_finance.routes.ts|finance.routes.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_app.ts|app.ts]]
- [[_COMMUNITY_routes.routes.ts|routes.routes.ts]]
- [[_COMMUNITY_customers.routes.ts|customers.routes.ts]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_orders.routes.ts|orders.routes.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_HttpError|HttpError]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_layout.tsx|layout.tsx]]
- [[_COMMUNITY_tenants.service.ts|tenants.service.ts]]
- [[_COMMUNITY_toast-provider.tsx|toast-provider.tsx]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_seed.ts|seed.ts]]
- [[_COMMUNITY_express.d.ts|express.d.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_next.config.mjs|next.config.mjs]]
- [[_COMMUNITY_sw.js|sw.js]]
- [[_COMMUNITY_tailwind.config.ts|tailwind.config.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_auth.routes.ts|auth.routes.ts]]
- [[_COMMUNITY_e2e-audit.mjs|e2e-audit.mjs]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_finance.repository.ts|finance.repository.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_AsyncHandler|AsyncHandler]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_finance.routes.ts|finance.routes.ts]]
- [[_COMMUNITY_20260705085048-local-star-bakery|20260705085048-local-star-bakery.md]]

## God Nodes (most connected - your core abstractions)
1. `useToast()` - 47 edges
2. `getStoredTenantSlug()` - 45 edges
3. `authFetch()` - 29 edges
4. `AppShell()` - 28 edges
5. `HttpError` - 18 edges
6. `prisma` - 16 edges
7. `AsyncHandler` - 15 edges
8. `requireAuth()` - 14 edges
9. `Modal()` - 14 edges
10. `paymentTotal()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `PhotoPicker()` --references--> `url`  [EXTRACTED]
  apps/web/components/photo-picker.tsx → scripts/reset-e2e-data.mjs
- `main()` --references--> `@prisma/client`  [EXTRACTED]
  scripts/reset-e2e-data.mjs → apps/api/package.json
- `RawMaterialSellersPage()` --indirect_call--> `due()`  [INFERRED]
  apps/web/app/bakery/inventory/sellers/page.tsx → apps/web/app/customer/orders/page.tsx
- `downloadFile()` --references--> `url`  [EXTRACTED]
  apps/web/app/bakery/orders/page.tsx → scripts/reset-e2e-data.mjs
- `BakeryOrdersPage()` --indirect_call--> `due()`  [INFERRED]
  apps/web/app/bakery/orders/page.tsx → apps/web/app/customer/orders/page.tsx

## Import Cycles
- None detected.

## Communities (62 total, 10 thin omitted)

### Community 0 - "page.tsx"
Cohesion: 0.06
Nodes (43): AdminBillingPage(), BillingRow, BillingStatus, billingStatusOptions, formatAmount(), formatDate(), formatPeriod(), inclusiveMonthCount() (+35 more)

### Community 1 - "page.tsx"
Cohesion: 0.07
Nodes (41): Attendance, AttendanceStatus, formatAmount(), Labour, LabourAttendancePage(), LabourDashboard, statusClass(), todayInput() (+33 more)

### Community 2 - "dependencies"
Cohesion: 0.05
Nodes (40): dependencies, @bakersmania/shared, bcryptjs, bullmq, cookie-parser, cors, dotenv, express (+32 more)

### Community 3 - "3. Platform modules"
Cohesion: 0.05
Nodes (35): 1. Product overview, 2. Product scope, 3.0 Bakery operations foundation, 3.1 Tenant and account management, 3.2 Authentication and permissions, 3.3 Customer CRM, 3.4 Product and pricing management, 3.5 Orders and invoices (+27 more)

### Community 4 - "page.tsx"
Cohesion: 0.09
Nodes (27): BakeryOrdersPage(), Category, Customer, emptyOrderForm, formatAmount(), formatDate(), formatQty(), Invoice (+19 more)

### Community 5 - "dependencies"
Cohesion: 0.06
Nodes (30): dependencies, @bakersmania/shared, clsx, lucide-react, next, react, react-dom, react-hook-form (+22 more)

### Community 6 - "shell.tsx"
Cohesion: 0.17
Nodes (13): Category, initialCategoryForm, LoginResponse, PwaRegister(), bakeryNav, apiFetch(), authFetch(), clearSession() (+5 more)

### Community 7 - "staff.routes.ts"
Cohesion: 0.15
Nodes (14): staffController, staffRepository, staffRouter, AttendanceInput, attendanceSchema, LabourInput, labourSchema, LabourUpdateInput (+6 more)

### Community 8 - "scripts"
Cohesion: 0.09
Nodes (22): description, engines, node, npm, name, postcss, overrides, next (+14 more)

### Community 9 - "orders.routes.ts"
Cohesion: 0.12
Nodes (16): ordersController, CalculatedOrderItem, OrderListFilters, ordersRepository, ordersRouter, CreateOrderInput, createOrderSchema, orderItemSchema (+8 more)

### Community 10 - "platform-admin.routes.ts"
Cohesion: 0.16
Nodes (11): requirePlatformAdmin(), platformAdminController, platformAdminRepository, platformAdminRouter, OnboardTenantInput, onboardTenantSchema, UpdateBillingInput, updateBillingSchema (+3 more)

### Community 11 - "useToast"
Cohesion: 0.20
Nodes (9): BakeryProductsPage(), Category, Customer, CustomerPrice, formatAmount(), initialPriceForm, initialProductForm, Product (+1 more)

### Community 12 - "catalog.routes.ts"
Cohesion: 0.24
Nodes (12): catalogController, catalogRepository, catalogRouter, CategoryInput, categorySchema, CustomerPriceInput, customerPriceSchema, ProductInput (+4 more)

### Community 13 - "inventory.routes.ts"
Cohesion: 0.06
Nodes (16): Platform Admin, Auth And Access, Bakery Dashboard, Customers, Catalog, Products, And Pricing, Orders And Truck Loading, Routes And Vehicles, Labour, Attendance, And Payments (+8 more)

### Community 14 - "http.ts"
Cohesion: 0.14
Nodes (18): allowedOrigins, createApp(), env, envPaths, envSchema, optionalAuth(), requireAuth(), errorHandler() (+10 more)

### Community 15 - "suppliers.routes.ts"
Cohesion: 0.24
Nodes (10): suppliersController, suppliersRepository, suppliersRouter, PurchaseInput, PurchasePaymentInput, purchasePaymentSchema, purchaseSchema, SupplierInput (+2 more)

### Community 16 - "prisma.ts"
Cohesion: 0.22
Nodes (6): prisma, billingController, billingRepository, billingService, reportsRepository, reportsService

### Community 17 - "finance.routes.ts"
Cohesion: 0.24
Nodes (8): bakeryRoutesController, bakeryRoutesRepository, bakeryRoutesRouter, RouteInput, routeSchema, VehicleInput, vehicleSchema, bakeryRoutesService

### Community 18 - "page.tsx"
Cohesion: 0.17
Nodes (13): formatAmount(), formatDate(), formatNumber(), initialDate, initialPurchaseForm, initialSupplierForm, Purchase, PurchasePayment (+5 more)

### Community 19 - "page.tsx"
Cohesion: 0.20
Nodes (13): emptyDraft(), formatAmount(), formatDate(), Labour, LabourDashboard, LabourPaymentsPage(), monthInput(), monthLabel() (+5 more)

### Community 20 - "app.ts"
Cohesion: 0.27
Nodes (5): customersController, customersRepository, CustomerInput, CustomerUpdateInput, customersService

### Community 21 - "routes.routes.ts"
Cohesion: 0.22
Nodes (4): invoicesController, invoicesRepository, invoicesService, HttpError

### Community 23 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, paths (+5 more)

### Community 25 - "page.tsx"
Cohesion: 0.29
Nodes (3): modules, ModulePage(), AppShell()

### Community 26 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowJs, incremental, isolatedModules, jsx, module, moduleResolution, noEmit (+4 more)

### Community 27 - "page.tsx"
Cohesion: 0.22
Nodes (8): BakeryRoutesPage(), formatDate(), initialRouteForm, initialVehicleForm, Route, Tab, Vehicle, PhotoPicker()

### Community 28 - "page.tsx"
Cohesion: 0.22
Nodes (11): inventoryController, inventoryRepository, ProductStockFilters, inventoryRouter, InventoryItemInput, inventoryItemSchema, InventoryLedgerInput, inventoryLedgerSchema (+3 more)

### Community 29 - "package.json"
Cohesion: 0.17
Nodes (11): devDependencies, typescript, main, name, private, scripts, build, lint (+3 more)

### Community 30 - "page.tsx"
Cohesion: 0.27
Nodes (9): AttendanceStatus, currentMonth(), formatAmount(), formatDate(), LabourDetail, LabourDetailPage(), paymentClass(), PaymentType (+1 more)

### Community 31 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, module, moduleResolution, noEmit, outDir, rootDir, types, extends (+1 more)

### Community 32 - "page.tsx"
Cohesion: 0.22
Nodes (8): Customer, CustomerPrice, formatAmount(), PriceHistory, PriceRow, Product, ProductPriceAssignmentPage(), Route

### Community 33 - "HttpError"
Cohesion: 0.26
Nodes (12): CustomerBillingPage(), formatAmount(), formatDate(), Order, paid(), formatAmount(), formatDate(), paymentDue() (+4 more)

### Community 34 - "page.tsx"
Cohesion: 0.19
Nodes (13): BakeryCategoriesPage(), BakeryPage(), DashboardData, formatAmount(), formatCompactAmount(), formatNumber(), LowProductStock, OrderedWithoutStock (+5 more)

### Community 35 - "page.tsx"
Cohesion: 0.23
Nodes (11): formatAmount(), formatQty(), Order, orderDue(), orderPaid(), Payment, paymentMethods, routeName() (+3 more)

### Community 36 - "index.ts"
Cohesion: 0.25
Nodes (7): BakeryRole, bakeryRoles, OrderSource, orderSources, roleLabels, SubscriptionStatus, subscriptionStatuses

### Community 37 - "layout.tsx"
Cohesion: 0.33
Nodes (4): metadata, viewport, AppProviders(), ToastProvider()

### Community 38 - "tenants.service.ts"
Cohesion: 0.25
Nodes (9): formatAmount(), monthStart, Order, orderDue(), orderPaid(), Payment, routeName(), today (+1 more)

### Community 39 - "toast-provider.tsx"
Cohesion: 0.17
Nodes (9): formatQty(), today, TruckLoading, VehicleTruckLoadingPage(), Toast, toastConfig, ToastContext, ToastInput (+1 more)

### Community 41 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): compilerOptions, noEmit, extends, include

### Community 51 - "page.tsx"
Cohesion: 0.33
Nodes (7): CustomerOrdersPage(), due(), formatAmount(), formatDate(), Order, paid(), paymentMethods

### Community 52 - "auth.routes.ts"
Cohesion: 0.26
Nodes (8): authController, authRepository, authRouter, CustomerSignupInput, customerSignupSchema, LoginInput, loginSchema, authService

### Community 53 - "e2e-audit.mjs"
Cohesion: 0.18
Nodes (18): assert(), blocked(), ctx, login(), main(), month, page(), prepare() (+10 more)

### Community 54 - "page.tsx"
Cohesion: 0.21
Nodes (10): BakeryExpensesPage(), Expense, formatAmount(), formatDate(), initialDate, initialForm, Route, statusClass() (+2 more)

### Community 55 - "finance.repository.ts"
Cohesion: 0.31
Nodes (5): financeController, financeRepository, ExpenseInput, ExpenseStatusInput, financeService

### Community 56 - "page.tsx"
Cohesion: 0.24
Nodes (8): BakeryCustomersPage(), Customer, CustomerLedger, formatAmount(), formatDate(), initialCustomerForm, Route, stateCityMap

### Community 57 - "AsyncHandler"
Cohesion: 0.31
Nodes (5): tenantsController, tenantsRepository, tenantsRouter, tenantsService, AsyncHandler

### Community 58 - "page.tsx"
Cohesion: 0.33
Nodes (5): CartItem, CustomerPage(), formatAmount(), Product, today

### Community 59 - "finance.routes.ts"
Cohesion: 0.40
Nodes (4): validateBody(), financeRouter, expenseSchema, expenseStatusSchema

## Knowledge Gaps
- **338 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+333 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `url` connect `page.tsx` to `dependencies`, `page.tsx`?**
  _High betweenness centrality (0.259) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _338 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05580693815987934 - nodes in this community are weakly interconnected._
- **Should `page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07053140096618357 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._
- **Should `3. Platform modules` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08817204301075268 - nodes in this community are weakly interconnected._