-- High-scale tenant hot-path indexes.

CREATE INDEX IF NOT EXISTS "User_phone_idx" ON "User"("phone");

CREATE INDEX IF NOT EXISTS "Customer_tenantId_createdAt_idx" ON "Customer"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Customer_tenantId_routeId_createdAt_idx" ON "Customer"("tenantId", "routeId", "createdAt");

CREATE INDEX IF NOT EXISTS "Product_tenantId_active_name_idx" ON "Product"("tenantId", "active", "name");
CREATE INDEX IF NOT EXISTS "Product_tenantId_categoryId_active_idx" ON "Product"("tenantId", "categoryId", "active");

CREATE INDEX IF NOT EXISTS "CustomerProductPrice_tenantId_customerId_productId_idx" ON "CustomerProductPrice"("tenantId", "customerId", "productId");

CREATE INDEX IF NOT EXISTS "CustomerProductPriceHistory_tenantId_productId_changedAt_idx" ON "CustomerProductPriceHistory"("tenantId", "productId", "changedAt");
CREATE INDEX IF NOT EXISTS "CustomerProductPriceHistory_tenantId_customerId_changedAt_idx" ON "CustomerProductPriceHistory"("tenantId", "customerId", "changedAt");

CREATE INDEX IF NOT EXISTS "Order_tenantId_createdAt_idx" ON "Order"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_tenantId_dueAt_idx" ON "Order"("tenantId", "dueAt");
CREATE INDEX IF NOT EXISTS "Order_tenantId_routeId_createdAt_idx" ON "Order"("tenantId", "routeId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_tenantId_routeId_dueAt_idx" ON "Order"("tenantId", "routeId", "dueAt");
CREATE INDEX IF NOT EXISTS "Order_tenantId_customerId_createdAt_idx" ON "Order"("tenantId", "customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_tenantId_customerId_dueAt_idx" ON "Order"("tenantId", "customerId", "dueAt");
CREATE INDEX IF NOT EXISTS "Order_tenantId_status_createdAt_idx" ON "Order"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_tenantId_paymentStatus_createdAt_idx" ON "Order"("tenantId", "paymentStatus", "createdAt");

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");

CREATE INDEX IF NOT EXISTS "Invoice_tenantId_createdAt_idx" ON "Invoice"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Invoice_tenantId_paymentStatus_idx" ON "Invoice"("tenantId", "paymentStatus");

CREATE INDEX IF NOT EXISTS "Payment_tenantId_paidAt_idx" ON "Payment"("tenantId", "paidAt");
CREATE INDEX IF NOT EXISTS "Payment_tenantId_orderId_idx" ON "Payment"("tenantId", "orderId");
CREATE INDEX IF NOT EXISTS "Payment_tenantId_invoiceId_idx" ON "Payment"("tenantId", "invoiceId");

CREATE INDEX IF NOT EXISTS "InventoryItem_tenantId_category_name_idx" ON "InventoryItem"("tenantId", "category", "name");
CREATE INDEX IF NOT EXISTS "InventoryLedger_tenantId_itemId_happenedAt_idx" ON "InventoryLedger"("tenantId", "itemId", "happenedAt");

CREATE INDEX IF NOT EXISTS "Supplier_tenantId_name_idx" ON "Supplier"("tenantId", "name");

CREATE INDEX IF NOT EXISTS "Purchase_tenantId_paymentStatus_purchasedAt_idx" ON "Purchase"("tenantId", "paymentStatus", "purchasedAt");
CREATE INDEX IF NOT EXISTS "Purchase_tenantId_supplierId_purchasedAt_idx" ON "Purchase"("tenantId", "supplierId", "purchasedAt");

CREATE INDEX IF NOT EXISTS "Expense_tenantId_periodMonth_status_idx" ON "Expense"("tenantId", "periodMonth", "status");
CREATE INDEX IF NOT EXISTS "Expense_tenantId_periodMonth_type_idx" ON "Expense"("tenantId", "periodMonth", "type");
CREATE INDEX IF NOT EXISTS "Expense_tenantId_type_status_spentAt_idx" ON "Expense"("tenantId", "type", "status", "spentAt");

CREATE INDEX IF NOT EXISTS "Attendance_tenantId_labourId_workDate_idx" ON "Attendance"("tenantId", "labourId", "workDate");

CREATE INDEX IF NOT EXISTS "SalaryPayment_tenantId_labourId_paidAt_idx" ON "SalaryPayment"("tenantId", "labourId", "paidAt");
CREATE INDEX IF NOT EXISTS "SalaryPayment_tenantId_period_idx" ON "SalaryPayment"("tenantId", "period");

CREATE INDEX IF NOT EXISTS "Vehicle_tenantId_active_idx" ON "Vehicle"("tenantId", "active");
CREATE INDEX IF NOT EXISTS "Vehicle_tenantId_driverPhone_idx" ON "Vehicle"("tenantId", "driverPhone");

CREATE INDEX IF NOT EXISTS "Route_tenantId_active_idx" ON "Route"("tenantId", "active");
CREATE INDEX IF NOT EXISTS "Route_tenantId_vehicleId_idx" ON "Route"("tenantId", "vehicleId");
