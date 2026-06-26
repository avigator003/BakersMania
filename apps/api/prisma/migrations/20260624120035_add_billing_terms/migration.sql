-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "BillingRecurrence" AS ENUM ('MONTHLY', 'EVERY_2_MONTHS', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "billingStatus" "BillingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "lastPaymentAmount" DECIMAL(12,2),
ADD COLUMN     "lastPaymentDate" TIMESTAMP(3),
ADD COLUMN     "monthlyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "nextDueDate" TIMESTAMP(3),
ADD COLUMN     "recurrence" "BillingRecurrence" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "recurrenceMonths" INTEGER NOT NULL DEFAULT 1;
