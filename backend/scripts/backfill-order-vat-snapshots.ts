import "dotenv/config";
import { prisma } from "../lib/prisma";

type SummaryRow = {
  total_orders: bigint;
  vat_enabled_true: bigint;
  vat_enabled_false: bigint;
  expected_vat_enabled_true: bigint;
  expected_vat_enabled_false: bigint;
  mismatched_vat_enabled: bigint;
  changed_by_user_rows: bigint;
  pricing_version_gt_one_rows: bigint;
};

const toNumber = (value: bigint) => Number(value);

const getSummary = async (): Promise<SummaryRow> => {
  const [row] = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      COUNT(*)::bigint AS total_orders,
      COUNT(*) FILTER (WHERE "vat_enabled" = TRUE)::bigint AS vat_enabled_true,
      COUNT(*) FILTER (WHERE "vat_enabled" = FALSE)::bigint AS vat_enabled_false,
      COUNT(*) FILTER (WHERE "vat_rate_percent" > 0 OR "tax_amount" > 0)::bigint AS expected_vat_enabled_true,
      COUNT(*) FILTER (WHERE NOT ("vat_rate_percent" > 0 OR "tax_amount" > 0))::bigint AS expected_vat_enabled_false,
      COUNT(*) FILTER (
        WHERE "vat_enabled" IS DISTINCT FROM ("vat_rate_percent" > 0 OR "tax_amount" > 0)
      )::bigint AS mismatched_vat_enabled,
      COUNT(*) FILTER (WHERE "vat_changed_by_user" = TRUE)::bigint AS changed_by_user_rows,
      COUNT(*) FILTER (WHERE "pricing_version" > 1)::bigint AS pricing_version_gt_one_rows
    FROM "Order"
  `;

  return row;
};

const logSummary = (label: string, summary: SummaryRow) => {
  console.log(`\n${label}`);
  console.log(`- Total orders: ${toNumber(summary.total_orders)}`);
  console.log(`- vat_enabled = true: ${toNumber(summary.vat_enabled_true)}`);
  console.log(`- vat_enabled = false: ${toNumber(summary.vat_enabled_false)}`);
  console.log(`- Expected vat_enabled = true from historical tax data: ${toNumber(summary.expected_vat_enabled_true)}`);
  console.log(`- Expected vat_enabled = false from historical tax data: ${toNumber(summary.expected_vat_enabled_false)}`);
  console.log(`- Rows needing vat_enabled backfill: ${toNumber(summary.mismatched_vat_enabled)}`);
  console.log(`- Rows already marked vat_changed_by_user = true: ${toNumber(summary.changed_by_user_rows)}`);
  console.log(`- Rows with pricing_version > 1: ${toNumber(summary.pricing_version_gt_one_rows)}`);
};

const applyBackfill = async () => {
  const updatedRows = await prisma.$executeRaw`
    UPDATE "Order"
    SET
      "vat_enabled" = CASE
        WHEN "vat_rate_percent" > 0 OR "tax_amount" > 0 THEN TRUE
        ELSE FALSE
      END,
      "vat_changed_by_user" = COALESCE("vat_changed_by_user", FALSE),
      "pricing_version" = CASE
        WHEN "pricing_version" < 1 THEN 1
        ELSE "pricing_version"
      END
    WHERE
      "vat_changed_by_user" = FALSE
      AND "pricing_version" = 1
      AND "vat_enabled" IS DISTINCT FROM CASE
        WHEN "vat_rate_percent" > 0 OR "tax_amount" > 0 THEN TRUE
        ELSE FALSE
      END
  `;

  return updatedRows;
};

const main = async () => {
  const shouldApply = process.argv.includes("--apply");

  console.log("Inspecting order VAT snapshots...");
  const before = await getSummary();
  logSummary("Before backfill", before);

  if (!shouldApply) {
    console.log("\nDry run only. Re-run with --apply to persist the backfill.");
    return;
  }

  console.log("\nApplying VAT snapshot backfill...");
  const updatedRows = await applyBackfill();
  console.log(`Updated rows: ${updatedRows}`);

  const after = await getSummary();
  logSummary("After backfill", after);
};

void main()
  .catch((error) => {
    console.error("VAT snapshot backfill failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
