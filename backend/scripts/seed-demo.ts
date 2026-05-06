import { prisma } from "@lib/prisma";
import { ProductService } from "@/modules/product/product.service";
import { CustomerService } from "@/modules/customer/customer.service";
import { InventoryService } from "@/modules/inventory/inventory.service";
import { createOrder } from "@/modules/order/order.create";
import { ensureCoreSeed } from "./seed.shared";

const BAG_SERIES = [
  {
    label: "Túi tote",
    designs: [
      { name: "Túi tote công sở Flora", material: "Canvas chống thấm", size: "34x28x12cm", basePrice: 219000 },
      { name: "Túi tote khóa nam châm Urban", material: "Da PU lì", size: "32x26x11cm", basePrice: 249000 },
      { name: "Túi tote quai bản lớn Mira", material: "Canvas dày", size: "35x30x13cm", basePrice: 239000 },
      { name: "Túi tote ngăn laptop Sera", material: "Vải twill", size: "36x29x12cm", basePrice: 269000 },
      { name: "Túi tote dáng đứng Amelie", material: "Da PU mềm", size: "33x27x11cm", basePrice: 259000 },
    ],
  },
  {
    label: "Túi đeo chéo",
    designs: [
      { name: "Túi đeo chéo nắp gập Lyna", material: "Da PU hạt", size: "24x18x9cm", basePrice: 229000 },
      { name: "Túi đeo chéo hộp cứng Kiera", material: "Da tổng hợp", size: "22x16x8cm", basePrice: 249000 },
      { name: "Túi đeo chéo dây xích Elio", material: "Da PU bóng", size: "23x15x7cm", basePrice: 259000 },
      { name: "Túi đeo chéo ngăn đôi Nova", material: "Da PU mềm", size: "25x17x8cm", basePrice: 269000 },
      { name: "Túi đeo chéo mini khóa xoay Celin", material: "Da saffiano", size: "21x14x7cm", basePrice: 279000 },
    ],
  },
  {
    label: "Túi xách tay",
    designs: [
      { name: "Túi xách tay dáng hộp Clara", material: "Da PU cao cấp", size: "29x22x12cm", basePrice: 289000 },
      { name: "Túi xách tay khóa vàng Moni", material: "Da PU nhám", size: "30x23x11cm", basePrice: 299000 },
      { name: "Túi xách tay công sở Elise", material: "Da tổng hợp", size: "31x24x12cm", basePrice: 319000 },
      { name: "Túi xách tay form mềm Haze", material: "Da PU mịn", size: "28x21x10cm", basePrice: 309000 },
      { name: "Túi xách tay quai tròn Ruby", material: "Da PU vân", size: "27x20x10cm", basePrice: 329000 },
    ],
  },
  {
    label: "Túi mini",
    designs: [
      { name: "Túi mini dây xích Nara", material: "Da PU mềm", size: "18x12x6cm", basePrice: 179000 },
      { name: "Túi mini dáng trăng Luna", material: "Da PU lì", size: "19x13x6cm", basePrice: 189000 },
      { name: "Túi mini khóa vặn Belle", material: "Da tổng hợp", size: "17x11x6cm", basePrice: 199000 },
      { name: "Túi mini đính charm Yumi", material: "Da PU bóng", size: "18x12x5cm", basePrice: 209000 },
      { name: "Túi mini cầm tay Freya", material: "Canvas phủ", size: "20x13x7cm", basePrice: 219000 },
    ],
  },
  {
    label: "Ba lô nữ",
    designs: [
      { name: "Ba lô nữ nắp gập Hazel", material: "Da PU chống xước", size: "27x31x13cm", basePrice: 329000 },
      { name: "Ba lô nữ khóa kéo Nova", material: "Vải Oxford", size: "28x32x14cm", basePrice: 349000 },
      { name: "Ba lô nữ ngăn đôi Miso", material: "Da PU mềm", size: "26x30x12cm", basePrice: 359000 },
      { name: "Ba lô nữ phối dây rút Aria", material: "Canvas phủ", size: "29x33x14cm", basePrice: 369000 },
      { name: "Ba lô nữ dáng nhỏ Koko", material: "Da tổng hợp", size: "25x29x11cm", basePrice: 339000 },
    ],
  },
] as const;

