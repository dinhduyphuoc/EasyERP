import type { Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "@/common";
import { createOrder, runAction, updateOrder } from "./order.commands";
import {
  duplicateOrder,
  getGHNOrderInfo,
  getGHNPrintInfo,
  getGHNTrackingLogs,
  getOrderById,
  getOrderForEdit,
  getOrderHistory,
  getOrderInvoicePdf,
  getOrderInvoicePrintHtml,
  getOrderOverview,
  getOrderOptions,
  getOrders,
  searchOrderCustomers,
  searchOrderProducts,
} from "./order.reads";
import type { OrderActorContext } from "./order.helpers";
import type {
  DuplicateOrderRequestInput,
  OrderActionName,
  OrderActionRequestInput,
  OrderListQuery,
  OrderParams,
  OrderRequestInput,
  OrderShippingOrderInfoResponse,
  OrderShippingTrackingLogsResponse,
  OrderShippingPrintResponse,
  OrderHistoryResponseItem,
  OrderOverviewQuery,
  OrderOverviewResponse,
  OrderOptionSearchQuery,
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

const shouldDownload = (value: unknown) => value === "1" || value === "true" || value === true;

const requireStoreContext = (req: { store?: Request["store"] }) => {
  if (!req.store) {
    throw new UnauthorizedError("Store context is required");
  }

  return req.store;
};

const getOrderActorContext = (req: { auth?: Request["auth"] }): OrderActorContext | undefined =>
  req.auth
    ? {
        userId: req.auth.user.id,
        tenantId: req.auth.user.tenant_id,
        fullName: req.auth.user.full_name,
        permissions: req.auth.permissions,
      }
    : undefined;

export const OrderController = {
  getOrderOptions: async (_req: Request, res: Response) => {
    const store = requireStoreContext(_req);
    const options = await getOrderOptions(store.id);
    return res.status(200).json(options);
  },

  getOrders: async (
    req: Request<{}, {}, {}, OrderListQuery>,
    res: Response,
  ) => {
    const store = requireStoreContext(req);
    const orders = await getOrders(store.id, req.query);
    return res.status(200).json(orders);
  },

  getOrderOverview: async (
    req: Request<{}, {}, {}, OrderOverviewQuery>,
    res: Response,
  ) => {
    const store = requireStoreContext(req);
    const overview = await getOrderOverview(store.id, req.query);
    return res.status(200).json(overview satisfies OrderOverviewResponse);
  },

  searchCustomers: async (
    req: Request<{}, {}, {}, OrderOptionSearchQuery>,
    res: Response,
  ) => {
    const store = requireStoreContext(req);
    const customers = await searchOrderCustomers(store.id, req.query);
    return res.status(200).json({ items: customers });
  },

  searchProducts: async (
    req: Request<{}, {}, {}, OrderOptionSearchQuery>,
    res: Response,
  ) => {
    const store = requireStoreContext(req);
    const products = await searchOrderProducts(store.id, req.query);
    return res.status(200).json({ items: products });
  },

  getOrderById: async (req: Request<OrderParams>, res: Response) => {
    const store = requireStoreContext(req);
    const order = await getOrderById(store.id, parseId(req.params.id));
    return res.status(200).json(order);
  },

  getOrderForEdit: async (req: Request<OrderParams>, res: Response) => {
    const store = requireStoreContext(req);
    const order = await getOrderForEdit(store.id, parseId(req.params.id));
    return res.status(200).json(order);
  },

  getOrderHistory: async (req: Request<OrderParams>, res: Response) => {
    const store = requireStoreContext(req);
    const history = await getOrderHistory(store.id, parseId(req.params.id));
    return res.status(200).json(history satisfies OrderHistoryResponseItem[]);
  },

  getInvoicePrintReadyHtml: async (req: Request<OrderParams, {}, {}, { download?: string }>, res: Response) => {
    const store = requireStoreContext(req);
    const data = await getOrderInvoicePrintHtml({
      storeId: store.id,
      orderId: parseId(req.params.id),
      tenantId: req.auth?.user.tenant_id ?? null,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `${shouldDownload(req.query.download) ? "attachment" : "inline"}; filename="${data.file_name}"`,
    );
    return res.status(200).send(data.html);
  },

  getInvoicePdf: async (req: Request<OrderParams, {}, {}, { download?: string }>, res: Response) => {
    const store = requireStoreContext(req);
    const data = await getOrderInvoicePdf({
      storeId: store.id,
      orderId: parseId(req.params.id),
      tenantId: req.auth?.user.tenant_id ?? null,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${shouldDownload(req.query.download) ? "attachment" : "inline"}; filename="${data.file_name}"`,
    );
    return res.status(200).send(data.buffer);
  },

  getGHNPrintInfo: async (req: Request<OrderParams>, res: Response) => {
    const store = requireStoreContext(req);
    const data = await getGHNPrintInfo(store.id, parseId(req.params.id));
    return res.status(200).json(data satisfies OrderShippingPrintResponse);
  },

  getGHNOrderInfo: async (req: Request<OrderParams>, res: Response) => {
    const store = requireStoreContext(req);
    const data = await getGHNOrderInfo(store.id, parseId(req.params.id));
    return res.status(200).json(data satisfies OrderShippingOrderInfoResponse);
  },

  getGHNTrackingLogs: async (req: Request<OrderParams>, res: Response) => {
    const store = requireStoreContext(req);
    const data = await getGHNTrackingLogs(store.id, parseId(req.params.id));
    return res.status(200).json(data satisfies OrderShippingTrackingLogsResponse);
  },

  createOrder: async (
    req: Request<{}, {}, OrderRequestInput>,
    res: Response,
  ) => {
    const store = requireStoreContext(req);
    const order = await createOrder(store.id, parsePayload<OrderRequestInput>(req.body), getOrderActorContext(req));
    return res.status(201).json(order);
  },

  updateOrder: async (
    req: Request<OrderParams, {}, UpdateOrderRequestInput>,
    res: Response,
  ) => {
    const store = requireStoreContext(req);
    const order = await updateOrder(
      store.id,
      parseId(req.params.id),
      parsePayload<UpdateOrderRequestInput>(req.body),
      getOrderActorContext(req),
    );
    return res.status(200).json(order);
  },

  duplicateOrder: async (
    req: Request<OrderParams, {}, DuplicateOrderRequestInput>,
    res: Response,
  ) => {
    const store = requireStoreContext(req);
    const order = await duplicateOrder(
      store.id,
      parseId(req.params.id),
      req.body && typeof req.body === "object"
        ? (req.body as DuplicateOrderRequestInput)
        : {},
      getOrderActorContext(req),
    );
    return res.status(201).json(order);
  },

  runAction: async (
    req: Request<{ id?: string; action?: string }, {}, OrderActionRequestInput>,
    res: Response,
  ) => {
    if (!req.params.action) {
      throw new BadRequestError("Invalid action");
    }
    const store = requireStoreContext(req);

    const order = await runAction(
      store.id,
      parseId(req.params.id),
      req.params.action as OrderActionName,
      parsePayload<OrderActionRequestInput>(req.body),
    );
    return res.status(200).json(order);
  },
};
