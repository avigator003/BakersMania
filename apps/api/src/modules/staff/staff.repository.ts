import { prisma } from "../../db/prisma.js";
import type { AttendanceInput, LabourInput, LabourUpdateInput, SalaryPaymentInput } from "./staff.schemas.js";

export const staffRepository = {
  listLabourDashboard(tenantId: string, attendanceDate?: Date) {
    const day = attendanceDate || new Date();
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const monthStart = new Date(day.getFullYear(), day.getMonth(), 1);

    return Promise.all([
      prisma.labour.findMany({
        where: { tenantId },
        orderBy: [{ active: "desc" }, { createdAt: "desc" }],
        include: {
          attendance: { orderBy: { workDate: "desc" }, take: 5 },
          salaryPayments: { orderBy: { paidAt: "desc" }, take: 5 }
        }
      }),
      prisma.attendance.findMany({
        where: { tenantId, workDate: { gte: day, lt: nextDay } },
        include: { labour: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.salaryPayment.findMany({
        where: { tenantId, paidAt: { gte: monthStart } },
        include: { labour: true },
        orderBy: { paidAt: "desc" }
      }),
      prisma.attendance.findMany({
        where: { tenantId },
        include: { labour: true },
        orderBy: { workDate: "desc" },
        take: 30
      }),
      prisma.salaryPayment.findMany({
        where: { tenantId },
        include: { labour: true },
        orderBy: { paidAt: "desc" },
        take: 30
      })
    ]);
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