const PRODUCT_COLORS = [
  { name: "Đen", priceOffset: 0 },
  { name: "Kem", priceOffset: 10000 },
] as const;

const DEMO_CATEGORY_NAMES = BAG_SERIES.map((series) => series.label);

const DEMO_PRODUCTS = BAG_SERIES.flatMap((series, seriesIndex) =>
  series.designs.map((design, designIndex) => {
    const productIndex = seriesIndex * series.designs.length + designIndex;

    return {
      category_name: series.label,
      product_name: design.name,
      unit: "cái",
      description: `${design.name} có phom chuẩn để lên hình đẹp, phù hợp bán online và tại cửa hàng.`,
      material: design.material,
      size: design.size,
      image_url: `https://placehold.co/120x120?text=${encodeURIComponent(design.name)}`,
      variants: PRODUCT_COLORS.map((color, colorIndex) => {
        const skuIndex = productIndex * PRODUCT_COLORS.length + colorIndex + 1;
        const sku = `TUI-${String(skuIndex).padStart(3, "0")}`;
        const sellingPrice = design.basePrice + color.priceOffset;

        return {
          sku,
          color: color.name,
          selling_price: sellingPrice,
          image_url: `https://placehold.co/120x120?text=${encodeURIComponent(`${design.name} ${color.name}`)}`,
        };
      }),
    };
  }),
);

const DEMO_CUSTOMERS = [
  { full_name: "Nguyễn Minh Châu", phone: "0901000001" },
  { full_name: "Trần Bảo An", phone: "0901000002" },
  { full_name: "Lê Hoàng Phúc", phone: "0901000003" },
  { full_name: "Phạm Thu Hà", phone: "0901000004" },
  { full_name: "Đặng Khánh Linh", phone: "0901000005" },
  { full_name: "Võ Gia Hân", phone: "0901000006" },
] as const;

type DemoOrderSeed = {
  order_code: string;
  customer_phone: string;
  processing_status: "draft" | "placed" | "delivering" | "completed";
  payment_status: "unpaid" | "deposit" | "paid";
  sales_channel: string;
  shipping_service: string;
  shipping_fee: number;
  order_notes: string;
  deposit_amount?: number;
  paid_amount?: number;
  payment_notes?: string;
  tracking_code?: string;
  shipping_status?: string;
  warehouse_status?: string;
  order_items: Array<{
    sku: string;
    quantity: number;
  }>;
};

