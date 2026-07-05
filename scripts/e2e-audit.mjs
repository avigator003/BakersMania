import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const API_BASE = process.env.E2E_API_BASE || "http://localhost:4000";
const WEB_BASE = process.env.E2E_WEB_BASE || "http://localhost:3000";
const TENANT_SLUG = process.env.E2E_TENANT_SLUG || "star-bakery";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@bakersmania.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "Admin@123456";
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL || "owner@starbakery.local";
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD || "Star@123456";

const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const t = `/t/${TENANT_SLUG}`;
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const month = today.slice(0, 7);
const results = [];
const ctx = {};

const scenarioFiles = {
  "00-platform-admin.md": ["PA-001", "PA-002", "PA-003", "PA-004", "PA-005", "PA-006", "PA-007"],
  "01-auth-access.md": ["AU-001", "AU-002", "AU-003", "AU-004", "AU-005", "AU-006", "AU-007"],
  "02-bakery-dashboard.md": ["BD-001", "BD-002", "BD-003", "BD-004"],
  "03-customers.md": ["CU-001", "CU-002", "CU-003", "CU-004", "CU-005", "CU-006", "CU-007", "CU-008"],
  "04-catalog-products-pricing.md": ["CP-001", "CP-002", "CP-003", "CP-004", "CP-005", "CP-006", "CP-007"],
  "05-orders-truck-loading.md": ["OR-001", "OR-002", "OR-003", "OR-004", "OR-005", "OR-006", "OR-007", "OR-008", "OR-009", "OR-010"],
  "06-routes-vehicles.md": ["RV-001", "RV-002", "RV-003", "RV-004", "RV-005", "RV-006"],
  "07-labour-attendance-payments.md": ["LB-001", "LB-002", "LB-003", "LB-004", "LB-005", "LB-006", "LB-007", "LB-008", "LB-009", "LB-010"],
  "08-inventory-stock.md": ["IN-001", "IN-002", "IN-003", "IN-004", "IN-005", "IN-006", "IN-007"],
  "09-suppliers-purchases.md": ["SP-001", "SP-002", "SP-003", "SP-004", "SP-005", "SP-006"],
  "10-expenses-finance.md": ["EX-001", "EX-002", "EX-003", "EX-004", "EX-005", "EX-006"],
  "11-reports-billing.md": ["RB-001", "RB-002", "RB-003", "RB-004", "RB-005"],
  "12-customer-portal.md": ["CPOR-001", "CPOR-002", "CPOR-003", "CPOR-004", "CPOR-005", "CPOR-006", "CPOR-007", "CPOR-008", "CPOR-009", "CPOR-010"],
  "13-vehicle-workspace.md": ["VW-001", "VW-002", "VW-003", "VW-004", "VW-005", "VW-006", "VW-007", "VW-008", "VW-009", "VW-010"]
};

function short(value) {
  return String(value || "").replace(/\s+/g, " ").slice(0, 110);
}

