import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { BillListItem, formatCurrency } from "@/context/BillingContext";

type ReportMode = "datewise" | "customer";

type ReportPayload = {
  bills: BillListItem[];
  mode: ReportMode;
  title: string;
  rangeLabel: string;
};

function esc(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildDatewiseRows(bills: BillListItem[]) {
  return bills.map((bill) => `<tr><td>${esc(bill.date)}</td><td>${esc(bill.invoiceNum)}</td><td>${esc(bill.customerName)}</td><td>${bill.items.length}</td><td>${formatCurrency(bill.discount || 0)}</td><td>${formatCurrency(bill.grand)}</td></tr>`).join("");
}

function buildCustomerRows(bills: BillListItem[]) {
  const grouped = bills.reduce<Record<string, { name: string; phone: string; count: number; items: number; discount: number; total: number }>>((acc, bill) => {
    const key = bill.customerId || bill.customerName;
    acc[key] = acc[key] || { name: bill.customerName, phone: bill.customerPhone, count: 0, items: 0, discount: 0, total: 0 };
    acc[key].count += 1;
    acc[key].items += bill.items.reduce((sum, item) => sum + item.qty, 0);
    acc[key].discount += bill.discount || 0;
    acc[key].total += bill.grand;
    return acc;
  }, {});
  return Object.values(grouped).sort((a, b) => b.total - a.total).map((row) => `<tr><td>${esc(row.name)}</td><td>${esc(row.phone)}</td><td>${row.count}</td><td>${row.items}</td><td>${formatCurrency(row.discount)}</td><td>${formatCurrency(row.total)}</td></tr>`).join("");
}

export function buildSalesReportHtml({ bills, mode, title, rangeLabel }: ReportPayload) {
  const totalSales = bills.reduce((sum, bill) => sum + bill.grand, 0);
  const totalDiscount = bills.reduce((sum, bill) => sum + (bill.discount || 0), 0);
  const totalItems = bills.reduce((sum, bill) => sum + bill.items.reduce((inner, item) => inner + item.qty, 0), 0);
  const headers = mode === "customer" ? ["Customer", "Phone", "Bills", "Items", "Discount", "Sales"] : ["Date", "Invoice", "Customer", "Lines", "Discount", "Sales"];
  const rows = mode === "customer" ? buildCustomerRows(bills) : buildDatewiseRows(bills);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;margin:0;background:#f5efe6;color:#241412}.report{background:#fff;max-width:840px;margin:0 auto;border-radius:18px;overflow:hidden}.hero{background:linear-gradient(135deg,#090807,#8B123A);color:#fff;padding:26px 30px}.k{color:#D8AF62;text-transform:uppercase;font-size:11px;letter-spacing:.18em;font-weight:800}.title{font-size:30px;font-weight:900;margin:6px 0}.meta{color:#ead8b8;font-size:13px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:18px;background:#14100F}.card{background:#241817;border:1px solid #49302a;border-radius:14px;padding:12px}.label{color:#cdb991;font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:800}.value{color:#fff;font-size:20px;font-weight:900;margin-top:4px}table{width:100%;border-collapse:collapse}th{background:#8B123A;color:#fff;text-align:left;padding:11px;font-size:11px;text-transform:uppercase;letter-spacing:.1em}td{padding:11px;border-bottom:1px solid #eee;font-size:12px}tr:nth-child(even) td{background:#fbf7ef}td:last-child,th:last-child{text-align:right;font-weight:800}.foot{padding:18px 24px;color:#806b5f;font-size:12px;text-align:center}</style></head><body><div class="report"><div class="hero"><div class="k">Parinay Saree Admin</div><div class="title">${esc(title)}</div><div class="meta">${esc(rangeLabel)} · Generated ${new Date().toLocaleDateString("en-IN")}</div></div><div class="cards"><div class="card"><div class="label">Bills</div><div class="value">${bills.length}</div></div><div class="card"><div class="label">Items</div><div class="value">${totalItems}</div></div><div class="card"><div class="label">Discount</div><div class="value">${formatCurrency(totalDiscount)}</div></div><div class="card"><div class="label">Sales</div><div class="value">${formatCurrency(totalSales)}</div></div></div><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="6">No sales in this range.</td></tr>`}</tbody></table><div class="foot">This report is generated from locally saved invoices in the Parinay Saree admin app.</div></div></body></html>`;
}

export async function printSalesReport(payload: ReportPayload) {
  const html = buildSalesReportHtml(payload);
  if (Platform.OS === "web") {
    const popup = window.open("", "_blank", "width=1000,height=1100");
    if (!popup) return;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 300);
    return;
  }
  await Print.printAsync({ html });
}

export async function shareSalesReport(payload: ReportPayload) {
  const html = buildSalesReportHtml(payload);
  if (Platform.OS === "web") {
    await printSalesReport(payload);
    return;
  }
  const file = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: payload.title });
}
