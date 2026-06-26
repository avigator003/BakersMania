import { authFetch } from "./api";

type AttendanceStatus = "PRESENT" | "HALF_DAY" | "ABSENT" | "PAID_LEAVE" | "UNPAID_LEAVE";
type PaymentType = "ADVANCE" | "PARTIAL" | "FULL";

type CountMap = Record<AttendanceStatus, number>;
type PaymentMap = Record<PaymentType, number>;

export type LabourYearExport = {
  tenant: { name: string; slug: string };
  year: number;
  generatedAt: string;
  totals: {
    totalLabour: number;
    activeLabour: number;
    inactiveLabour: number;
    attendance: CountMap;
    payments: { total: number; byType: PaymentMap };
  };
  monthly: Array<{
    month: number;
    label: string;
    attendance: CountMap;
    payments: { total: number; byType: PaymentMap };
  }>;
  labourSummaries: Array<{
    id: string;
    name: string;
    phone?: string | null;
    role: string;
    active: boolean;
    dailyWage?: string | number | null;
    monthlySalary?: string | number | null;
    joinedAt: string;
    notes?: string | null;
    attendance: CountMap;
    payments: { total: number; byType: PaymentMap };
    byMonth: Array<{
      month: number;
      label: string;
      attendance: CountMap;
      payments: { total: number; byType: PaymentMap };
    }>;
  }>;
  attendanceRows: Array<{
    labourName: string;
    workDate: string;
    status: AttendanceStatus;
    notes?: string | null;
  }>;
  paymentRows: Array<{
    labourName: string;
    amount: string | number;
    period: string;
    paymentType: PaymentType;
    reason?: string | null;
    method?: string | null;
    reference?: string | null;
    paidAt: string;
    notes?: string | null;
  }>;
};

type CellValue = string | number | null | undefined;

const attendanceStatuses: AttendanceStatus[] = ["PRESENT", "HALF_DAY", "ABSENT", "PAID_LEAVE", "UNPAID_LEAVE"];

export async function fetchLabourYearExport(tenantSlug: string, year: number) {
  return authFetch<LabourYearExport>(`/t/${tenantSlug}/staff/labour/export/year?year=${year}`);
}

export function downloadLabourOverviewWorkbook(data: LabourYearExport) {
  const rows = [
    ["Bakery", data.tenant.name],
    ["Year", data.year],
    ["Generated at", formatDateTime(data.generatedAt)],
    [],
    ["Overall Labour Scenario"],
    ["Total labour", data.totals.totalLabour],
    ["Active labour", data.totals.activeLabour],
    ["Inactive labour", data.totals.inactiveLabour],
    ["Full days", data.totals.attendance.PRESENT],
    ["Half days", data.totals.attendance.HALF_DAY],
    ["Absent days", data.totals.attendance.ABSENT],
    ["Paid leave", data.totals.attendance.PAID_LEAVE],
    ["Unpaid leave", data.totals.attendance.UNPAID_LEAVE],
    ["Total paid", data.totals.payments.total],
    ["Advance paid", data.totals.payments.byType.ADVANCE],
    ["Partial paid", data.totals.payments.byType.PARTIAL],
    ["Full salary paid", data.totals.payments.byType.FULL]
  ];

  const workbook = toWorkbook([
    {
      name: "Overall",
      rows
    },
    {
      name: "Labour Summary",
      rows: [
        ["Labour", "Phone", "Status", "Daily wage", "Monthly salary", "Joined", "Full days", "Half days", "Absent", "Paid leave", "Unpaid leave", "Total paid", "Advance", "Partial", "Full salary", "Notes"],
        ...data.labourSummaries.map((labour) => [
          labour.name,
          labour.phone || "",
          labour.active ? "Active" : "Inactive",
          toNumber(labour.dailyWage),
          toNumber(labour.monthlySalary),
          formatDate(labour.joinedAt),
          labour.attendance.PRESENT,
          labour.attendance.HALF_DAY,
          labour.attendance.ABSENT,
          labour.attendance.PAID_LEAVE,
          labour.attendance.UNPAID_LEAVE,
          labour.payments.total,
          labour.payments.byType.ADVANCE,
          labour.payments.byType.PARTIAL,
          labour.payments.byType.FULL,
          labour.notes || ""
        ])
      ]
    },
    {
      name: "Month Summary",
      rows: [
        ["Month", "Full days", "Half days", "Absent", "Paid leave", "Unpaid leave", "Total paid", "Advance", "Partial", "Full salary"],
        ...data.monthly.map((month) => [
          month.label,
          month.attendance.PRESENT,
          month.attendance.HALF_DAY,
          month.attendance.ABSENT,
          month.attendance.PAID_LEAVE,
          month.attendance.UNPAID_LEAVE,
          month.payments.total,
          month.payments.byType.ADVANCE,
          month.payments.byType.PARTIAL,
          month.payments.byType.FULL
        ])
      ]
    },
    {
      name: "Payment Records",
      rows: [
        ["Labour", "Paid date", "Salary period", "Amount", "Type", "Method", "Reason", "Reference", "Notes"],
        ...data.paymentRows.map((payment) => [
          payment.labourName,
          formatDate(payment.paidAt),
          payment.period,
          toNumber(payment.amount),
          payment.paymentType,
          payment.method || "",
          payment.reason || "",
          payment.reference || "",
          payment.notes || ""
        ])
      ]
    }
  ]);

  downloadWorkbook(workbook, `${data.tenant.slug}-labour-overview-${data.year}.xls`);
}