const DEMO_ORDERS: DemoOrderSeed[] = [
  {
    order_code: "DEMO-TUI-1001",
    customer_phone: "0901000001",
    processing_status: "draft",
    payment_status: "unpaid",
    sales_channel: "Facebook",
    shipping_service: "GHN",
    shipping_fee: 30000,
    order_notes: "Khách đang phân vân giữa mẫu tote và mẫu đeo chéo trước khi chốt đơn.",
    order_items: [
      { sku: "TUI-001", quantity: 1 },
      { sku: "TUI-012", quantity: 1 },
    ],
  },
  {
    order_code: "DEMO-TUI-1002",
    customer_phone: "0901000002",
    processing_status: "placed",
    payment_status: "deposit",
    sales_channel: "Website",
    shipping_service: "GHTK",
    shipping_fee: 25000,
    deposit_amount: 150000,
    paid_amount: 150000,
    payment_notes: "Khách đã chuyển khoản cọc để giữ mẫu túi xách tay màu kem.",
    order_notes: "Chờ đóng gói combo túi xách tay và túi mini.",
    order_items: [
      { sku: "TUI-022", quantity: 1 },
      { sku: "TUI-031", quantity: 1 },
    ],
  },
  {
    order_code: "DEMO-TUI-1003",
    customer_phone: "0901000003",
    processing_status: "delivering",
    payment_status: "paid",
    sales_channel: "TikTok Shop",
    shipping_service: "Viettel Post",
    shipping_fee: 35000,
    paid_amount: 638000,
    tracking_code: "VTPOST-TUI-1003",
    shipping_status: "Đang giao",
    warehouse_status: "Đã bàn giao vận chuyển",
    order_notes: "Đơn combo ba lô và túi đeo chéo đang giao nội thành.",
    order_items: [
      { sku: "TUI-041", quantity: 1 },
      { sku: "TUI-018", quantity: 1 },
    ],
  },
  {
    order_code: "DEMO-TUI-1004",
    customer_phone: "0901000004",
    processing_status: "completed",
    payment_status: "paid",
    sales_channel: "Shopee",
    shipping_service: "GHN",
    shipping_fee: 28000,
    paid_amount: 558000,
    shipping_status: "Đã giao",
    warehouse_status: "Hoàn tất",
    order_notes: "Khách đã nhận hàng và phản hồi tốt về chất liệu da PU.",
    order_items: [
      { sku: "TUI-009", quantity: 1 },
      { sku: "TUI-028", quantity: 1 },
    ],
  },
  {
    order_code: "DEMO-TUI-1005",
    customer_phone: "0901000005",
    processing_status: "placed",
    payment_status: "paid",
    sales_channel: "Instagram",
    shipping_service: "Ahamove",
    shipping_fee: 22000,
    paid_amount: 588000,
    order_notes: "Khách cần giao nhanh trong ngày để kịp tặng sinh nhật.",
    order_items: [
      { sku: "TUI-036", quantity: 1 },
      { sku: "TUI-049", quantity: 1 },
    ],
  },
  {
    order_code: "DEMO-TUI-1006",
    customer_phone: "0901000006",
    processing_status: "completed",
    payment_status: "paid",
    sales_channel: "Zalo OA",
    shipping_service: "GHN",
    shipping_fee: 30000,
    paid_amount: 717000,
    shipping_status: "Đã giao",
    warehouse_status: "Hoàn tất",
    order_notes: "Khách cũ mua lại thêm 2 mẫu tote bán chạy cho nhân viên.",
    order_items: [
      { sku: "TUI-002", quantity: 1 },
      { sku: "TUI-010", quantity: 1 },
      { sku: "TUI-024", quantity: 1 },
    ],
  },
];

const VARIANT_PRICE_BY_SKU = new Map(
  DEMO_PRODUCTS.flatMap((product) =>
    product.variants.map((variant) => [variant.sku, variant.selling_price] as const),
  ),
);

const ALL_VARIANT_SKUS = DEMO_PRODUCTS.flatMap((product) =>
  product.variants.map((variant) => variant.sku),
);

async function ensureDemoCategories(storeId: string) {
  const categories = await Promise.all(
    DEMO_CATEGORY_NAMES.map(async (categoryName) => {
      const existing = await prisma.category.findFirst({
        where: {
          store_id: storeId,
          category_name: categoryName,
        },
      });

      if (existing) {
        return existing;
      }

      return prisma.category.create({
        data: {
          store_id: storeId,
          category_name: categoryName,
        },
      });
    }),
  );

  return new Map(categories.map((category) => [category.category_name, category.id]));
}

