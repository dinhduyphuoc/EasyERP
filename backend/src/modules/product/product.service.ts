import { prisma } from "@lib/prisma";
import { CreateProductInput } from "./product.types";

const productInclude = {
  attributes: { include: { values: true } },
  variants: {
    include: {
      attribute_values: {
        include: {
          attribute_value: true
        }
      }
    }
  }
} as const;

export const ProductService = {
  createProduct: async (data: CreateProductInput) => {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          product_name: data.product_name,
          image_url: data.image_url,
          status: data.status,
          description: data.description,
          createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
          category_id: data.category_id,
          attributes: data.attributes?.length
            ? {
                create: data.attributes.map((attribute) => ({
                  name: attribute.name,
                  values: {
                    create: attribute.values.map((value) => ({ value }))
                  }
                }))
              }
            : undefined
        },
        include: { attributes: { include: { values: true } } }
      });

      const attributeValueMap = new Map<string, number>();

      for (const attribute of product.attributes) {
        for (const attributeValue of attribute.values) {
          if (attributeValueMap.has(attributeValue.value)) {
            throw new Error(
              `Duplicate attribute value "${attributeValue.value}" is not supported across attributes`,
            );
          }

          attributeValueMap.set(attributeValue.value, attributeValue.id);
        }
      }

      if (data.variants?.length) {
        for (const variant of data.variants) {
          const attributeValueIds = variant.combinations.map((combination) => {
            const attributeValueId = attributeValueMap.get(combination);

            if (!attributeValueId) {
              throw new Error(
                `Combination value "${combination}" does not exist in product attributes`,
              );
            }

            return attributeValueId;
          });

          await tx.productVariant.create({
            data: {
              sku: variant.sku,
              product_id: product.product_id,
              selling_price: variant.selling_price,
              cost_price_ref: variant.cost_price_ref,
              image_url: variant.image_url,
              attribute_values: attributeValueIds.length
                ? {
                    create: attributeValueIds.map((attributeValueId) => ({
                      attribute_value_id: attributeValueId
                    }))
                  }
                : undefined
            }
          });
        }
      }

      return await tx.product.findUniqueOrThrow({
        where: { product_id: product.product_id },
        include: productInclude
      });
    });
  },

  getProducts: async () => {
    return await prisma.product.findMany({
      include: productInclude
    });
  },

  getProductById: async (id: number) => {
    return await prisma.product.findUnique({
      where: { product_id: id },
      include: productInclude
    });
  }
};