export function downloadLabourAttendanceWorkbook(data: LabourYearExport) {
  const monthHeaders = data.monthly.flatMap((month) => [
    `${month.label} Full`,
    `${month.label} Half`,
    `${month.label} Absent`,
    `${month.label} Leave`
  ]);

  const workbook = toWorkbook([
    {
      name: "Year Attendance",
      rows: [
        ["Bakery", data.tenant.name],
        ["Year", data.year],
        ["Generated at", formatDateTime(data.generatedAt)],
        [],
        ["Total labour", data.totals.totalLabour],
        ["Active labour", data.totals.activeLabour],
        ["Full days", data.totals.attendance.PRESENT],
        ["Half days", data.totals.attendance.HALF_DAY],
        ["Absent days", data.totals.attendance.ABSENT],
        ["Leave days", data.totals.attendance.PAID_LEAVE + data.totals.attendance.UNPAID_LEAVE]
      ]
    },
    {
      name: "Month By Month",
      rows: [
        ["Labour", "Status", ...monthHeaders],
        ...data.labourSummaries.map((labour) => [
          labour.name,
          labour.active ? "Active" : "Inactive",
          ...labour.byMonth.flatMap((month) => [
            month.attendance.PRESENT,
            month.attendance.HALF_DAY,
            month.attendance.ABSENT,
            month.attendance.PAID_LEAVE + month.attendance.UNPAID_LEAVE
          ])
        ])
      ]
    },
    {
      name: "Monthly Totals",
      rows: [
        ["Month", "Full days", "Half days", "Absent", "Paid leave", "Unpaid leave"],
        ...data.monthly.map((month) => [
          month.label,
          month.attendance.PRESENT,
          month.attendance.HALF_DAY,
          month.attendance.ABSENT,
          month.attendance.PAID_LEAVE,
          month.attendance.UNPAID_LEAVE
        ])
      ]
    },
    {
      name: "Attendance Log",
      rows: [
        ["Labour", "Date", "Status", "Notes"],
        ...data.attendanceRows.map((attendance) => [
          attendance.labourName,
          formatDate(attendance.workDate),
          attendance.status,
          attendance.notes || ""
        ])
      ]
    }
  ]);

  downloadWorkbook(workbook, `${data.tenant.slug}-attendance-${data.year}.xls`);
}

function toWorkbook(sheets: Array<{ name: string; rows: CellValue[][] }>) {
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#DDEFE8" ss:Pattern="Solid"/></Style>
  </Styles>
  ${sheets.map((sheet) => toWorksheet(sheet.name, sheet.rows)).join("")}
</Workbook>`;
}

function toWorksheet(name: string, rows: CellValue[][]) {
  return `<Worksheet ss:Name="${escapeXml(sheetName(name))}"><Table>${rows.map(toRow).join("")}</Table></Worksheet>`;
}

function toRow(row: CellValue[], index: number) {
  const style = index === 0 || (row.length === 1 && typeof row[0] === "string") ? ' ss:StyleID="header"' : "";
  return `<Row>${row.map((cell) => toCell(cell, style)).join("")}</Row>`;
}

function toCell(value: CellValue, style: string) {
  const text = value ?? "";
  const type = typeof text === "number" ? "Number" : "String";
  return `<Cell${style}><Data ss:Type="${type}">${escapeXml(String(text))}</Data></Cell>`;
}

function downloadWorkbook(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function sheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toNumber(value?: string | number | null) {
  return Number(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