async function ensureDemoProducts(
  storeId: string,
  categoryIdsByName: Map<string, number>,
) {
  const createdSkus: string[] = [];

  for (const product of DEMO_PRODUCTS) {
    const categoryId = categoryIdsByName.get(product.category_name);

    if (!categoryId) {
      throw new Error(`Không tìm thấy danh mục demo ${product.category_name}`);
    }

    const existingVariant = await prisma.productVariant.findFirst({
      where: {
        sku: {
          in: product.variants.map((variant) => variant.sku),
        },
      },
      select: {
        sku: true,
        product_id: true,
      },
    });

    const payload = {
      product_name: product.product_name,
      unit: product.unit,
      category_id: categoryId,
      image_url: product.image_url,
      status: "active" as const,
      description: `${product.description} Chất liệu ${product.material.toLowerCase()}, kích thước ${product.size}.`,
      attributes: [
        {
          name: "Màu sắc",
          values: product.variants.map((variant) => variant.color),
        },
        {
          name: "Chất liệu",
          values: [product.material],
        },
        {
          name: "Kích thước",
          values: [product.size],
        },
      ],
      variants: product.variants.map((variant) => ({
        sku: variant.sku,
        name: `${variant.color} / ${product.material} / ${product.size}`,
        kind: "generated" as const,
        selling_price: variant.selling_price,
        image_url: variant.image_url,
        combinations: [variant.color, product.material, product.size],
      })),
    };

    if (existingVariant) {
      await ProductService.editProduct(storeId, existingVariant.product_id, payload);
    } else {
      await ProductService.createProduct(storeId, payload);
    }

    createdSkus.push(...product.variants.map((variant) => variant.sku));
  }

  return createdSkus;
}

async function ensureDemoInventory(skus: string[]) {
  const initialized: string[] = [];

  for (const [index, sku] of skus.entries()) {
    const existingStock = await prisma.inventoryStock.findUnique({
      where: {
        product_variant_id: sku,
      },
      select: {
        id: true,
      },
    });

    const initialOnHand = 16 + (index % 10) * 3;

    if (!existingStock) {
      await InventoryService.initialize({
        product_variant_id: sku,
        initial_on_hand: initialOnHand,
        note: "Khởi tạo tồn kho demo cho ngành túi thời trang",
        idempotency_key: `seed-demo:${sku}:initialize`,
        actor: { id: "seed-demo", name: "Seed Demo" },
        metadata: { source: "seed-demo.ts" },
      });
    }

    const latestStock = await prisma.inventoryStock.findUnique({
      where: {
        product_variant_id: sku,
      },
      select: {
        on_hand: true,
      },
    });

    const targetOnHand = 22 + (index % 8) * 4;

    if (!latestStock || latestStock.on_hand < targetOnHand) {
      await InventoryService.adjust({
        product_variant_id: sku,
        mode: "absolute",
        target_on_hand: targetOnHand,
        reason_code: "actual_count",
        note: "Bổ sung tồn kho để phục vụ dữ liệu demo ngành túi",
        idempotency_key: `seed-demo:${sku}:top-up-${targetOnHand}`,
        actor: { id: "seed-demo", name: "Seed Demo" },
        metadata: { source: "seed-demo.ts" },
      });
    }

    initialized.push(sku);
  }

  return initialized;
}

async function ensureDemoCustomers(storeId: string) {
  const customers = [];

  for (const item of DEMO_CUSTOMERS) {
    const existing = await prisma.customer.findFirst({
      where: {
        phone: item.phone,
      },
      select: {
        id: true,
        full_name: true,
        phone: true,
        client_code: true,
      },
    });

    if (existing) {
      customers.push(existing);
      continue;
    }

    const created = await CustomerService.createCustomer(storeId, {
      full_name: item.full_name,
      phone: item.phone,
      status: "active",
    });

    customers.push(created);
  }

  return customers;
}

