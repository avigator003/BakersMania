import { HttpError } from "../../utils/http.js";
import { financeRepository } from "./finance.repository.js";
import type { ExpenseListFilters } from "./finance.repository.js";
import type { ExpenseInput, ExpenseStatusInput } from "./finance.schemas.js";

export const financeService = {
  listExpenses(tenantId: string, filters: ExpenseListFilters) {
    return financeRepository.listExpenses(tenantId, filters);
  },

  async createExpense(tenantId: string, input: ExpenseInput) {
    if (input.type === "RENT" && !input.routeId) {
      throw new HttpError(400, "Route is required for rent expense");
    }
    if (input.routeId) {
      const route = await financeRepository.findRoute(tenantId, input.routeId);
      if (!route) {
        throw new HttpError(404, "Route not found");
      }
    }
    return financeRepository.createExpense(tenantId, input);
  },

  async updateExpenseStatus(tenantId: string, expenseId: string, input: ExpenseStatusInput) {
    const expense = await financeRepository.findExpense(tenantId, expenseId);
    if (!expense) {
      throw new HttpError(404, "Expense not found");
    }
    return financeRepository.updateExpenseStatus(tenantId, expenseId, input);
  }
};
