import { staffRepository } from "./staff.repository.js";
import type { LabourDashboardFilters } from "./staff.repository.js";
import type { AttendanceInput, LabourInput, LabourUpdateInput, SalaryPaymentInput } from "./staff.schemas.js";

function monthRange(month?: string) {
  const [yearValue, monthValue] = (month || "").split("-").map(Number);
  const now = new Date();
  const year = Number.isFinite(yearValue) ? yearValue : now.getFullYear();
  const monthIndex = Number.isFinite(monthValue) ? monthValue - 1 : now.getMonth();
  return {
    from: new Date(year, monthIndex, 1),
    to: new Date(year, monthIndex + 1, 1),
    label: `${year}-${String(monthIndex + 1).padStart(2, "0")}`
  };
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / 86400000));
}

function nextMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function yearRange(year?: string) {
  const parsedYear = Number(year);
  const now = new Date();
  const safeYear = Number.isFinite(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : now.getFullYear();
  return {
    year: safeYear,
    from: new Date(safeYear, 0, 1),
    to: new Date(safeYear + 1, 0, 1)
  };
}

const attendanceStatuses = ["PRESENT", "HALF_DAY", "ABSENT", "PAID_LEAVE", "UNPAID_LEAVE"] as const;
const paymentTypes = ["ADVANCE", "PARTIAL", "FULL"] as const;

function emptyAttendanceCounts() {
  return Object.fromEntries(attendanceStatuses.map((status) => [status, 0])) as Record<(typeof attendanceStatuses)[number], number>;
}

function emptyPaymentCounts() {
  return Object.fromEntries(paymentTypes.map((type) => [type, 0])) as Record<(typeof paymentTypes)[number], number>;
}

function payableAttendanceDays(attendance: Array<{ workDate: Date; status: string }>, joinedAt: Date, monthStart: Date, monthEnd: Date) {
  const eligibleStart = dayStart(joinedAt) > dayStart(monthStart) ? dayStart(joinedAt) : dayStart(monthStart);
  return attendance.reduce((sum, item) => {
    const workDate = dayStart(item.workDate);
    if (workDate < eligibleStart || workDate >= monthEnd) return sum;
    if (item.status === "PRESENT" || item.status === "PAID_LEAVE") return sum + 1;
    if (item.status === "HALF_DAY") return sum + 0.5;
    return sum;
  }, 0);
}

function salaryCalculation(input: {
  monthlySalary?: unknown;
  joinedAt: Date;
  attendance: Array<{ workDate: Date; status: string }>;
  payments: Array<{ amount: unknown; paidAt: Date }>;
  monthStart: Date;
  monthEnd: Date;
}) {
  const monthlySalary = Number(input.monthlySalary || 0);
  let cursor = new Date(input.joinedAt.getFullYear(), input.joinedAt.getMonth(), 1);
  let carryForwardAmount = 0;
  let selected = {
    daysInMonth: daysBetween(input.monthStart, input.monthEnd),
    eligibleDays: 0,
    payableDays: 0,
    dailySalary: 0,
    payableAmount: 0,
    paidAmount: 0,
    openingAdvanceAmount: 0,
    advanceAppliedAmount: 0,
    carryForwardAmount: 0,
    balanceAmount: 0
  };

  while (cursor < input.monthEnd) {
    const cursorEnd = nextMonth(cursor);
    const eligibleStart = dayStart(input.joinedAt) > dayStart(cursor) ? dayStart(input.joinedAt) : dayStart(cursor);
    const eligibleDays = input.joinedAt >= cursorEnd ? 0 : daysBetween(eligibleStart, cursorEnd);
    const payableDays = payableAttendanceDays(input.attendance, input.joinedAt, cursor, cursorEnd);
    const daysInMonth = daysBetween(cursor, cursorEnd);
    const dailySalary = daysInMonth ? monthlySalary / daysInMonth : 0;
    const payableAmount = Math.round(dailySalary * payableDays);
    const paidAmount = input.payments
      .filter((payment) => payment.paidAt >= cursor && payment.paidAt < cursorEnd)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const openingAdvanceAmount = carryForwardAmount;
    const advanceAppliedAmount = Math.min(openingAdvanceAmount, payableAmount);
    const balanceAmount = Math.max(payableAmount - advanceAppliedAmount - paidAmount, 0);
    carryForwardAmount = Math.max(openingAdvanceAmount + paidAmount - payableAmount, 0);

    if (cursor.getFullYear() === input.monthStart.getFullYear() && cursor.getMonth() === input.monthStart.getMonth()) {
      selected = {
        daysInMonth,
        eligibleDays,
        payableDays,
        dailySalary,
        payableAmount,
        paidAmount,
        openingAdvanceAmount,
        advanceAppliedAmount,
        carryForwardAmount,
        balanceAmount
      };
    }

    cursor = cursorEnd;
  }

  return {
    monthlySalary,
    ...selected
  };
}

export const staffService = {
  async listLabourDashboard(tenantId: string, attendanceDate?: Date, filters: LabourDashboardFilters = {}) {
    const dashboard = await staffRepository.listLabourDashboard(tenantId, attendanceDate, filters);
    const { labours, todayAttendance, paymentsThisMonth, recentAttendance, recentPayments } = dashboard;

    const stats = {
      totalLabour: dashboard.totalLabour,
      activeLabour: dashboard.activeLabour,
      presentToday: todayAttendance.filter((attendance) => attendance.status === "PRESENT").length,
      absentToday: todayAttendance.filter((attendance) => attendance.status === "ABSENT").length,
      paymentThisMonth: paymentsThisMonth.reduce((sum, payment) => sum + Number(payment.amount), 0),
      advanceThisMonth: paymentsThisMonth
        .filter((payment) => payment.paymentType === "ADVANCE")
        .reduce((sum, payment) => sum + Number(payment.amount), 0),
      partialThisMonth: paymentsThisMonth
        .filter((payment) => payment.paymentType === "PARTIAL")
        .reduce((sum, payment) => sum + Number(payment.amount), 0)
    };

    const selectedMonth = monthRange(attendanceDate ? `${attendanceDate.getFullYear()}-${String(attendanceDate.getMonth() + 1).padStart(2, "0")}` : undefined);
    const laboursWithSalary = labours.map((labour) => ({
      ...labour,
      salaryCalculation: salaryCalculation({
        monthlySalary: labour.monthlySalary,
        joinedAt: labour.joinedAt,
        attendance: labour.attendance,
        payments: labour.salaryPayments,
        monthStart: selectedMonth.from,
        monthEnd: selectedMonth.to
      })
    }));

    return { stats, labours: laboursWithSalary, todayAttendance, recentAttendance, recentPayments, pagination: dashboard.pagination };
  },

  createLabour(tenantId: string, input: LabourInput) {
    return staffRepository.createLabour(tenantId, input);
  },

  async getLabourYearExport(tenant: NonNullable<Express.Request["tenant"]>, year?: string) {
    const range = yearRange(year);
    const labours = await staffRepository.getLabourYearExport(tenant.id, range.from, range.to);

    const monthly = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(range.year, index, 1)),
      attendance: emptyAttendanceCounts(),
      payments: { total: 0, byType: emptyPaymentCounts() }
    }));

    const labourSummaries = labours.map((labour) => {
      const attendance = emptyAttendanceCounts();
      const payments = { total: 0, byType: emptyPaymentCounts() };
      const byMonth = monthly.map((month) => ({
        month: month.month,
        label: month.label,
        attendance: emptyAttendanceCounts(),
        payments: { total: 0, byType: emptyPaymentCounts() }
      }));

      labour.attendance.forEach((item) => {
        const status = attendanceStatuses.includes(item.status as (typeof attendanceStatuses)[number])
          ? (item.status as (typeof attendanceStatuses)[number])
          : "PRESENT";
        const monthIndex = item.workDate.getMonth();
        attendance[status] += 1;
        monthly[monthIndex].attendance[status] += 1;
        byMonth[monthIndex].attendance[status] += 1;
      });

      labour.salaryPayments.forEach((payment) => {
        const type = paymentTypes.includes(payment.paymentType as (typeof paymentTypes)[number])
          ? (payment.paymentType as (typeof paymentTypes)[number])
          : "FULL";
        const amount = Number(payment.amount);
        const monthIndex = payment.paidAt.getMonth();
        payments.total += amount;
        payments.byType[type] += amount;
        monthly[monthIndex].payments.total += amount;
        monthly[monthIndex].payments.byType[type] += amount;
        byMonth[monthIndex].payments.total += amount;
        byMonth[monthIndex].payments.byType[type] += amount;
      });

      return {
        id: labour.id,
        name: labour.name,
        phone: labour.phone,
        role: labour.role,
        skill: labour.skill,
        active: labour.active,
        dailyWage: labour.dailyWage,
        monthlySalary: labour.monthlySalary,
        joinedAt: labour.joinedAt,
        notes: labour.notes,
        attendance,
        payments,
        byMonth
      };
    });

    const totals = labourSummaries.reduce(
      (summary, labour) => {
        attendanceStatuses.forEach((status) => {
          summary.attendance[status] += labour.attendance[status];
        });
        paymentTypes.forEach((type) => {
          summary.payments.byType[type] += labour.payments.byType[type];
        });
        summary.payments.total += labour.payments.total;
        return summary;
      },
      { attendance: emptyAttendanceCounts(), payments: { total: 0, byType: emptyPaymentCounts() } }
    );

    return {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      year: range.year,
      generatedAt: new Date(),
      totals: {
        totalLabour: labours.length,
        activeLabour: labours.filter((labour) => labour.active).length,
        inactiveLabour: labours.filter((labour) => !labour.active).length,
        attendance: totals.attendance,
        payments: totals.payments
      },
      monthly,
      labourSummaries,
      attendanceRows: labours.flatMap((labour) =>
        labour.attendance.map((attendance) => ({
          id: attendance.id,
          labourId: labour.id,
          labourName: labour.name,
          workDate: attendance.workDate,
          status: attendance.status,
          notes: attendance.notes
        }))
      ),
      paymentRows: labours.flatMap((labour) =>
        labour.salaryPayments.map((payment) => ({
          id: payment.id,
          labourId: labour.id,
          labourName: labour.name,
          amount: payment.amount,
          period: payment.period,
          paymentType: payment.paymentType,
          reason: payment.reason,
          method: payment.method,
          reference: payment.reference,
          paidAt: payment.paidAt,
          notes: payment.notes
        }))
      )
    };
  },

  updateLabour(tenantId: string, labourId: string, input: LabourUpdateInput) {
    return staffRepository.updateLabour(tenantId, labourId, input);
  },

  async getLabourDetail(tenantId: string, labourId: string, month?: string) {
    const range = monthRange(month);
    const [labour, attendance, payments, calculationAttendance, calculationPayments] = await staffRepository.getLabourDetail(tenantId, labourId, range.from, range.to);

    if (!labour) {
      return null;
    }

    const calculation = salaryCalculation({
      monthlySalary: labour.monthlySalary,
      joinedAt: labour.joinedAt,
      attendance: calculationAttendance,
      payments: calculationPayments,
      monthStart: range.from,
      monthEnd: range.to
    });

    const stats = {
      presentDays: attendance.filter((item) => item.status === "PRESENT").length,
      halfDays: attendance.filter((item) => item.status === "HALF_DAY").length,
      absentDays: attendance.filter((item) => item.status === "ABSENT").length,
      leaveDays: attendance.filter((item) => item.status === "PAID_LEAVE" || item.status === "UNPAID_LEAVE").length,
      daysInMonth: calculation.daysInMonth,
      eligibleDays: calculation.eligibleDays,
      payableDays: calculation.payableDays,
      dailySalary: calculation.dailySalary,
      payableAmount: calculation.payableAmount,
      paidAmount: calculation.paidAmount,
      openingAdvanceAmount: calculation.openingAdvanceAmount,
      advanceAppliedAmount: calculation.advanceAppliedAmount,
      carryForwardAmount: calculation.carryForwardAmount,
      balanceAmount: calculation.balanceAmount,
      totalPaid: payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
      advancePaid: payments.filter((payment) => payment.paymentType === "ADVANCE").reduce((sum, payment) => sum + Number(payment.amount), 0),
      partialPaid: payments.filter((payment) => payment.paymentType === "PARTIAL").reduce((sum, payment) => sum + Number(payment.amount), 0),
      fullPaid: payments.filter((payment) => payment.paymentType === "FULL").reduce((sum, payment) => sum + Number(payment.amount), 0)
    };

    return {
      month: range.label,
      labour,
      stats,
      attendance,
      payments,
      absentDates: attendance.filter((item) => item.status === "ABSENT").map((item) => item.workDate),
      halfDayDates: attendance.filter((item) => item.status === "HALF_DAY").map((item) => item.workDate)
    };
  },

  createAttendance(tenantId: string, input: AttendanceInput) {
    return staffRepository.createAttendance(tenantId, input);
  },

  createSalaryPayment(tenantId: string, input: SalaryPaymentInput) {
    return staffRepository.createSalaryPayment(tenantId, input);
  }
};
