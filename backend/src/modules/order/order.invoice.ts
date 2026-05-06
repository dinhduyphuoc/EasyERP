import { Prisma } from "../../../generated/prisma/client";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { NotFoundError } from "@/common";
import { SettingsService } from "../settings/settings.service";
import { OrderRepository } from "./order.repository";
import { orderInclude, type OrderWithRelations } from "./order.persistence";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatCurrency = (value: Prisma.Decimal | number | string | null | undefined) => {
  const amount = Number(value ?? 0);
  return `${amount.toLocaleString("vi-VN")} đ`;
};

const formatDateTime = (value: Date | string | null | undefined) => {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const toText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const buildItemsRowsHtml = (order: OrderWithRelations, invoiceType: "b2b" | "b2c") =>
  order.items
    .map((item) =>
      invoiceType === "b2b"
        ? `<tr>
            <td>${escapeHtml(item.product_name)}</td>
            <td>${escapeHtml(item.sku)}</td>
            <td>${item.quantity}</td>
            <td>${escapeHtml(formatCurrency(item.unit_price))}</td>
            <td>${escapeHtml(formatCurrency(item.sub_total))}</td>
          </tr>`
        : `<tr>
            <td>${escapeHtml(item.product_name)}</td>
            <td>${item.quantity}</td>
            <td>${escapeHtml(formatCurrency(item.unit_price))}</td>
            <td>${escapeHtml(formatCurrency(item.sub_total))}</td>
          </tr>`,
    )
    .join("");

const applyTemplate = (template: string, values: Record<string, string>) =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter((value): value is string => Boolean(value && value.trim()));

const resolveChromeExecutable = async () => {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new NotFoundError(
    "Chrome/Edge executable was not found. Set CHROME_BIN on the server to enable PDF export.",
  );
};

const renderPdfFromHtml = async (html: string, fileName: string) => {
  const chromeExecutable = await resolveChromeExecutable();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "easyerp-invoice-"));
  const htmlPath = path.join(tempDir, `${fileName}.html`);
  const pdfPath = path.join(tempDir, `${fileName}.pdf`);

  try {
    await fs.writeFile(htmlPath, html, "utf8");

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        chromeExecutable,
        [
          "--headless=new",
          "--disable-gpu",
          "--run-all-compositor-stages-before-draw",
          `--print-to-pdf=${pdfPath}`,
          htmlPath,
        ],
        {
          windowsHide: true,
          stdio: ["ignore", "ignore", "pipe"],
        },
      );

      let stderr = "";

      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr || `Chrome exited with code ${code}`));
      });
    });

    return await fs.readFile(pdfPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

export const getOrderInvoicePrintHtml = async (args: {
  storeId: string;
  orderId: number;
  tenantId: string | null;
}) => {
  const order = await OrderRepository.findOrderFirst({
    where: { id: args.orderId, store_id: args.storeId },
    include: orderInclude,
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  const settings = await SettingsService.getGeneralSettings(args.tenantId, args.storeId);
  const invoiceSnapshot = toRecord(order.invoice_snapshot_json);
  const invoiceType = toText(invoiceSnapshot.invoice_type) === "b2b" ? "b2b" : "b2c";
  const template =
    invoiceType === "b2b"
      ? settings.defaults.invoice.templates.b2b_html
      : settings.defaults.invoice.templates.b2c_html;
  const buyerPersonalId = toText(invoiceSnapshot.personal_id);
  const buyerTaxCode = toText(invoiceSnapshot.tax_code);
  const lookupCode = order.invoice_code || `${order.order_code}-${order.id}`;

  const html = applyTemplate(template, {
    invoice_title:
      invoiceType === "b2b" ? "HÓA ĐƠN GIÁ TRỊ GIA TĂNG" : "HÓA ĐƠN ĐIỆN TỬ TỪ MÁY TÍNH TIỀN",
    invoice_code: escapeHtml(order.invoice_code || lookupCode),
    invoice_series: escapeHtml(
      `${settings.defaults.invoice.numbering.invoice_series_prefix}-${String(
        settings.defaults.invoice.numbering.starting_sequence,
      ).padStart(6, "0")}`,
    ),
    invoice_date: escapeHtml(formatDateTime(order.order_date)),
    invoice_signed_at: escapeHtml(formatDateTime(order.updated_at)),
    seller_legal_name: escapeHtml(settings.defaults.invoice.seller.legal_name || settings.defaults.invoice.seller.brand_name),
    seller_brand_name: escapeHtml(settings.defaults.invoice.seller.brand_name || settings.defaults.invoice.seller.legal_name),
    seller_tax_code: escapeHtml(settings.defaults.invoice.seller.tax_code),
    seller_address: escapeHtml(settings.defaults.invoice.seller.address_line),
    seller_email: escapeHtml(settings.defaults.invoice.seller.email),
    seller_phone: escapeHtml(settings.defaults.invoice.seller.phone),
    buyer_name: escapeHtml(toText(invoiceSnapshot.buyer_name) || order.customer_name),
    buyer_company_name: escapeHtml(toText(invoiceSnapshot.company_name)),
    buyer_tax_or_personal_id: escapeHtml(buyerTaxCode || buyerPersonalId || toText(invoiceSnapshot.budget_unit_code)),
    buyer_address: escapeHtml(toText(invoiceSnapshot.address_line) || order.customer_address || ""),
    sub_total: escapeHtml(formatCurrency(order.sub_total)),
    discount_amount: escapeHtml(formatCurrency(order.discount_amount)),
    tax_amount: escapeHtml(formatCurrency(order.tax_amount)),
    shipping_fee: escapeHtml(formatCurrency(order.shipping_fee)),
    total_amount: escapeHtml(formatCurrency(order.total_amount)),
    footer_note:
      invoiceType === "b2b"
        ? escapeHtml(settings.defaults.invoice.display.footer_note_b2b)
        : escapeHtml(settings.defaults.invoice.display.footer_note_b2c),
    lookup_code: escapeHtml(lookupCode),
    items_rows_html: buildItemsRowsHtml(order, invoiceType),
  });

  return {
    html,
    invoice_type: invoiceType,
    file_name: `${order.order_code}-${invoiceType}-print.html`,
  };
};

export const getOrderInvoicePdf = async (args: {
  storeId: string;
  orderId: number;
  tenantId: string | null;
}) => {
  const printReady = await getOrderInvoicePrintHtml(args);
  const fileBaseName = printReady.file_name.replace(/\.html$/i, "");
  const pdfBuffer = await renderPdfFromHtml(printReady.html, fileBaseName);

  return {
    buffer: pdfBuffer,
    invoice_type: printReady.invoice_type,
    file_name: `${fileBaseName}.pdf`,
  };
};
