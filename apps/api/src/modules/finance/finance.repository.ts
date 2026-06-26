import { prisma } from "../../db/prisma.js";
import type { ExpenseInput, ExpenseStatusInput } from "./finance.schemas.js";

function monthFromDate(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function resolveMonthRange(month?: string) {
  if (!month) return {};
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { gte: start, lt: end };
}

export const financeRepository = {
  async carryRecurringExpenses(tenantId: string, month: string) {
    const monthDate = new Date(`${month}-01T00:00:00.000Z`);
    const roots = await prisma.expense.findMany({
      where: {
        tenantId,
        recurring: true,
        recurringRootId: null,
        recurringActive: true,
        OR: [{ periodMonth: null }, { periodMonth: { lte: month } }]
      }
    });

    await Promise.all(
      roots.map(async (root) => {
        const existing = await prisma.expense.findFirst({
          where: {
            tenantId,
            periodMonth: month,
            OR: [{ id: root.id }, { recurringRootId: root.id }]
          },
          select: { id: true }
        });
        if (existing) return null;
        return prisma.expense.create({
          data: {
            tenantId,
            routeId: root.routeId,
            type: root.type,
            category: root.category,
            status: "PENDING",
            recurring: true,
            recurringRootId: root.id,
            recurringActive: true,
            periodMonth: month,
            amount: root.amount,
            notes: root.notes,
            spentAt: monthDate
          }
        });
      })
    );
  },

  async listExpenses(tenantId: string, filters: { month?: string; type?: string; status?: string } = {}) {
    const periodMonth = filters.month || monthFromDate();
    await this.carryRecurringExpenses(tenantId, periodMonth);
    const spentAt = resolveMonthRange(filters.month);
    return prisma.expense.findMany({
      where: {
        tenantId,
        periodMonth,
        ...(Object.keys(spentAt).length ? { spentAt } : {}),
        ...(filters.type && filters.type !== "all" ? { type: filters.type } : {}),
        ...(filters.status && filters.status !== "all" ? { status: filters.status } : {})
      },
      include: { route: { include: { vehicle: true } } },
      orderBy: { spentAt: "desc" }
    });
  },

  createExpense(tenantId: string, input: ExpenseInput) {
    return prisma.expense.create({
      data: {
        tenantId,
        type: input.type,
        category: input.category,
        routeId: input.routeId,
        status: input.status,
        recurring: input.recurring,
        recurringRootId: null,
        recurringActive: true,
        periodMonth: monthFromDate(input.spentAt),
        amount: input.amount,
        notes: input.notes,
        spentAt: input.spentAt
      },
      include: { route: { include: { vehicle: true } } }
    });
  },

  findRoute(tenantId: string, routeId: string) {
    return prisma.route.findFirst({ where: { tenantId, id: routeId } });
  },

  findExpense(tenantId: string, expenseId: string) {
    return prisma.expense.findFirst({ where: { tenantId, id: expenseId } });
  },

  updateExpenseStatus(tenantId: string, expenseId: string, input: ExpenseStatusInput) {
    return prisma.expense.update({
      where: { id: expenseId },
      data: { status: input.status },
      include: { route: { include: { vehicle: true } } }
    });
  }
};
