import { prisma } from "@lib/prisma";
import { ProductService } from "@/modules/product/product.service";
import { InventoryService } from "@/modules/inventory/inventory.service";

const DEMO_CATEGORY_NAME = "Demo Inventory";

async function ensureDemoCategory() {
  const existing = await prisma.category.findFirst({
    where: {
      category_name: DEMO_CATEGORY_NAME,
    },
    select: {
      id: true,
      category_name: true,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.category.create({
    data: {
      category_name: DEMO_CATEGORY_NAME,
    },
    select: {
      id: true,
      category_name: true,
    },
  });
}

async function ensureDemoProducts(categoryId: number) {
  const mugVariant = await prisma.productVariant.findUnique({
    where: { sku: "MUG-EE" },
    select: { sku: true },
  });

  if (!mugVariant) {
    await ProductService.createProduct({
      product_name: "Ly su EasyERP",
      sku: "MUG-EE",
      unit: "cai",
      base_price: 79000,
      categoryId,
      image_url: "https://placehold.co/120x120?text=MUG",
      status: "active",
      description: "San pham demo inventory don gian",
      attributes: [],
      variants: [],
    });
  }

  const poloVariant = await prisma.productVariant.findUnique({
    where: { sku: "POLO-BLACK-M" },
    select: { sku: true },
  });

  if (!poloVariant) {
    await ProductService.createProduct({
      product_name: "Ao polo EasyERP",
      unit: "cai",
      categoryId,
      image_url: "https://placehold.co/120x120?text=POLO",
      status: "active",
      description: "San pham demo inventory co bien the",
      attributes: [
        {
          name: "Mau sac",
          values: ["Den", "Trang"],
        },
        {
          name: "Size",
          values: ["M", "L"],
        },
      ],
      variants: [
        {
          sku: "POLO-BLACK-M",
          selling_price: 249000,
          cogs: 180000,
          combinations: ["Den", "M"],
        },
        {
          sku: "POLO-BLACK-L",
          selling_price: 249000,
          cogs: 180000,
          combinations: ["Den", "L"],
        },
        {
          sku: "POLO-WHITE-M",
          selling_price: 249000,
          cogs: 180000,
          combinations: ["Trang", "M"],
        },
        {
          sku: "POLO-WHITE-L",
          selling_price: 249000,
          cogs: 180000,
          combinations: ["Trang", "L"],
        },
      ],
    });
  }
}

async function ensureSeedData() {
  const demoCategory = await ensureDemoCategory();
  await ensureDemoProducts(demoCategory.id);

  const variants = await prisma.productVariant.findMany({
    orderBy: [{ sku: "asc" }],
    select: {
      sku: true,
    },
    take: 6,
  });

  if (variants.length === 0) {
    throw new Error("No product variants available to seed inventory");
  }

  const [first, second = first, third = second] = variants;

  await InventoryService.initialize({
    product_variant_id: first.sku,
    initial_on_hand: 24,
    note: "Seed initial stock",
    idempotency_key: `seed:${first.sku}:initialize`,
    actor: { id: "seed-script", name: "Seed Script" },
    metadata: { source: "script.ts" },
  });

  await InventoryService.reserve({
    product_variant_id: first.sku,
    qty: 3,
    reference_type: "order",
    reference_id: "seed-order-001",
    reference_code: "SO-SEED-001",
    note: "Reserve stock for sample order",
    idempotency_key: `seed:${first.sku}:reserve-1`,
    actor: { id: "seed-script", name: "Seed Script" },
    metadata: { source: "script.ts" },
  });

  await InventoryService.moveToPacking({
    product_variant_id: first.sku,
    qty: 1,
    reference_type: "order",
    reference_id: "seed-order-001",
    reference_code: "SO-SEED-001",
    note: "Move one item to packing",
    idempotency_key: `seed:${first.sku}:packing-1`,
    actor: { id: "seed-script", name: "Seed Script" },
    metadata: { source: "script.ts" },
  });

  await InventoryService.incomingCreate({
    product_variant_id: first.sku,
    qty: 10,
    reference_type: "purchase_order",
    reference_id: "seed-po-001",
    reference_code: "PO-SEED-001",
    note: "Create incoming stock",
    idempotency_key: `seed:${first.sku}:incoming-create-1`,
    actor: { id: "seed-script", name: "Seed Script" },
    metadata: { source: "script.ts" },
  });

  await InventoryService.incomingReceive({
    product_variant_id: first.sku,
    qty: 6,
    reference_type: "goods_receipt",
    reference_id: "seed-gr-001",
    reference_code: "GR-SEED-001",
    note: "Receive part of incoming stock",
    idempotency_key: `seed:${first.sku}:incoming-receive-1`,
    actor: { id: "seed-script", name: "Seed Script" },
    metadata: { source: "script.ts" },
  });

  await InventoryService.adjust({
    product_variant_id: first.sku,
    mode: "delta",
    qty: -1,
    reason_code: "damaged",
    note: "One item damaged during handling",
    idempotency_key: `seed:${first.sku}:adjust-damaged-1`,
    actor: { id: "seed-script", name: "Seed Script" },
    metadata: { source: "script.ts" },
  });

  await InventoryService.initialize({
    product_variant_id: second.sku,
    initial_on_hand: 12,
    note: "Seed initial stock",
    idempotency_key: `seed:${second.sku}:initialize`,
    actor: { id: "seed-script", name: "Seed Script" },
    metadata: { source: "script.ts" },
  });

  await InventoryService.reserve({
    product_variant_id: second.sku,
    qty: 2,
    reference_type: "order",
    reference_id: "seed-order-002",
    reference_code: "SO-SEED-002",
    note: "Reserve stock for another order",
    idempotency_key: `seed:${second.sku}:reserve-1`,
    actor: { id: "seed-script", name: "Seed Script" },
    metadata: { source: "script.ts" },
  });

  await InventoryService.release({
    product_variant_id: second.sku,
    qty: 1,
    reference_type: "order",
    reference_id: "seed-order-002",
    reference_code: "SO-SEED-002",
    note: "Release one reserved item",
    idempotency_key: `seed:${second.sku}:release-1`,
    actor: { id: "seed-script", name: "Seed Script" },
    metadata: { source: "script.ts" },
  });

  await InventoryService.returnRestock({
    product_variant_id: second.sku,
    qty: 1,
    reference_type: "return_order",
    reference_id: "seed-return-001",
    reference_code: "RT-SEED-001",
    note: "Sample return restock",
    idempotency_key: `seed:${second.sku}:return-restock-1`,
    actor: { id: "seed-script", name: "Seed Script" },
    metadata: { source: "script.ts" },
  });

  await InventoryService.initialize({
    product_variant_id: third.sku,
    initial_on_hand: 8,
    note: "Seed initial stock",
    idempotency_key: `seed:${third.sku}:initialize`,
    actor: { id: "seed-script", name: "Seed Script" },
    metadata: { source: "script.ts" },
  });

  await InventoryService.adjust({
    product_variant_id: third.sku,
    mode: "absolute",
    target_on_hand: 10,
    reason_code: "actual_count",
    note: "Absolute adjustment after stock count",
    idempotency_key: `seed:${third.sku}:adjust-absolute-1`,
    actor: { id: "seed-script", name: "Seed Script" },
    metadata: { source: "script.ts" },
  });

  return variants.map((variant) => variant.sku);
}

async function main() {
  const seededSkus = await ensureSeedData();
  const stockList = await prisma.inventoryStock.findMany({
    where: {
      product_variant_id: {
        in: seededSkus,
      },
    },
    orderBy: {
      product_variant_id: "asc",
    },
  });

  console.log("Inventory seed completed successfully.");
  console.log("Seeded variants:", seededSkus.join(", "));
  console.log("Current stock snapshots:", JSON.stringify(stockList, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
