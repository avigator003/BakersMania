import { reportsRepository } from "./reports.repository.js";

export const reportsService = {
  async getDashboard(tenantId: string) {
    const [
      activeOrders,
      stockItems,
      products,
      customers,
      activeLabours,
      todayAttendance,
      expenses,
      purchases,
      sellerPayments,
      customerPayments,
      materialLedger,
      monthlyOrders
    ] =
      await reportsRepository.getDashboardData(tenantId);

    const openOrders = activeOrders.filter((order) => order.status !== "CANCELED");
    const lowRawMaterials = stockItems.filter((item) => Number(item.stockOnHand) <= Number(item.reorderAt)).length;
    const lowProducts = products.filter((product) => Number(product.stockOnHand) < 100).length;
    const pendingPaymentsAmount = openOrders.reduce((sum, order) => {
      const paid = order.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0);
      return sum + Math.max(Number(order.grandTotal || 0) - paid, 0);
    }, 0);
    const presentLabours = new Set(
      todayAttendance
        .filter((attendance) => ["PRESENT", "HALF_DAY"].includes(attendance.status))
        .map((attendance) => attendance.labourId)
        .filter(Boolean)
    ).size;
    const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const paidExpenses = expenses
      .filter((expense) => expense.status === "PAID")
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const pendingExpenses = expenses
      .filter((expense) => expense.status === "PENDING")
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const rentTotal = expenses
      .filter((expense) => expense.type === "RENT")
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const sellerPaymentTotal = sellerPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const customerPaymentTotal = customerPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const rawMaterialExpenseTotal = purchases.reduce((sum, purchase) => sum + Number(purchase.amount || 0), 0);
    const materialBuyQuantity = materialLedger
      .filter((entry) => entry.type === "BUY")
      .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
    const materialUseQuantity = materialLedger
      .filter((entry) => entry.type === "USE")
      .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
    const materialBuyAmount = materialLedger
      .filter((entry) => entry.type === "BUY")
      .reduce((sum, entry) => sum + Number(entry.totalAmount || 0), 0);
    const now = new Date();
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const salesByDay = new Map<number, { sales: number; orders: number }>();
    monthlyOrders.forEach((order) => {
      const orderDate = order.dueAt || order.createdAt;
      const day = orderDate.getUTCDate();
      const current = salesByDay.get(day) || { sales: 0, orders: 0 };
      current.sales += Number(order.grandTotal || 0);
      current.orders += 1;
      salesByDay.set(day, current);
    });
    const salesChart = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const current = salesByDay.get(day) || { sales: 0, orders: 0 };
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
      return {
        date: date.toISOString().slice(0, 10),
        label: String(day).padStart(2, "0"),
        sales: current.sales,
        orders: current.orders
      };
    });

    const requiredByProduct = new Map<string, { productId: string; name: string; required: number; stock: number }>();
    openOrders.forEach((order) => {
      order.items.forEach((item) => {
        const productId = item.productId;
        const existing = requiredByProduct.get(productId) || {
          productId,
          name: item.product?.name || item.name,
          required: 0,
          stock: Number(item.product?.stockOnHand || 0)
        };
        existing.required += Number(item.quantity || 0);
        existing.stock = Number(item.product?.stockOnHand || existing.stock || 0);
        requiredByProduct.set(productId, existing);
      });
    });

    return {
      ordersDue: openOrders.length,
      pendingPaymentsAmount,
      lowStock: lowRawMaterials + lowProducts,
      customers,
      products: products.length,
      labour: {
        present: presentLabours,
        total: activeLabours
      },
      finance: {
        expenses: expenseTotal,
        paidExpenses,
        pendingExpenses,
        rents: rentTotal,
        sellerPayments: sellerPaymentTotal,
        customerPayments: customerPaymentTotal,
        rawMaterialExpenses: rawMaterialExpenseTotal
      },
      stockMovement: {
        boughtQuantity: materialBuyQuantity,
        usedQuantity: materialUseQuantity,
        boughtAmount: materialBuyAmount
      },
      salesChart: {
        total: salesChart.reduce((sum, day) => sum + day.sales, 0),
        orders: salesChart.reduce((sum, day) => sum + day.orders, 0),
        days: salesChart
      },
      lowProductStocks: products
        .filter((product) => Number(product.stockOnHand) < 100)
        .sort((first, second) => Number(first.stockOnHand) - Number(second.stockOnHand))
        .slice(0, 8)
        .map((product) => ({
          id: product.id,
          name: product.name,
          stockOnHand: Number(product.stockOnHand || 0)
        })),
      orderedWithoutStock: Array.from(requiredByProduct.values())
        .filter((item) => item.stock <= 0 || item.required > item.stock)
        .sort((first, second) => first.stock - second.stock || second.required - first.required)
        .slice(0, 8)
        .map((item) => ({
          productId: item.productId,
          name: item.name,
          required: item.required,
          stockOnHand: item.stock,
          shortage: Math.max(item.required - item.stock, 0)
        }))
    };
  }
};
