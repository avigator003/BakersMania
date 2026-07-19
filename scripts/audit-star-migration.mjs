import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const prisma = new PrismaClient();

const main = async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: process.env.TENANT_SLUG || "star-bakery" },
    select: { id: true, slug: true }
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const tenantId = tenant.id;
  const [counts, legacyCustomers, legacyOrdersByRoute] = await Promise.all([
    prisma.$queryRaw`
      select
        (select count(*)::int from "Customer" where "tenantId" = ${tenantId}) customers,
        (select count(*)::int from "Order" where "tenantId" = ${tenantId}) orders,
        (select count(*)::int from "OrderItem" oi join "Order" o on o.id = oi."orderId" where o."tenantId" = ${tenantId}) order_items,
        (select count(*)::int from "Payment" where "tenantId" = ${tenantId}) payments,
        (select count(*)::int from "Invoice" where "tenantId" = ${tenantId}) invoices,
        (select count(*)::int from "Route" where "tenantId" = ${tenantId}) routes,
        (select count(*)::int from "Vehicle" where "tenantId" = ${tenantId}) vehicles,
        (select count(*)::int from "Product" where "tenantId" = ${tenantId}) products,
        (select count(*)::int from "InventoryItem" where "tenantId" = ${tenantId}) inventory_items,
        (select count(*)::int from "Supplier" where "tenantId" = ${tenantId}) suppliers,
        (select count(*)::int from "Purchase" where "tenantId" = ${tenantId}) purchases,
        (select count(*)::int from "Labour" where "tenantId" = ${tenantId}) labours,
        (select count(*)::int from "Expense" where "tenantId" = ${tenantId}) expenses,
        (select count(*)::int from "Order" where "tenantId" = ${tenantId} and "routeId" is null) orders_missing_route,
        (select count(*)::int from "Order" o where o."tenantId" = ${tenantId} and not exists (select 1 from "OrderItem" oi where oi."orderId" = o.id)) orders_without_items,
        (select count(*)::int from "Order" where "tenantId" = ${tenantId} and notes like '%Legacy%') orders_legacy_notes,
        (select count(*)::int from "Customer" where "tenantId" = ${tenantId} and notes like '%Legacy%') customers_legacy_notes,
        (select count(*)::int from "ProductCategory" where "tenantId" = ${tenantId} and name = 'Legacy') legacy_product_categories,
        (select count(*)::int from "Product" where "tenantId" = ${tenantId} and category = 'Legacy') legacy_category_products
    `,
    prisma.$queryRaw`
      select c.id, c.name, c.phone, r.name route, count(o.id)::int orders
      from "Customer" c
      left join "Route" r on r.id = c."routeId"
      left join "Order" o on o."customerId" = c.id
      where c."tenantId" = ${tenantId}
        and (c.tags @> array['Driver (Sales Man)']::text[] or c.notes like '%Legacy vehicle number:%')
      group by c.id, r.name
      order by c.name
    `,
    prisma.$queryRaw`
      select r.name route, c.name customer, c.phone, count(o.id)::int orders
      from "Order" o
      join "Customer" c on c.id = o."customerId"
      left join "Route" r on r.id = coalesce(o."routeId", c."routeId")
      where o."tenantId" = ${tenantId}
        and (c.tags @> array['Driver (Sales Man)']::text[] or c.notes like '%Legacy vehicle number:%')
      group by r.name, c.name, c.phone
      order by r.name, c.name
    `
  ]);

  console.log(JSON.stringify({
    tenant: tenant.slug,
    counts: counts[0],
    legacyCustomerCount: legacyCustomers.length,
    legacyCustomers,
    legacyOrdersByRoute
  }, null, 2));
};

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
