export interface CreateProductInput {
  product_name: string;
  image_url?: string;
  status?: string;
  description?: string;
  createdAt?: string | Date;
  category_id?: number;
  attributes?: {
    name: string;
    values: string[];
  }[];
  variants?: {
    sku: string;
    selling_price: number;
    cost_price_ref: number;
    image_url?: string;
    combinations: string[];
  }[];
}