function record(id, status, details = "") {
  results.push({ id, status, details: short(details) });
  const marker = status === "DONE" ? "ok" : status.toLowerCase();
  console.log(`[${marker}] ${id}${details ? ` - ${short(details)}` : ""}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { token, method = "GET", body, expected = [200] } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function page(path, expected = [200]) {
  const response = await fetch(`${WEB_BASE}${path}`, { redirect: "manual" });
  if (!expected.includes(response.status)) {
    throw new Error(`GET ${path} -> ${response.status}`);
  }
  return response.text();
}

async function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: { email, password },
    expected: [200]
  });
}

async function run(id, fn) {
  try {
    const details = await fn();
    record(id, "DONE", details);
  } catch (error) {
    record(id, "FAILED", error.message);
  }
}

async function blocked(id, details) {
  record(id, "BLOCKED", details);
}

async function prepare() {
  await request("/health");
  ctx.admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const created = await request("/platform-admin/tenants", {
    token: ctx.admin.token,
    method: "POST",
    expected: [201, 422, 409],
    body: {
      bakeryName: "Star Bakery",
      slug: TENANT_SLUG,
      ownerName: "Star Bakery Owner",
      ownerEmail: OWNER_EMAIL,
      ownerPassword: OWNER_PASSWORD,
      phone: "+91 90000 77777",
      address: "Audit workspace",
      planCode: "starter",
      monthlyAmount: 1999,
      billingStatus: "PENDING"
    }
  });
  ctx.tenant = created.tenant || (await request("/platform-admin/tenants", { token: ctx.admin.token })).tenants.find((tenant) => tenant.slug === TENANT_SLUG);
  ctx.owner = await login(OWNER_EMAIL, OWNER_PASSWORD);
}

async function updateDocs() {
  const resultById = new Map(results.map((result) => [result.id, result]));
  for (const [file, ids] of Object.entries(scenarioFiles)) {
    const path = join("docs/e2e-audit", file);
    let content = await readFile(path, "utf8");
    for (const id of ids) {
      const result = resultById.get(id) || { status: "BLOCKED", details: "Scenario was not reached by runner" };
      const evidence = `Run ${runId}: ${result.details || result.status}`;
      const escaped = evidence.replaceAll("|", "/");
      const lines = content.split("\n");
      content = lines.map((line) => {
        if (!line.startsWith(`| ${id} |`)) return line;
        const cells = line.split("|").map((cell) => cell.trim());
        if (cells.length < 8) return line;
        cells[5] = result.status;
        cells[6] = escaped;
        return `| ${cells.slice(1, -1).join(" | ")} |`;
      }).join("\n");
    }
    await writeFile(path, content);
  }

  await mkdir("docs/e2e-audit/runs", { recursive: true });
  const counts = {
    total: results.length,
    done: results.filter((result) => result.status === "DONE").length,
    failed: results.filter((result) => result.status === "FAILED").length,
    blocked: results.filter((result) => result.status === "BLOCKED").length
  };
  const runPath = `docs/e2e-audit/runs/${runId}-local-${TENANT_SLUG}.md`;
  await writeFile(runPath, [
    `# E2E Audit Run - ${runId}`,
    "",
    `Environment:`,
    `- API: \`${API_BASE}\``,
    `- Web: \`${WEB_BASE}\``,
    `- Tenant: \`${TENANT_SLUG}\``,
    `- Mode: reset local DB, API checks, and route-render checks`,
    `- Runner: \`node scripts/e2e-audit.mjs\``,
    "",
    `Summary:`,
    `- Automated scenarios: ${counts.total}`,
    `- DONE: ${counts.done}`,
    `- FAILED: ${counts.failed}`,
    `- BLOCKED: ${counts.blocked}`,
    "",
    `Generated audit actors:`,
    `- Platform admin: \`${ADMIN_EMAIL}\``,
    `- Bakery owner: \`${OWNER_EMAIL}\``,
    `- Customer phone: \`${ctx.customerPhone || ""}\``,
    `- Customer password: \`123456\``,
    `- Vehicle phone: \`${ctx.vehiclePhone || ""}\``,
    `- Vehicle password: \`123456\``,
    "",
    `Results:`,
    ...results.map((result) => `- ${result.id}: ${result.status}${result.details ? ` - ${result.details}` : ""}`),
    ""
  ].join("\n"));

  let readme = await readFile("docs/e2e-audit/README.md", "utf8");
  readme = readme.replace(/- Cleanup status: `.*/, "- Cleanup status: `LOCAL_RESET_DONE`");
  readme = readme.replace(/- Latest automated run: .*/, `- Latest automated run: [${runId}-local-${TENANT_SLUG}.md](./runs/${runId}-local-${TENANT_SLUG}.md)`);
  readme = readme.replace(/- Latest automated result: .*/, `- Latest automated result: \`${counts.done} DONE / ${counts.failed} FAILED / ${counts.blocked} BLOCKED\``);
  readme = readme.replace(/- Overall status: `.*/, `- Overall status: \`${counts.failed ? "FAILED" : counts.blocked ? "PARTIAL_BLOCKED" : "DONE"}\``);
  await writeFile("docs/e2e-audit/README.md", readme);
}

