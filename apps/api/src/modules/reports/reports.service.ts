import { reportsRepository } from "./reports.repository.js";

export const reportsService = {
  async getDashboard(tenantId: string) {
    const data = await reportsRepository.getDashboardData(tenantId);
    const {
      activeOrders,
      lowRawMaterials,
      products,
      customers,
      activeLabours,
      todayAttendance,
      expenseGroups,
      rawMaterialExpenses,
      sellerPayments,
      customerPayments,
      materialLedgerGroups,
      salesRows,
      ordersDue,
      pendingPaymentsAmount
    } = data;

    const openOrders = activeOrders.filter((order) => order.status !== "CANCELED");
    const lowProducts = products.filter((product) => Number(product.stockOnHand) < 100).length;
    const presentLabours = new Set(
      todayAttendance
        .filter((attendance) => ["PRESENT", "HALF_DAY"].includes(attendance.status))
        .map((attendance) => attendance.labourId)
        .filter(Boolean)
    ).size;
    const expenseTotal = expenseGroups.reduce((sum, row) => sum + Number(row._sum.amount || 0), 0);
    const paidExpenses = expenseGroups.filter((row) => row.status === "PAID").reduce((sum, row) => sum + Number(row._sum.amount || 0), 0);
    const pendingExpenses = expenseGroups.filter((row) => row.status === "PENDING").reduce((sum, row) => sum + Number(row._sum.amount || 0), 0);
    const rentTotal = expenseGroups.filter((row) => row.type === "RENT").reduce((sum, row) => sum + Number(row._sum.amount || 0), 0);
    const materialBuyRow = materialLedgerGroups.find((row) => row.type === "BUY");
    const materialUseRow = materialLedgerGroups.find((row) => row.type === "USE");
    const materialBuyQuantity = Number(materialBuyRow?._sum.quantity || 0);
    const materialUseQuantity = Number(materialUseRow?._sum.quantity || 0);
    const materialBuyAmount = Number(materialBuyRow?._sum.totalAmount || 0);
    const now = new Date();
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const salesByDay = new Map<number, { sales: number; orders: number }>();
    salesRows.forEach((row) => {
      salesByDay.set(row.day, { sales: Number(row.sales || 0), orders: Number(row.orders || 0) });
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
      ordersDue,
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
        sellerPayments,
        customerPayments,
        rawMaterialExpenses
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
