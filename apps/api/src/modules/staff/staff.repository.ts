import { prisma } from "../../db/prisma.js";
import { pagination, paginationMeta, type PaginationInput } from "../../utils/pagination.js";
import type { AttendanceInput, LabourInput, LabourUpdateInput, SalaryPaymentInput } from "./staff.schemas.js";

export type LabourDashboardFilters = PaginationInput & {
  search?: string;
  status?: string;
};

export const staffRepository = {
  async listLabourDashboard(tenantId: string, attendanceDate?: Date, filters: LabourDashboardFilters = {}) {
    const day = attendanceDate || new Date();
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const monthStart = new Date(day.getFullYear(), day.getMonth(), 1);
    const nextMonth = new Date(day.getFullYear(), day.getMonth() + 1, 1);
    const { page, pageSize, skip } = pagination(filters);
    const search = filters.search?.trim();
    const labourWhere = {
      tenantId,
      ...(filters.status === "active" ? { active: true } : filters.status === "inactive" ? { active: false } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
              { skill: { contains: search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [labours, total, totalLabour, activeLabour, todayAttendance, paymentsThisMonth] = await Promise.all([
      prisma.labour.findMany({
        where: labourWhere,
        orderBy: [{ active: "desc" }, { createdAt: "desc" }],
        include: {
          attendance: { where: { workDate: { lt: nextMonth } }, orderBy: { workDate: "desc" } },
          salaryPayments: { where: { paidAt: { lt: nextMonth } }, orderBy: { paidAt: "desc" } }
        },
        skip,
        take: pageSize
      }),
      prisma.labour.count({ where: labourWhere }),
      prisma.labour.count({ where: { tenantId } }),
      prisma.labour.count({ where: { tenantId, active: true } }),
      prisma.attendance.findMany({
        where: { tenantId, workDate: { gte: day, lt: nextDay } },
        include: { labour: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.salaryPayment.findMany({
        where: { tenantId, paidAt: { gte: monthStart, lt: nextMonth } },
        include: { labour: true },
        orderBy: { paidAt: "desc" }
      })
    ]);
    return {
      labours,
      pagination: paginationMeta(total, page, pageSize),
      totalLabour,
      activeLabour,
      todayAttendance,
      paymentsThisMonth
    };
  },

  createLabour(tenantId: string, input: LabourInput) {
    return prisma.labour.create({ data: { ...input, tenantId } });
  },

  getLabourYearExport(tenantId: string, from: Date, to: Date) {
    return prisma.labour.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        attendance: { where: { workDate: { gte: from, lt: to } }, orderBy: { workDate: "asc" } },
        salaryPayments: { where: { paidAt: { gte: from, lt: to } }, orderBy: { paidAt: "asc" } }
      }
    });
  },

  async updateLabour(tenantId: string, labourId: string, input: LabourUpdateInput) {
    const existing = await prisma.labour.findFirst({ where: { id: labourId, tenantId }, select: { id: true } });
    if (!existing) return null;
    return prisma.labour.update({ where: { id: labourId }, data: input });
  },

  getLabourDetail(tenantId: string, labourId: string, from: Date, to: Date) {
    return Promise.all([
      prisma.labour.findFirst({
        where: { id: labourId, tenantId },
        include: {
          attendance: { where: { workDate: { gte: from, lt: to } }, orderBy: { workDate: "asc" } },
          salaryPayments: { where: { paidAt: { gte: from, lt: to } }, orderBy: { paidAt: "desc" } }
        }
      }),
      prisma.attendance.findMany({
        where: { tenantId, labourId, workDate: { gte: from, lt: to } },
        orderBy: { workDate: "asc" }
      }),
      prisma.salaryPayment.findMany({
        where: { tenantId, labourId, paidAt: { gte: from, lt: to } },
        orderBy: { paidAt: "desc" }
      }),
      prisma.attendance.findMany({
        where: { tenantId, labourId, workDate: { lt: to } },
        orderBy: { workDate: "asc" }
      }),
      prisma.salaryPayment.findMany({
        where: { tenantId, labourId, paidAt: { lt: to } },
        orderBy: { paidAt: "asc" }
      })
    ]);
  },

  async createAttendance(tenantId: string, input: AttendanceInput) {
    const day = new Date(input.workDate);
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const existing = await prisma.attendance.findFirst({
      where: {
        tenantId,
        labourId: input.labourId,
        workDate: { gte: day, lt: nextDay }
      }
    });

    if (existing) {
      return prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          notes: input.notes,
          userId: input.userId || "",
          workDate: day
        }
      });
    }

    return prisma.attendance.create({ data: { ...input, userId: input.userId || "", workDate: day, tenantId } });
  },

  createSalaryPayment(tenantId: string, input: SalaryPaymentInput) {
    return prisma.salaryPayment.create({ data: { ...input, tenantId } });
  }
};