async function ensureDemoOrders(
  storeId: string,
  customersByPhone: Map<string, number>,
) {
  const createdOrderCodes: string[] = [];

  for (const item of DEMO_ORDERS) {
    const existing = await prisma.order.findFirst({
      where: {
        order_code: item.order_code,
      },
      select: {
        order_code: true,
      },
    });

    if (existing) {
      createdOrderCodes.push(existing.order_code);
      continue;
    }

    const customerId = customersByPhone.get(item.customer_phone);

    if (!customerId) {
      throw new Error(`Không tìm thấy khách hàng cho số điện thoại ${item.customer_phone}`);
    }

    const customer = DEMO_CUSTOMERS.find((demoCustomer) => demoCustomer.phone === item.customer_phone);

    if (!customer) {
      throw new Error(`Thiếu dữ liệu khách hàng demo cho số điện thoại ${item.customer_phone}`);
    }

    const paidAmount =
      item.paid_amount ??
      item.order_items.reduce((sum, orderItem) => {
        const unitPrice = VARIANT_PRICE_BY_SKU.get(orderItem.sku);

        if (!unitPrice) {
          throw new Error(`Không tìm thấy đơn giá cho SKU ${orderItem.sku}`);
        }

        return sum + unitPrice * orderItem.quantity;
      }, 0);

    const paymentFields =
      item.payment_status === "unpaid"
        ? {}
        : {
            ...(item.deposit_amount !== undefined ? { deposit_amount: item.deposit_amount } : {}),
            ...(paidAmount !== undefined ? { paid_amount: paidAmount } : {}),
          };

    const order = await createOrder(storeId, {
      order_code: item.order_code,
      customer_id: customerId,
      customer_info: {
        name: customer.full_name,
        phone: customer.phone,
        address: "Địa chỉ demo tại TP.HCM",
      },
      payment_status: item.payment_status,
      processing_status: item.processing_status,
      sales_channel: item.sales_channel,
      shipping_service: item.shipping_service,
      shipping_fee: item.shipping_fee,
      ...paymentFields,
      payment_notes: item.payment_notes,
      tracking_code: item.tracking_code,
      shipping_status: item.shipping_status,
      warehouse_status: item.warehouse_status,
      order_notes: item.order_notes,
      created_by: "Seed Demo",
      order_items: item.order_items.map((orderItem) => {
        const unitPrice = VARIANT_PRICE_BY_SKU.get(orderItem.sku);

        if (!unitPrice) {
          throw new Error(`Không tìm thấy đơn giá cho SKU ${orderItem.sku}`);
        }

        return {
          variant_sku: orderItem.sku,
          sku: orderItem.sku,
          quantity: orderItem.quantity,
          unit_price: unitPrice,
          discount_amount: 0,
        };
      }),
    });

    createdOrderCodes.push(order.order_code);
  }

  return createdOrderCodes;
}

async function main() {
  const { tenant, store, superAdmin } = await ensureCoreSeed();

  if (!superAdmin || !store) {
    throw new Error("SUPER_ADMIN_EMAIL và SUPER_ADMIN_PASSWORD là bắt buộc để seed demo.");
  }

  const categoryIdsByName = await ensureDemoCategories(store.id);
  const productSkus = await ensureDemoProducts(store.id, categoryIdsByName);
  const inventorySkus = await ensureDemoInventory(productSkus);
  const customers = await ensureDemoCustomers(store.id);
  const createdOrderCodes = await ensureDemoOrders(
    store.id,
    new Map(customers.map((customer) => [customer.phone, customer.id])),
  );

  console.log("Seed demo hoàn tất.");
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Store: ${store.name} (${store.slug})`);
  console.log(`Tài khoản quản trị: ${superAdmin.email}`);
  console.log(`Danh mục demo: ${Array.from(categoryIdsByName.keys()).join(", ")}`);
  console.log(`Số lượng mẫu túi demo: ${DEMO_PRODUCTS.length}`);
  console.log(`Tổng SKU demo: ${inventorySkus.length}`);
  console.log(`SKU đầu tiên: ${inventorySkus[0]}`);
  console.log(`SKU cuối cùng: ${inventorySkus[inventorySkus.length - 1]}`);
  console.log(`Khách hàng demo: ${customers.map((customer) => customer.full_name).join(", ")}`);
  console.log(`Đơn hàng demo: ${createdOrderCodes.join(", ")}`);
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
