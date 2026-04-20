import { prisma } from "@lib/prisma";
import { ProductService } from "@/modules/product/product.service";
import { CustomerService } from "@/modules/customer/customer.service";
import { InventoryService } from "@/modules/inventory/inventory.service";
import { OrderService } from "@/modules/order/order.service";

const DEMO_CATEGORY_NAME = "Demo Inventory";
const DEMO_CUSTOMERS = [
  {
    full_name: "Nguyen Minh Chau",
    phone: "0901000001",
  },
  {
    full_name: "Tran Bao An",
    phone: "0901000002",
  },
] as const;

const DEMO_ORDER_CODES = {
  draft: "DH9001",
  placed: "DH9002",
  delivering: "DH9003",
  completed: "DH9004",
  cancelled: "DH9005",
} as const;

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
      category_id: categoryId,
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
      category_id: categoryId,
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

async function ensureDemoCustomers() {
  const customers = [];

  for (const input of DEMO_CUSTOMERS) {
    const existing = await prisma.customer.findFirst({
      where: { phone: input.phone },
      select: {
        id: true,
        client_code: true,
        full_name: true,
        phone: true,
      },
    });

    if (existing) {
      customers.push(existing);
      continue;
    }

    const created = await CustomerService.createCustomer({
      full_name: input.full_name,
      phone: input.phone,
      status: "active",
    });

    customers.push(created);
  }

  return customers;
}

async function ensureDemoOrders(variantSkus: string[], customerIds: number[]) {
  const [firstSku, secondSku = firstSku] = variantSkus;
  const [firstCustomerId, secondCustomerId = firstCustomerId] = customerIds;

  const ordersToCreate = [
    {
      order_code: DEMO_ORDER_CODES.draft,
      order_date: "2026-04-18T09:00:00.000Z",
      customer_id: firstCustomerId,
      customer_info: {
        name: "Nguyen Minh Chau",
        phone: "0901000001",
        address: "12 Nguyen Hue, Quan 1, TP.HCM",
      },
      payment_status: "unpaid" as const,
      processing_status: "draft" as const,
      sales_channel: "Facebook",
      shipping_service: "GHN",
      shipping_fee: 30000,
      tax_amount: 0,
      order_notes: "Don demo dang nhap lieu",
      created_by: "Seed Script",
      order_items: [
        {
          variant_sku: firstSku,
          sku: firstSku,
          quantity: 1,
          unit_price: 79000,
          discount_amount: 0,
        },
      ],
    },
    {
      order_code: DEMO_ORDER_CODES.placed,
      order_date: "2026-04-18T13:30:00.000Z",
      customer_id: firstCustomerId,
      customer_info: {
        name: "Nguyen Minh Chau",
        phone: "0901000001",
        address: "12 Nguyen Hue, Quan 1, TP.HCM",
      },
      payment_status: "deposit" as const,
      processing_status: "placed" as const,
      sales_channel: "Website",
      shipping_service: "GHTK",
      shipping_fee: 25000,
      tax_amount: 0,
      deposit_amount: 50000,
      paid_amount: 50000,
      payment_notes: "Khach da chuyen khoan dat coc",
      order_notes: "Cho xac nhan kho",
      created_by: "Seed Script",
      order_items: [
        {
          variant_sku: secondSku,
          sku: secondSku,
          quantity: 1,
          unit_price: 249000,
          discount_amount: 0,
        },
      ],
    },
    {
      order_code: DEMO_ORDER_CODES.delivering,
      order_date: "2026-04-19T08:45:00.000Z",
      customer_id: secondCustomerId,
      customer_info: {
        name: "Tran Bao An",
        phone: "0901000002",
        address: "88 Le Loi, Quan 3, TP.HCM",
      },
      payment_status: "deposit" as const,
      processing_status: "delivering" as const,
      sales_channel: "TikTok Shop",
      shipping_service: "Viettel Post",
      shipping_fee: 35000,
      tax_amount: 0,
      deposit_amount: 120000,
      paid_amount: 120000,
      tracking_code: "VTPOST-DEMO-001",
      shipping_status: "delivering",
      warehouse_status: "ready_to_ship",
      order_notes: "Don demo dang giao",
      created_by: "Seed Script",
      confirmed_by: "Warehouse Demo",
      order_items: [
        {
          variant_sku: secondSku,
          sku: secondSku,
          quantity: 1,
          unit_price: 249000,
          discount_amount: 10000,
        },
      ],
    },
    {
      order_code: DEMO_ORDER_CODES.completed,
      order_date: "2026-04-19T16:20:00.000Z",
      customer_id: secondCustomerId,
      customer_info: {
        name: "Tran Bao An",
        phone: "0901000002",
        address: "88 Le Loi, Quan 3, TP.HCM",
      },
      payment_status: "paid" as const,
      processing_status: "completed" as const,
      sales_channel: "POS",
      shipping_service: "Ninja Van",
      shipping_fee: 20000,
      tax_amount: 0,
      paid_amount: 269000,
      shipping_status: "delivered",
      warehouse_status: "done",
      invoice_code: "EINV-DEMO-9004",
      order_notes: "Don demo hoan tat",
      created_by: "Seed Script",
      confirmed_by: "Warehouse Demo",
      order_items: [
        {
          variant_sku: firstSku,
          sku: firstSku,
          quantity: 2,
          unit_price: 79000,
          discount_amount: 0,
        },
        {
          variant_sku: secondSku,
          sku: secondSku,
          quantity: 1,
          unit_price: 249000,
          discount_amount: 158000,
        },
      ],
    },
    {
      order_code: DEMO_ORDER_CODES.cancelled,
      order_date: "2026-04-20T07:30:00.000Z",
      customer_id: firstCustomerId,
      customer_info: {
        name: "Nguyen Minh Chau",
        phone: "0901000001",
        address: "12 Nguyen Hue, Quan 1, TP.HCM",
      },
      payment_status: "unpaid" as const,
      processing_status: "cancelled" as const,
      sales_channel: "Zalo",
      shipping_service: "GHN",
      shipping_fee: 15000,
      tax_amount: 0,
      order_notes: "Don demo da huy",
      created_by: "Seed Script",
      order_items: [
        {
          variant_sku: firstSku,
          sku: firstSku,
          quantity: 1,
          unit_price: 79000,
          discount_amount: 0,
        },
      ],
    },
  ];

  const createdOrderCodes: string[] = [];

  for (const orderInput of ordersToCreate) {
    const existing = await prisma.order.findFirst({
      where: { order_code: orderInput.order_code },
      select: { id: true, order_code: true },
    });

    if (existing) {
      createdOrderCodes.push(existing.order_code);
      continue;
    }

    const order = await OrderService.createOrder(orderInput);
    createdOrderCodes.push(order.order_code);
  }

  return createdOrderCodes;
}

async function main() {
  const seededSkus = await ensureSeedData();
  const customers = await ensureDemoCustomers();
  const seededOrderCodes = await ensureDemoOrders(
    seededSkus,
    customers.map((customer) => customer.id),
  );
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
  console.log("Seeded customers:", customers.map((customer) => customer.client_code).join(", "));
  console.log("Seeded orders:", seededOrderCodes.join(", "));
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
