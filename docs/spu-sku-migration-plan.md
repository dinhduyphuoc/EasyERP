# SPU / SKU Migration Plan

## Current baseline

- `Product` acts as the SPU/catalog record.
- `ProductVariant` acts as the SKU record.
- The real relation already exists through `ProductVariant.product_id -> Product.id`.
- Some API contracts still use legacy names such as `default_variant_sku` and `variant_sku`.

## Target model

- Keep `Product` as SPU.
- Keep `ProductVariant` as SKU for now, or rename later if desired.
- Make all transactional workflows resolve to a concrete SKU.
- Do not infer SPU-SKU relation from text code patterns.

## Recommended database migration

1. Add a surrogate numeric/string `id` on `ProductVariant` while keeping `sku` unique.
2. Add `Product.default_sku_id` referencing the SKU table.
3. Add `OrderItem.sku_id` and keep `sku` as immutable snapshot text.
4. Add `InventoryStock.sku_id`, `InventoryTransaction.sku_id`, and `InventoryAuditLine.sku_id`.
5. Keep `product_id` on `OrderItem` as `spu_id` trace if useful for analytics.

## Data backfill

1. Backfill `ProductVariant.id` for all existing SKUs.
2. For each `Product`, map `default_variant_sku` to the corresponding SKU row and store it in `default_sku_id`.
3. For products without variants in legacy data, create one default SKU and bind it to the SPU.
4. Backfill `OrderItem.sku_id` by matching `variant_sku` first, then `sku` snapshot if unique.
5. Backfill all inventory tables from `product_variant_id` to `sku_id`.

## Safety rules

- If a historical order line cannot be mapped to exactly one SKU, stop and send it to manual review.
- Preserve all existing text snapshots on order lines to avoid rewriting history.
- Run dual-write for one rollout window before removing legacy fields from reads/writes.

## Follow-up application cleanup

- Replace `default_variant_sku` in API responses with `default_sku_code` and `default_sku_id`.
- Replace `variant_sku` request usage with `sku_code` / `sku_id`.
- Add import APIs that group rows by SPU and create inventory strictly by SKU.
- Add marketplace mapping entities keyed by local SKU, not by SPU code text.
