CREATE TABLE "Labour" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "BakeryRole" NOT NULL DEFAULT 'LABOURER',
    "skill" TEXT,
    "dailyWage" DECIMAL(12,2),
    "monthlySalary" DECIMAL(12,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Labour_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Attendance"
ADD COLUMN "labourId" TEXT;

ALTER TABLE "SalaryPayment"
ADD COLUMN "labourId" TEXT,
ADD COLUMN "paymentType" TEXT NOT NULL DEFAULT 'FULL',
ADD COLUMN "reason" TEXT,
ADD COLUMN "method" TEXT,
ADD COLUMN "reference" TEXT;

CREATE INDEX "Labour_tenantId_active_idx" ON "Labour"("tenantId", "active");
CREATE INDEX "Labour_tenantId_role_idx" ON "Labour"("tenantId", "role");
CREATE INDEX "Attendance_tenantId_labourId_idx" ON "Attendance"("tenantId", "labourId");
CREATE INDEX "SalaryPayment_tenantId_labourId_idx" ON "SalaryPayment"("tenantId", "labourId");

ALTER TABLE "Labour" ADD CONSTRAINT "Labour_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_labourId_fkey" FOREIGN KEY ("labourId") REFERENCES "Labour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_labourId_fkey" FOREIGN KEY ("labourId") REFERENCES "Labour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
