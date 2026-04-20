import type { Request, Response } from "express";
import { BadRequestError } from "@/common";
import { OrderService } from "./order.service";
import type {
  OrderListQuery,
  OrderParams,
  OrderRequestInput,
} from "./order.types";

const parseId = (value: string | undefined) => {
  const id = Number(value);

  if (!value || Number.isNaN(id) || id <= 0 || !Number.isInteger(id)) {
    throw new BadRequestError("Invalid id");
  }

  return id;
};

const parsePayload = <T>(body: unknown) => {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body is required");
  }

  return body as T;
};

export const OrderController = {
  getOrderOptions: async (_req: Request, res: Response) => {
    const options = await OrderService.getOrderOptions();
    return res.status(200).json(options);
  },

  getOrders: async (
    req: Request<{}, {}, {}, OrderListQuery>,
    res: Response,
  ) => {
    const orders = await OrderService.getOrders(req.query);
    return res.status(200).json(orders);
  },

  getOrderById: async (req: Request<OrderParams>, res: Response) => {
    const order = await OrderService.getOrderById(parseId(req.params.id));
    return res.status(200).json(order);
  },

  createOrder: async (
    req: Request<{}, {}, OrderRequestInput>,
    res: Response,
  ) => {
    const order = await OrderService.createOrder(
      parsePayload<OrderRequestInput>(req.body),
    );
    return res.status(201).json(order);
  },
};
