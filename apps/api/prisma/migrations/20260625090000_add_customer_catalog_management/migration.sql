-- Customer profile fields and delivery route assignment.
ALTER TABLE "Customer" ADD COLUMN "routeId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "aadhaarNumber" TEXT;
ALTER TABLE "Customer" ADD COLUMN "aadhaarPhotoUrl" TEXT;
ALTER TABLE "Customer" ADD COLUMN "address" TEXT;
ALTER TABLE "Customer" ADD COLUMN "state" TEXT;
ALTER TABLE "Customer" ADD COLUMN "city" TEXT;

-- Product categories.
CREATE TABLE "ProductCategory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;

INSERT INTO "ProductCategory" ("id", "tenantId", "name", "active", "createdAt", "updatedAt")
SELECT CONCAT('cat_', md5("tenantId" || ':' || "category")), "tenantId", "category", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "tenantId", COALESCE(NULLIF("category", ''), 'General') AS "category"
  FROM "Product"
) AS product_categories;

UPDATE "Product"
SET "categoryId" = CONCAT('cat_', md5("tenantId" || ':' || COALESCE(NULLIF("category", ''), 'General')));

-- Customer-specific product pricing.
CREATE TABLE "CustomerProductPrice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerProductPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductCategory_tenantId_name_key" ON "ProductCategory"("tenantId", "name");
CREATE INDEX "ProductCategory_tenantId_active_idx" ON "ProductCategory"("tenantId", "active");
CREATE INDEX "Customer_tenantId_routeId_idx" ON "Customer"("tenantId", "routeId");
CREATE INDEX "Product_tenantId_categoryId_idx" ON "Product"("tenantId", "categoryId");
CREATE UNIQUE INDEX "CustomerProductPrice_tenantId_productId_customerId_key" ON "CustomerProductPrice"("tenantId", "productId", "customerId");
CREATE INDEX "CustomerProductPrice_tenantId_customerId_idx" ON "CustomerProductPrice"("tenantId", "customerId");
CREATE INDEX "CustomerProductPrice_tenantId_productId_idx" ON "CustomerProductPrice"("tenantId", "productId");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerProductPrice" ADD CONSTRAINT "CustomerProductPrice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerProductPrice" ADD CONSTRAINT "CustomerProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerProductPrice" ADD CONSTRAINT "CustomerProductPrice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
