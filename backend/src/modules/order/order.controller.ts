import type { Request, Response } from "express";
import { BadRequestError } from "@/common";
import { OrderService } from "./order.service";
import type {
  DuplicateOrderRequestInput,
  OrderActionName,
  OrderActionRequestInput,
  OrderListQuery,
  OrderParams,
  OrderRequestInput,
  OrderShippingPrintResponse,
  UpdateOrderRequestInput,
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

  getGHNPrintInfo: async (req: Request<OrderParams>, res: Response) => {
    const data = await OrderService.getGHNPrintInfo(parseId(req.params.id));
    return res.status(200).json(data satisfies OrderShippingPrintResponse);
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

  updateOrder: async (
    req: Request<OrderParams, {}, UpdateOrderRequestInput>,
    res: Response,
  ) => {
    const order = await OrderService.updateOrder(
      parseId(req.params.id),
      parsePayload<UpdateOrderRequestInput>(req.body),
    );
    return res.status(200).json(order);
  },

  duplicateOrder: async (
    req: Request<OrderParams, {}, DuplicateOrderRequestInput>,
    res: Response,
  ) => {
    const order = await OrderService.duplicateOrder(
      parseId(req.params.id),
      req.body && typeof req.body === "object"
        ? (req.body as DuplicateOrderRequestInput)
        : {},
    );
    return res.status(201).json(order);
  },

  runAction: async (
    req: Request<OrderParams & { action: OrderActionName }, {}, OrderActionRequestInput>,
    res: Response,
  ) => {
    const order = await OrderService.runAction(
      parseId(req.params.id),
      req.params.action,
      parsePayload<OrderActionRequestInput>(req.body),
    );
    return res.status(200).json(order);
  },
};
