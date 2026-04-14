import { prisma } from "@lib/prisma";
import { CreateProductInput } from "./product.types";

export const ProductService = {
  createProduct: async (data: CreateProductInput) => {
    return await prisma.product.create({
      data: {
        product_id: data.product_id,
        product_name: data.product_name,
        image: data.image,
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
          : undefined,
        variants: data.variants?.length
          ? {
              create: data.variants.map(({ combinations, ...variant }) => variant)
            }
          : undefined
      },
      include: { attributes: { include: { values: true } }, variants: true }
    });
  },

  getProducts: async () => {
    return await prisma.product.findMany({
      include: { attributes: { include: { values: true } }, variants: true }
    });
  },

  getProductById: async (id: string) => {
    return await prisma.product.findUnique({
      where: { product_id: id },
      include: { attributes: { include: { values: true } }, variants: true }
    });
  }
};
