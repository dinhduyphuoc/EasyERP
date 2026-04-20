ALTER TABLE "orders" RENAME TO "Order";
ALTER TABLE "order_items" RENAME TO "OrderItem";
ALTER TABLE "order_history" RENAME TO "OrderHistory";
ALTER TABLE "customers" RENAME TO "Customer";
ALTER TABLE "customer_categories" RENAME TO "CustomerCategory";
ALTER TABLE "cities" RENAME TO "City";
ALTER TABLE "states" RENAME TO "State";
ALTER TABLE "districts" RENAME TO "District";

ALTER TABLE "Product" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "Product" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "Product" RENAME COLUMN "categoryId" TO "category_id";

ALTER TABLE "ProductVariant" RENAME COLUMN "productId" TO "product_id";
ALTER TABLE "Attribute" RENAME COLUMN "productId" TO "product_id";
ALTER TABLE "AttributeValue" RENAME COLUMN "attributeId" TO "attribute_id";
ALTER TABLE "VariantAttributeValue" RENAME COLUMN "attributeValueId" TO "attribute_value_id";
