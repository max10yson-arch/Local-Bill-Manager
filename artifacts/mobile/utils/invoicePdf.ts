import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { BillDraft, Customer, Order, StoreSettings, Totals, calculateTotals, formatCurrency } from "@/context/BillingContext";

type InvoicePayload = {
  settings: StoreSettings;
  customer: Pick<Customer, "name" | "phone" | "city" | "address">;
  order: Order;
};

function esc(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function lineTotal(item: { price: number; qty: number; discount?: number }) {
  return item.price * item.qty * (1 - Math.max(0, item.discount || 0) / 100);
}

export function draftToOrder(draft: BillDraft, totals: Totals): Order {
  return {
    id: "draft",
    invoiceNum: draft.invoiceNum,
    date: draft.date,
    items: draft.items,
    subtotal: totals.subtotal,
    productDiscount: totals.productDiscount,
    billDiscount: totals.billDiscount,
    discount: totals.discount,
    gst: totals.gst,
    delivery: totals.delivery,
    grand: totals.grand,
    notes: draft.notes,
  };
}

export function buildInvoiceHtml({ settings, customer, order }: InvoicePayload) {
  const totals = calculateTotals({
    invoiceNum: order.invoiceNum,
    date: order.date,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerCity: customer.city,
    customerAddress: customer.address,
    gstRate: order.gst && order.subtotal ? 5 : 0,
    discountRate: 0,
    delivery: order.delivery,
    notes: order.notes,
    items: order.items,
  });
  const productDiscount = order.productDiscount ?? totals.productDiscount ?? 0;
  const billDiscount = order.billDiscount ?? Math.max(0, (order.discount || 0) - productDiscount);
  const gstPercent = order.gst && (order.subtotal - productDiscount - billDiscount) > 0 ? Math.round(order.gst / (order.subtotal - productDiscount - billDiscount) * 10000) / 100 : 0;
  const itemRows = order.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="left"><strong>${esc(item.name)}</strong><br><span>${esc(item.category)}${item.discount ? ` · ${item.discount}% catalog discount` : ""}</span></td>
      <td>${item.qty}</td>
      <td>${formatCurrency(item.price)}</td>
      <td><strong>${formatCurrency(lineTotal(item))}</strong></td>
    </tr>
  `).join("");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(order.invoiceNum)} - ${esc(settings.name)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, sans-serif; background: #f4f0ea; color: #2c2c2c; }
  .bill { max-width: 760px; margin: 0 auto; background: #fff; box-shadow: 0 8px 30px rgba(0,0,0,.15); overflow: hidden; }
  .hdr { background: linear-gradient(135deg,#5a0d28 0%,#7B1338 62%,#9B2048 100%); padding: 26px 30px 22px; color: white; display: flex; justify-content: space-between; gap: 20px; }
  .brand { display: flex; gap: 16px; align-items: center; }
  .mark { width: 66px; height: 66px; border-radius: 13px; border: 2px solid rgba(255,255,255,.25); background: rgba(255,255,255,.1); display: flex; align-items: center; justify-content: center; font-size: 27px; font-weight: 800; color: #B08D57; }
  .name { font-size: 25px; font-weight: 800; line-height: 1.15; }
  .tag { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.68); margin: 4px 0 8px; }
  .info { font-size: 12px; color: rgba(255,255,255,.84); line-height: 1.55; }
  .inv { text-align: right; }
  .inv .lbl { font-size: 11px; color: #B08D57; letter-spacing: .16em; text-transform: uppercase; font-weight: 800; }
  .inv .num { font-size: 30px; font-weight: 800; }
  .gold { height: 5px; background: linear-gradient(90deg,#B08D57,#e8c97a,#B08D57); }
  .meta { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #e8e0d8; }
  .box { padding: 18px 24px; min-height: 118px; }
  .box:first-child { border-right: 1px solid #e8e0d8; }
  .label { color: #7B1338; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 9px; }
  .value { font-size: 14px; line-height: 1.6; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th { background: linear-gradient(180deg,#7B1338,#8c1540); color: #fff; padding: 11px 13px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; text-align: right; }
  th.left, td.left { text-align: left; }
  td { padding: 12px 13px; text-align: right; border-bottom: 1px solid #eee; font-size: 13px; }
  tr:nth-child(even) td { background: #faf7f4; }
  td span { font-size: 11px; color: #777; }
  .totals { padding: 18px 24px; display: flex; justify-content: flex-end; }
  .tot { width: 300px; }
  .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px dashed #ddd; font-size: 13px; }
  .row .v { font-weight: 800; }
  .save { color: #177245; }
  .grand { margin-top: 10px; background: linear-gradient(135deg,#5a0d28,#7B1338); border-radius: 10px; padding: 13px 16px; display: flex; justify-content: space-between; color: white; align-items: center; }
  .grand .l { font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  .grand .v { font-size: 26px; color: #B08D57; font-weight: 900; }
  .ftr { background: #faf7f4; border-top: 1px solid #e8e0d8; padding: 18px 24px; font-size: 12px; line-height: 1.65; color: #666; }
  .thanks { color: #7B1338; text-align: center; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; border-top: 2px solid #f0e0e8; padding-top: 11px; margin-top: 10px; }
  .strip { height: 6px; background: linear-gradient(90deg,#5a0d28,#7B1338,#B08D57,#7B1338,#5a0d28); }
  @media print { body { background: #fff; } .bill { box-shadow: none; } }
</style>
</head>
<body>
  <div class="bill">
    <div class="hdr">
      <div class="brand">
        <div class="mark">PS</div>
        <div>
          <div class="name">${esc(settings.name)}</div>
          <div class="tag">Weave Your World in Elegance</div>
          <div class="info">${esc(settings.address)}<br>${esc(settings.phone)}${settings.gstin ? `<br>GSTIN: ${esc(settings.gstin)}` : ""}</div>
        </div>
      </div>
      <div class="inv"><div class="lbl">Invoice</div><div class="num">#${esc(order.invoiceNum)}</div><div class="info">${esc(order.date)}</div></div>
    </div>
    <div class="gold"></div>
    <div class="meta">
      <div class="box"><div class="label">Bill To</div><div class="value">${esc(customer.name || "—")}<br>${esc(customer.phone || "")}<br>${esc(customer.city || "")}<br>${esc(customer.address || "")}</div></div>
      <div class="box"><div class="label">Order For</div><div class="value">Premium Sarees & Home Linens<br>${settings.gstin ? `GSTIN: ${esc(settings.gstin)}` : ""}</div></div>
    </div>
    <table><thead><tr><th>#</th><th class="left">Item Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${itemRows || `<tr><td colspan="5" class="left">No items</td></tr>`}</tbody></table>
    <div class="totals"><div class="tot">
      <div class="row"><span>Subtotal</span><span class="v">${formatCurrency(order.subtotal)}</span></div>
      ${productDiscount ? `<div class="row"><span>Catalog product discount</span><span class="v save">-${formatCurrency(productDiscount)}</span></div>` : ""}
      ${billDiscount ? `<div class="row"><span>Bill discount</span><span class="v save">-${formatCurrency(billDiscount)}</span></div>` : ""}
      ${order.gst ? `<div class="row"><span>GST (${gstPercent}%)</span><span class="v">${formatCurrency(order.gst)}</span></div>` : ""}
      ${order.delivery ? `<div class="row"><span>Delivery</span><span class="v">${formatCurrency(order.delivery)}</span></div>` : ""}
      <div class="grand"><span class="l">Total Amount</span><span class="v">${formatCurrency(order.grand)}</span></div>
    </div></div>
    <div class="ftr"><strong>${esc(settings.name)}</strong> — Thank you for your purchase! Contact: <strong>${esc(settings.phone)}</strong>${order.notes ? `<br><br>${esc(order.notes)}` : ""}<div class="thanks">Thank you for your business!</div></div>
    <div class="strip"></div>
  </div>
</body>
</html>`;
}

export async function printInvoice(payload: InvoicePayload) {
  const html = buildInvoiceHtml(payload);
  if (Platform.OS === "web") {
    const popup = window.open("", "_blank", "width=900,height=1100");
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

export async function shareInvoicePdf(payload: InvoicePayload) {
  const html = buildInvoiceHtml(payload);
  if (Platform.OS === "web") {
    await printInvoice(payload);
    return;
  }
  const file = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: payload.order.invoiceNum });
}