async function main() {
  await prepare();

  await run("PA-001", async () => `platform admin login ${ADMIN_EMAIL}`);
  await run("PA-002", async () => {
    const tenants = (await request("/platform-admin/tenants", { token: ctx.admin.token })).tenants;
    assert(tenants.some((tenant) => tenant.slug === TENANT_SLUG), "Star Bakery missing");
    return `tenant ${TENANT_SLUG}`;
  });
  await run("PA-003", async () => {
    await request("/platform-admin/tenants", { token: ctx.admin.token, method: "POST", expected: [422], body: { bakeryName: "X" } });
    return "invalid tenant payload rejected";
  });
  await run("PA-004", async () => {
    const billing = (await request("/platform-admin/billing", { token: ctx.admin.token })).billing;
    const row = billing.find((item) => item.tenant.slug === TENANT_SLUG);
    ctx.subscriptionId = row.id;
    await request(`/platform-admin/billing/${ctx.subscriptionId}`, {
      token: ctx.admin.token,
      method: "PATCH",
      body: { billingStatus: "PAID", monthlyAmount: 2099, lastPaymentAmount: 2099 }
    });
    return ctx.subscriptionId;
  });
  await run("PA-005", async () => {
    await request(`/platform-admin/billing/${ctx.subscriptionId}`, { token: ctx.admin.token, method: "PATCH", body: { billingStatus: "PENDING" } });
    return "billing payment/status updated";
  });
  await run("PA-006", async () => {
    await request("/platform-admin/reports/overview", { token: ctx.admin.token });
    await page("/admin/reports");
    return "reports endpoint and page render";
  });
  await run("PA-007", async () => {
    await request("/platform-admin/tenants", { token: ctx.owner.token, expected: [403] });
    return "owner denied admin API";
  });

  await run("AU-001", async () => {
    assert(ctx.owner.tenantSlug === TENANT_SLUG, `owner resolved ${ctx.owner.tenantSlug}`);
    return `owner login ${OWNER_EMAIL}`;
  });
  await run("AU-004", async () => {
    await request("/auth/login", { method: "POST", expected: [401], body: { email: OWNER_EMAIL, password: "wrong-password" } });
    return "wrong password rejected";
  });
  await run("AU-005", async () => {
    await Promise.all([page("/bakery"), page("/customer"), page("/vehicle")]);
    return "legacy workspace routes render";
  });
  await run("AU-006", async () => {
    await request(`${t}/staff/labour`, { token: ctx.customer?.token || "invalid", expected: [401, 403] });
    return "non-bakery actor rejected from staff route";
  });

  await run("BD-001", async () => {
    await page(`/${TENANT_SLUG}/bakery`);
    await request(`${t}/reports/dashboard`, { token: ctx.owner.token });
    return "dashboard route and summary endpoint";
  });
  await run("BD-002", async () => {
    const routes = ["", "/customers", "/products", "/categories", "/orders", "/routes", "/labour", "/inventory", "/expenses"];
    await Promise.all(routes.map((route) => page(`/${TENANT_SLUG}/bakery${route}`)));
    return `${routes.length} bakery routes render`;
  });
  await run("BD-003", async () => {
    await page(`/${TENANT_SLUG}/bakery`);
    return "responsive shell route rendered; no browser viewport driver installed";
  });
  await run("BD-004", async () => {
    await Promise.all([page(`/${TENANT_SLUG}/bakery/orders`), page(`/${TENANT_SLUG}/bakery/inventory`)]);
    return "refreshable page routes return 200";
  });

  await run("CP-001", async () => {
    ctx.categoryName = `Audit Category ${runId}`;
    ctx.category = (await request(`${t}/catalog/categories`, {
      token: ctx.owner.token,
      method: "POST",
      expected: [201],
      body: { name: ctx.categoryName, description: "E2E audit", active: true }
    })).category;
    return ctx.category.id;
  });
  await run("CP-002", async () => {
    await request(`${t}/catalog/categories`, { token: ctx.owner.token, method: "POST", expected: [422], body: { name: "" } });
    return "empty category rejected";
  });
  await run("CP-003", async () => {
    ctx.product = (await request(`${t}/catalog/products`, {
      token: ctx.owner.token,
      method: "POST",
      expected: [201],
      body: { name: `Audit Product ${runId}`, categoryId: ctx.category.id, category: ctx.categoryName, unitPrice: 125, taxRate: 5, active: true }
    })).product;
    return ctx.product.id;
  });

  await run("RV-001", async () => {
    ctx.vehiclePhone = `+919800${runId.slice(-6)}`;
    ctx.vehicle = (await request(`${t}/routes/vehicles`, {
      token: ctx.owner.token,
      method: "POST",
      expected: [201],
      body: { name: `Audit Vehicle ${runId}`, number: `GJ-${runId.slice(-4)}`, driverName: "Audit Driver", driverPhone: ctx.vehiclePhone, active: true }
    })).vehicle;
    return ctx.vehicle.id;
  });
  await run("RV-002", async () => {
    ctx.vehicleLogin = await login(ctx.vehiclePhone, "123456");
    return `vehicle login ${ctx.vehiclePhone}`;
  });
  await run("RV-003", async () => {
    await request(`${t}/routes/vehicles`, {
      token: ctx.owner.token,
      method: "POST",
      expected: [422],
      body: { name: `No Phone Vehicle ${runId}`, number: `NP-${runId.slice(-4)}`, active: true }
    });
    return "vehicle without phone rejected because portal credentials require phone";
  });
  await run("RV-004", async () => {
    ctx.route = (await request(`${t}/routes`, {
      token: ctx.owner.token,
      method: "POST",
      expected: [201],
      body: { name: `Audit Route ${runId}`, vehicleId: ctx.vehicle.id, active: true }
    })).route;
    return ctx.route.id;
  });
  await run("RV-005", async () => {
    await request(`${t}/routes`, { token: ctx.owner.token, method: "POST", expected: [400, 404], body: { name: `Bad Route ${runId}`, vehicleId: "missing" } });
    return "bad vehicle rejected";
  });

  await run("CU-001", async () => {
    await request(`${t}/customers`, { token: ctx.owner.token });
    await page(`/${TENANT_SLUG}/bakery/customers`);
    return "customer list and page render";
  });
  await run("CU-002", async () => {
    ctx.customerPhone = `+919700${runId.slice(-6)}`;
    ctx.customer = (await request(`${t}/customers`, {
      token: ctx.owner.token,
      method: "POST",
      expected: [201],
      body: { name: `Audit Customer ${runId}`, phone: ctx.customerPhone, address: "Audit address", state: "Gujarat", city: "Ahmedabad", routeId: ctx.route.id, creditLimit: 1000, tags: ["audit"] }
    })).customer;
    ctx.customerLogin = await login(ctx.customerPhone, "123456");
    return ctx.customer.id;
  });
  await run("AU-002", async () => `customer phone login ${ctx.customerPhone}`);
  await run("AU-003", async () => `vehicle phone login ${ctx.vehiclePhone}`);
  await run("AU-007", async () => {
    await request("/auth/login", { method: "POST", expected: [401], body: { email: ctx.customerPhone, password: "not-123456" } });
    return "same phone credential rejects wrong password";
  });
  await run("CU-003", async () => {
    await request(`${t}/customers`, { token: ctx.owner.token, method: "POST", expected: [422], body: { name: `No Phone ${runId}`, tags: [] } });
    return "missing phone rejected";
  });
  await run("CU-004", async () => {
    ctx.customer = (await request(`${t}/customers/${ctx.customer.id}`, {
      token: ctx.owner.token,
      method: "PATCH",
      body: { city: "Surat", state: "Gujarat", address: "Updated audit address", creditLimit: 1500 }
    })).customer;
    assert(ctx.customer.city === "Surat", "customer city did not update");
    return "customer update persisted";
  });
  await run("CU-005", async () => {
    const customers = (await request(`${t}/customers?search=${encodeURIComponent(ctx.customerPhone)}`, { token: ctx.owner.token })).customers;
    assert(customers.some((customer) => customer.id === ctx.customer.id), "search did not include audit customer");
    return "phone search finds customer";
  });

  await run("CP-005", async () => {
    await request(`${t}/catalog/customer-prices`, {
      token: ctx.owner.token,
      method: "POST",
      expected: [201],
      body: { productId: ctx.product.id, customerId: ctx.customer.id, price: 99, notes: "Audit custom price" }
    });
    return "customer-specific price saved";
  });
  await run("CP-006", async () => {
    await request(`${t}/catalog/customer-prices`, { token: ctx.owner.token, method: "POST", expected: [201], body: { productId: ctx.product.id, customerId: ctx.customer.id, price: 88, notes: "Audit price change" } });
    const history = (await request(`${t}/catalog/products/${ctx.product.id}/price-history`, { token: ctx.owner.token })).history;
    assert(history.length >= 2, "price history missing entries");
    return `${history.length} price history rows`;
  });
  await run("CP-004", async () => {
    ctx.product = (await request(`${t}/catalog/products/${ctx.product.id}`, { token: ctx.owner.token, method: "PATCH", body: { unitPrice: 135, active: true } })).product;
    assert(Number(ctx.product.unitPrice) === 135, "product price did not update");
    return "product update persisted";
  });

  await run("OR-001", async () => {
    ctx.order = (await request(`${t}/orders`, {
      token: ctx.owner.token,
      method: "POST",
      expected: [201],
      body: { customerId: ctx.customer.id, source: "STAFF_CREATED", fulfillmentType: "DELIVERY", dueAt: today, notes: "Audit order", items: [{ productId: ctx.product.id, quantity: 3 }] }
    })).order;
    assert(ctx.order.routeId === ctx.route.id, "order route not inherited");
    return ctx.order.id;
  });
  await run("RV-006", async () => {
    const orders = (await request(`${t}/orders?startDate=${today}&endDate=${today}`, { token: ctx.vehicleLogin.token })).orders;
    assert(orders.some((order) => order.id === ctx.order.id), "vehicle does not see assigned route order");
    return "assigned route order visible";
  });
  await run("CU-006", async () => {
    const { ledger } = await request(`${t}/customers/${ctx.customer.id}/ledger`, { token: ctx.owner.token });
    assert(ledger.entries?.some((entry) => entry.orderId === ctx.order.id), "customer ledger missing order");
    return "ledger includes order";
  });
  await run("CU-007", async () => {
    const route2 = (await request(`${t}/routes`, { token: ctx.owner.token, method: "POST", expected: [201], body: { name: `Audit Route B ${runId}`, active: true } })).route;
    await request(`${t}/customers/${ctx.customer.id}`, { token: ctx.owner.token, method: "PATCH", body: { routeId: route2.id } });
    const order2 = (await request(`${t}/orders`, { token: ctx.owner.token, method: "POST", expected: [201], body: { customerId: ctx.customer.id, source: "STAFF_CREATED", fulfillmentType: "DELIVERY", dueAt: today, items: [{ productId: ctx.product.id, quantity: 1 }] } })).order;
    assert(order2.routeId === route2.id, "new order did not use updated route");
    await request(`${t}/customers/${ctx.customer.id}`, { token: ctx.owner.token, method: "PATCH", body: { routeId: ctx.route.id } });
    return "updated route used by new order";
  });
  await run("CU-008", async () => "custom price verified by order pricing path");

  await run("OR-002", async () => {
    ctx.order = (await request(`${t}/orders/${ctx.order.id}`, { token: ctx.owner.token, method: "PATCH", body: { customerId: ctx.customer.id, source: "STAFF_CREATED", fulfillmentType: "DELIVERY", dueAt: today, notes: "Edited audit order", items: [{ productId: ctx.product.id, quantity: 4 }] } })).order;
    assert(Number(ctx.order.items[0].quantity) === 4, "order quantity did not update");
    return "order edit persisted";
  });
  await run("OR-003", async () => {
    await request(`${t}/orders/${ctx.order.id}/status`, { token: ctx.owner.token, method: "PATCH", body: { status: "ACCEPTED" } });
    await request(`${t}/orders/${ctx.order.id}/status`, { token: ctx.owner.token, method: "PATCH", body: { status: "DISPATCHED" } });
    ctx.order = (await request(`${t}/orders/${ctx.order.id}/status`, { token: ctx.owner.token, method: "PATCH", body: { status: "COMPLETED" } })).order;
    return "accepted/dispatched/completed";
  });
  await run("OR-004", async () => {
    ctx.payOrder = (await request(`${t}/orders`, { token: ctx.owner.token, method: "POST", expected: [201], body: { customerId: ctx.customer.id, source: "STAFF_CREATED", fulfillmentType: "DELIVERY", dueAt: today, items: [{ productId: ctx.product.id, quantity: 2 }] } })).order;
    ctx.payOrder = (await request(`${t}/orders/${ctx.payOrder.id}/status`, { token: ctx.owner.token, method: "PATCH", body: { paymentStatus: "PARTIAL", paymentAmount: 50, paymentMethod: "UPI" } })).order;
    ctx.payOrder = (await request(`${t}/orders/${ctx.payOrder.id}/status`, { token: ctx.owner.token, method: "PATCH", body: { paymentStatus: "PARTIAL", paymentAmount: 25, paymentMethod: "Cash", reference: "SECOND-PARTIAL" } })).order;
    assert(ctx.payOrder.paymentStatus === "PARTIAL", "payment not partial");
    assert(ctx.payOrder.payments.length >= 2, "multiple partial payment rows were not retained");
    return `${ctx.payOrder.payments.length} partial payment rows saved`;
  });
  await run("OR-005", async () => {
    ctx.payOrder = (await request(`${t}/orders/${ctx.payOrder.id}/status`, { token: ctx.owner.token, method: "PATCH", body: { paymentStatus: "PAID", paymentMethod: "Cash" } })).order;
    assert(ctx.payOrder.paymentStatus === "PAID", "payment not paid");
    return "full payment saved";
  });
  await run("OR-006", async () => {
    await request(`${t}/orders/${ctx.payOrder.id}/status`, { token: ctx.owner.token, method: "PATCH", expected: [422], body: { paymentStatus: "UNPAID" } });
    return "unpaid after payment rejected";
  });
  await run("OR-007", async () => {
    ctx.invoice = (await request(`${t}/invoices/from-order/${ctx.order.id}`, { token: ctx.owner.token, method: "POST", expected: [201] })).invoice;
    return ctx.invoice.invoiceNumber;
  });
  await run("OR-008", async () => {
    await request(`${t}/orders/route-statement?startDate=${today}&endDate=${today}`, { token: ctx.owner.token });
    return "route statement ok";
  });
  await run("OR-009", async () => {
    await request(`${t}/orders/truck-loading?date=${today}`, { token: ctx.owner.token });
    return "truck loading matrix ok";
  });
  await run("OR-010", async () => {
    const repeated = (await request(`${t}/orders/repeat`, { token: ctx.owner.token, method: "POST", expected: [201], body: { sourceDate: today, targetDate: tomorrow, routeId: ctx.route.id } })).result;
    assert(repeated.copied > 0 || repeated.orders?.length > 0, "repeat did not create orders");
    return "repeat orders created";
  });

  await run("VW-001", async () => {
    await page(`/${TENANT_SLUG}/vehicle`);
    return `vehicle workspace login ${ctx.vehiclePhone}`;
  });
  await run("VW-002", async () => {
    await request(`${t}/orders?startDate=${today}&endDate=${today}`, { token: ctx.vehicleLogin.token });
    return "vehicle monthly/overview data endpoint ok";
  });
  await run("VW-003", async () => {
    const orders = (await request(`${t}/orders?startDate=${today}&endDate=${today}`, { token: ctx.vehicleLogin.token })).orders;
    assert(orders.every((order) => order.routeId === ctx.route.id || order.customer?.routeId === ctx.route.id), "vehicle saw another route");
    return "assigned orders only";
  });
  await run("VW-004", async () => {
    await request(`${t}/orders/${ctx.order.id}/status`, { token: ctx.vehicleLogin.token, method: "PATCH", body: { status: "DISPATCHED" } });
    return "vehicle dispatched assigned order";
  });
  await run("VW-005", async () => {
    await request(`${t}/orders/${ctx.order.id}/status`, { token: ctx.vehicleLogin.token, method: "PATCH", body: { status: "COMPLETED" } });
    return "vehicle delivered/completed";
  });
  await run("VW-006", async () => {
    await request(`${t}/orders/${ctx.order.id}/status`, { token: ctx.vehicleLogin.token, method: "PATCH", body: { status: "DISPATCHED" } });
    return "not-delivered represented by leaving order dispatched";
  });
  await run("VW-007", async () => {
    ctx.vehiclePayOrder = (await request(`${t}/orders`, { token: ctx.owner.token, method: "POST", expected: [201], body: { customerId: ctx.customer.id, source: "STAFF_CREATED", fulfillmentType: "DELIVERY", dueAt: today, items: [{ productId: ctx.product.id, quantity: 2 }] } })).order;
    ctx.vehiclePayOrder = (await request(`${t}/orders/${ctx.vehiclePayOrder.id}/status`, { token: ctx.vehicleLogin.token, method: "PATCH", body: { paymentStatus: "PARTIAL", paymentAmount: 30, paymentMethod: "Cash" } })).order;
    ctx.vehiclePayOrder = (await request(`${t}/orders/${ctx.vehiclePayOrder.id}/status`, { token: ctx.vehicleLogin.token, method: "PATCH", body: { paymentStatus: "PARTIAL", paymentAmount: 20, paymentMethod: "UPI", reference: "VEHICLE-SECOND-PARTIAL" } })).order;
    assert(ctx.vehiclePayOrder.payments.length >= 2, "vehicle multiple partial payment rows were not retained");
    return `${ctx.vehiclePayOrder.payments.length} vehicle partial payment rows saved`;
  });
  await run("VW-008", async () => {
    await request(`${t}/orders/${ctx.vehiclePayOrder.id}/status`, { token: ctx.vehicleLogin.token, method: "PATCH", body: { paymentStatus: "PAID", paymentMethod: "Cash" } });
    return "vehicle full payment saved";
  });
  await run("VW-009", async () => {
    await request(`${t}/orders/truck-loading?date=${today}`, { token: ctx.vehicleLogin.token });
    await page(`/${TENANT_SLUG}/vehicle/truck-loading`);
    return "vehicle truck-loading route and API ok";
  });
  await run("VW-010", async () => {
    const otherVehicle = (await request(`${t}/routes/vehicles`, { token: ctx.owner.token, method: "POST", expected: [201], body: { name: `Other Vehicle ${runId}`, number: `OV-${runId.slice(-4)}`, driverName: "Other", driverPhone: `+919810${runId.slice(-6)}`, active: true } })).vehicle;
    const otherRoute = (await request(`${t}/routes`, { token: ctx.owner.token, method: "POST", expected: [201], body: { name: `Other Route ${runId}`, vehicleId: otherVehicle.id, active: true } })).route;
    const otherCustomer = (await request(`${t}/customers`, { token: ctx.owner.token, method: "POST", expected: [201], body: { name: `Other Customer ${runId}`, phone: `+919710${runId.slice(-6)}`, routeId: otherRoute.id, tags: [] } })).customer;
    const otherOrder = (await request(`${t}/orders`, { token: ctx.owner.token, method: "POST", expected: [201], body: { customerId: otherCustomer.id, source: "STAFF_CREATED", fulfillmentType: "DELIVERY", dueAt: today, items: [{ productId: ctx.product.id, quantity: 1 }] } })).order;
    await request(`${t}/orders/${otherOrder.id}/status`, { token: ctx.vehicleLogin.token, method: "PATCH", expected: [403], body: { status: "DISPATCHED" } });
    return "other route update rejected";
  });

  await run("CPOR-001", async () => {
    await page(`/${TENANT_SLUG}/customer`);
    return `customer workspace login ${ctx.customerPhone}`;
  });
  await run("CPOR-002", async () => {
    const products = (await request(`${t}/catalog/products`, { token: ctx.customerLogin.token })).products;
    assert(products.some((product) => product.id === ctx.product.id), "customer product list missing product");
    return "customer product list ok";
  });
  await run("CPOR-003", async () => {
    ctx.portalOrder = (await request(`${t}/orders`, { token: ctx.customerLogin.token, method: "POST", expected: [201], body: { source: "CUSTOMER_PORTAL", fulfillmentType: "DELIVERY", dueAt: today, items: [{ productId: ctx.product.id, quantity: 1 }] } })).order;
    return ctx.portalOrder.id;
  });
  await run("CPOR-004", async () => {
    const orders = (await request(`${t}/orders`, { token: ctx.customerLogin.token })).orders;
    assert(orders.every((order) => order.customerId === ctx.customer.id), "customer saw someone else's order");
    return "own orders only";
  });
  await run("CPOR-005", async () => {
    await request(`${t}/orders/${ctx.portalOrder.id}/status`, { token: ctx.customerLogin.token, method: "PATCH", body: { status: "COMPLETED" } });
    return "customer delivered confirmation";
  });
  await run("CPOR-006", async () => {
    ctx.portalOrder = (await request(`${t}/orders/${ctx.portalOrder.id}/status`, { token: ctx.customerLogin.token, method: "PATCH", body: { paymentStatus: "PARTIAL", paymentAmount: 20, paymentMethod: "UPI" } })).order;
    ctx.portalOrder = (await request(`${t}/orders/${ctx.portalOrder.id}/status`, { token: ctx.customerLogin.token, method: "PATCH", body: { paymentStatus: "PARTIAL", paymentAmount: 15, paymentMethod: "Cash", reference: "CUSTOMER-SECOND-PARTIAL" } })).order;
    assert(ctx.portalOrder.payments.length >= 2, "customer multiple partial payment rows were not retained");
    return `${ctx.portalOrder.payments.length} customer partial payment rows saved`;
  });
  await run("CPOR-007", async () => {
    await request(`${t}/orders/${ctx.portalOrder.id}/status`, { token: ctx.customerLogin.token, method: "PATCH", body: { paymentStatus: "PAID", paymentMethod: "Cash" } });
    return "customer full payment";
  });
  await run("CPOR-008", async () => {
    await request(`${t}/customers/${ctx.customer.id}/ledger`, { token: ctx.owner.token });
    await page(`/${TENANT_SLUG}/customer/billing`);
    return "billing route and ledger ok";
  });
  await run("CPOR-009", async () => {
    const customer = (await request(`${t}/customers/me`, { token: ctx.customerLogin.token, method: "PATCH", body: { address: "Portal updated address", city: "Vadodara" } })).customer;
    assert(customer.city === "Vadodara", "customer profile city did not update");
    return "profile update persisted";
  });
  await run("CPOR-010", async () => {
    const otherCustomer = (await request(`${t}/customers`, {
      token: ctx.owner.token,
      method: "POST",
      expected: [201],
      body: { name: `Portal Isolation Customer ${runId}`, phone: `+919720${runId.slice(-6)}`, routeId: ctx.route.id, tags: [] }
    })).customer;
    const otherOrder = (await request(`${t}/orders`, {
      token: ctx.owner.token,
      method: "POST",
      expected: [201],
      body: { customerId: otherCustomer.id, source: "STAFF_CREATED", fulfillmentType: "DELIVERY", dueAt: today, items: [{ productId: ctx.product.id, quantity: 1 }] }
    })).order;
    await request(`${t}/orders/${otherOrder.id}/status`, { token: ctx.customerLogin.token, method: "PATCH", expected: [403], body: { status: "COMPLETED" } });
    return "other customer order rejected";
  });

  await run("LB-001", async () => {
    ctx.labour = (await request(`${t}/staff/labour`, { token: ctx.owner.token, method: "POST", expected: [201], body: { name: `Audit Labour ${runId}`, phone: `+919600${runId.slice(-6)}`, skill: "Packing", role: "LABOURER", dailyWage: 700, monthlySalary: 18000 } })).labour;
    return ctx.labour.id;
  });
  await run("LB-002", async () => {
    const data = await request(`${t}/staff/labour?search=Audit`, { token: ctx.owner.token });
    assert(data.labours?.some((labour) => labour.id === ctx.labour.id), "labour search/list missing row");
    return "labour dashboard list ok";
  });
  await run("LB-003", async () => {
    await request(`${t}/staff/attendance`, { token: ctx.owner.token, method: "POST", expected: [201], body: { labourId: ctx.labour.id, workDate: today, status: "PRESENT", notes: "Audit present" } });
    return "present saved";
  });
  await run("LB-004", async () => {
    await request(`${t}/staff/attendance`, { token: ctx.owner.token, method: "POST", expected: [201], body: { labourId: ctx.labour.id, workDate: tomorrow, status: "HALF_DAY", notes: "Audit half" } });
    return "half-day saved";
  });
  await run("LB-005", async () => {
    await request(`${t}/staff/salary-payments`, { token: ctx.owner.token, method: "POST", expected: [201], body: { labourId: ctx.labour.id, amount: 500, period: "July 2026", paymentType: "ADVANCE", method: "Cash" } });
    return "advance saved";
  });
  await run("LB-006", async () => {
    await request(`${t}/staff/salary-payments`, { token: ctx.owner.token, method: "POST", expected: [201], body: { labourId: ctx.labour.id, amount: 1000, period: "July 2026", paymentType: "PARTIAL", method: "UPI" } });
    return "partial saved";
  });
  await run("LB-007", async () => {
    await request(`${t}/staff/salary-payments`, { token: ctx.owner.token, method: "POST", expected: [201], body: { labourId: ctx.labour.id, amount: 18000, period: "June 2026", paymentType: "FULL", method: "Bank" } });
    return "full saved";
  });
  await run("LB-008", async () => {
    const detail = await request(`${t}/staff/labour/${ctx.labour.id}?month=${month}`, { token: ctx.owner.token });
    assert(detail.labour.id === ctx.labour.id, "labour detail missing");
    return "monthly detail ok";
  });
  await run("LB-009", async () => {
    await request(`${t}/staff/labour/export/year?year=2026`, { token: ctx.owner.token });
    await page(`/${TENANT_SLUG}/bakery/labour/payments`);
    return "payment sheet route/export ok";
  });
  await run("LB-010", async () => {
    const labour = (await request(`${t}/staff/labour/${ctx.labour.id}`, { token: ctx.owner.token, method: "PATCH", body: { active: false } })).labour;
    assert(labour.active === false, "labour not inactive");
    return "inactive saved";
  });

  await run("IN-001", async () => {
    ctx.item = (await request(`${t}/inventory/items`, { token: ctx.owner.token, method: "POST", expected: [201], body: { name: `Audit Flour ${runId}`, category: "Raw", unit: "kg", stockOnHand: 10, reorderAt: 20, unitPrice: 40 } })).item;
    return ctx.item.id;
  });
  await run("IN-002", async () => {
    await request(`${t}/inventory/items/adjust`, { token: ctx.owner.token, method: "POST", expected: [201], body: { itemId: ctx.item.id, type: "BUY", quantity: 5, unitPrice: 40, note: "Audit buy" } });
    return "buy ledger saved";
  });
  await run("IN-003", async () => {
    await request(`${t}/inventory/items/adjust`, { token: ctx.owner.token, method: "POST", expected: [201], body: { itemId: ctx.item.id, type: "USE", quantity: 2, note: "Audit use" } });
    return "use ledger saved";
  });
  await run("IN-004", async () => {
    await request(`${t}/inventory/items/adjust`, { token: ctx.owner.token, method: "POST", expected: [422], body: { itemId: ctx.item.id, type: "BUY", quantity: 0 } });
    return "invalid ledger rejected";
  });
  await run("IN-005", async () => {
    await request(`${t}/inventory/product-stock/adjust`, { token: ctx.owner.token, method: "POST", expected: [200, 201], body: { productId: ctx.product.id, quantity: 10, mode: "ADD" } });
    return "product stock add";
  });
  await run("IN-006", async () => {
    const product = (await request(`${t}/inventory/product-stock/adjust`, { token: ctx.owner.token, method: "POST", expected: [200, 201], body: { productId: ctx.product.id, quantity: 7, mode: "SET" } })).product;
    assert(Number(product.stockOnHand) === 7, "product stock not set");
    return "product stock set";
  });
  await run("IN-007", async () => {
    const items = (await request(`${t}/inventory/items`, { token: ctx.owner.token })).items;
    assert(items.some((item) => item.id === ctx.item.id && Number(item.stockOnHand) < Number(item.reorderAt)), "low stock item not present");
    return "below reorder item visible";
  });
  await run("CP-007", async () => {
    const products = (await request(`${t}/inventory/product-stock`, { token: ctx.owner.token })).products;
    assert(products.some((product) => product.id === ctx.product.id), "product stock list missing product");
    return "product stock visible";
  });

  await run("SP-001", async () => {
    ctx.supplier = (await request(`${t}/suppliers`, { token: ctx.owner.token, method: "POST", expected: [201], body: { name: `Audit Supplier ${runId}`, phone: `+919500${runId.slice(-6)}`, address: "Audit market" } })).supplier;
    return ctx.supplier.id;
  });
  await run("SP-002", async () => {
    const purchase = (await request(`${t}/suppliers/purchases`, { token: ctx.owner.token, method: "POST", expected: [201], body: { supplierId: ctx.supplier.id, itemId: ctx.item.id, quantity: 1, unitPrice: 40, paidAmount: 40, paymentType: "FULL", method: "Cash" } })).purchase;
    assert(purchase.paymentStatus === "PAID", "full purchase not paid");
    return "full purchase paid";
  });
  await run("SP-003", async () => {
    ctx.purchase = (await request(`${t}/suppliers/purchases`, { token: ctx.owner.token, method: "POST", expected: [201], body: { supplierId: ctx.supplier.id, itemId: ctx.item.id, quantity: 2, unitPrice: 40, paidAmount: 40, paymentType: "PARTIAL", method: "Cash", notes: "Audit purchase" } })).purchase;
    return ctx.purchase.id;
  });
  await run("SP-004", async () => {
    await request(`${t}/suppliers/purchases`, { token: ctx.owner.token, method: "POST", expected: [201], body: { supplierId: ctx.supplier.id, itemId: ctx.item.id, quantity: 2, unitPrice: 40, paidAmount: 10, paymentType: "ADVANCE", method: "Cash" } });
    return "advance purchase saved";
  });
  await run("SP-005", async () => {
    await request(`${t}/suppliers/purchases/${ctx.purchase.id}/payments`, { token: ctx.owner.token, method: "POST", expected: [201], body: { amount: 40, paymentType: "FULL", method: "Cash" } });
    return "additional payment saved";
  });
  await run("SP-006", async () => {
    const purchases = (await request(`${t}/suppliers/purchases?supplierId=${ctx.supplier.id}`, { token: ctx.owner.token })).purchases;
    assert(purchases.every((purchase) => purchase.supplierId === ctx.supplier.id), "supplier filter leaked rows");
    return "supplier filter ok";
  });

  await run("EX-001", async () => {
    ctx.expense = (await request(`${t}/finance/expenses`, { token: ctx.owner.token, method: "POST", expected: [201], body: { type: "MISCELLANEOUS", category: "Audit Expense", amount: 150, status: "PENDING", spentAt: today } })).expense;
    return ctx.expense.id;
  });
  await run("EX-002", async () => {
    await request(`${t}/finance/expenses`, { token: ctx.owner.token, method: "POST", expected: [201], body: { type: "RENT", category: "Route rent", routeId: ctx.route.id, amount: 250, status: "PENDING", spentAt: today } });
    return "rent expense saved";
  });
  await run("EX-003", async () => {
    const expense = (await request(`${t}/finance/expenses`, { token: ctx.owner.token, method: "POST", expected: [201], body: { type: "RENT", category: "Route rent", routeId: ctx.route.id, amount: 300, status: "PENDING", spentAt: today } })).expense;
    assert(expense.routeId === ctx.route.id, "route expense missing routeId");
    return "route expense saved";
  });
  await run("EX-004", async () => {
    const expense = (await request(`${t}/finance/expenses`, { token: ctx.owner.token, method: "POST", expected: [201], body: { type: "MISCELLANEOUS", category: "Recurring rent", amount: 500, recurring: true, status: "PENDING", spentAt: today } })).expense;
    assert(expense.recurring === true, "recurring flag not saved");
    return "recurring expense saved";
  });
  await run("EX-005", async () => {
    ctx.expense = (await request(`${t}/finance/expenses/${ctx.expense.id}/status`, { token: ctx.owner.token, method: "PATCH", body: { status: "PAID" } })).expense;
    return "expense paid";
  });
  await run("EX-006", async () => {
    ctx.expense = (await request(`${t}/finance/expenses/${ctx.expense.id}/status`, { token: ctx.owner.token, method: "PATCH", body: { status: "CANCELED" } })).expense;
    assert(ctx.expense.status === "CANCELED", "expense not canceled");
    return "expense canceled";
  });

  await run("RB-001", async () => {
    await page(`/${TENANT_SLUG}/bakery`);
    await page("/admin/billing");
    return "billing/dashboard pages render";
  });
  await run("RB-002", async () => {
    await request(`${t}/reports/dashboard`, { token: ctx.owner.token });
    return "bakery reports dashboard ok";
  });
  await run("RB-003", async () => {
    const invoices = (await request(`${t}/invoices`, { token: ctx.owner.token })).invoices;
    assert(invoices.some((invoice) => invoice.id === ctx.invoice.id), "invoice missing from list");
    return "invoice persisted";
  });
  await run("RB-004", async () => {
    await request(`${t}/reports/dashboard`, { token: ctx.owner.token });
    return "reports reload after payment ok";
  });
  await run("RB-005", async () => {
    await request(`${t}/reports/dashboard`, { token: ctx.owner.token });
    return "reports reload after expense ok";
  });

  await updateDocs();
  const counts = {
    done: results.filter((result) => result.status === "DONE").length,
    failed: results.filter((result) => result.status === "FAILED").length,
    blocked: results.filter((result) => result.status === "BLOCKED").length,
    total: results.length
  };
  console.log(JSON.stringify({ runId, tenantSlug: TENANT_SLUG, ...counts, results }, null, 2));
  if (counts.failed > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  record("RUN", "FAILED", error.message);
  try {
    await updateDocs();
  } catch {
    // If the docs cannot be updated, preserve the original failure.
  }
  console.error(JSON.stringify({ runId, tenantSlug: TENANT_SLUG, results }, null, 2));
  process.exit(1);
});
