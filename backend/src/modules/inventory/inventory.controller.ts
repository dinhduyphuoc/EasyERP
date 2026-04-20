import type { Request, Response } from "express";
import { BadRequestError } from "@/common";
import { InventoryService } from "./inventory.service";
import type {
  InventoryAdjustInput,
  InventoryAuditFinalizeInput,
  InventoryAuditListQuery,
  InventoryAuditParams,
  InventoryAuditUpsertInput,
  InventoryHistoryQuery,
  InventoryInitializeInput,
  InventoryParams,
  InventoryStockListQuery,
  InventoryQuantityCommandInput,
} from "./inventory.types";

const parseId = (value: string | undefined) => {
  const id = Number(value);

  if (!value || Number.isNaN(id) || id <= 0) {
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

export const InventoryController = {
  getStockList: async (
    req: Request<{}, {}, {}, InventoryStockListQuery>,
    res: Response,
  ) => {
    const data = await InventoryService.getStockList(req.query);
    return res.status(200).json(data);
  },

  getAuditList: async (
    req: Request<{}, {}, {}, InventoryAuditListQuery>,
    res: Response,
  ) => {
    const data = await InventoryService.getAuditList(req.query);
    return res.status(200).json(data);
  },

  getAuditById: async (req: Request<InventoryAuditParams>, res: Response) => {
    const data = await InventoryService.getAuditById(parseId(req.params.id));
    return res.status(200).json(data);
  },

  getInventory: async (req: Request<InventoryParams>, res: Response) => {
    const data = await InventoryService.getInventory(req.params.productVariantId);
    return res.status(200).json(data);
  },

  getHistory: async (
    req: Request<InventoryParams, {}, {}, InventoryHistoryQuery>,
    res: Response,
  ) => {
    const data = await InventoryService.getHistory(req.params.productVariantId, req.query);
    return res.status(200).json(data);
  },

  initialize: async (req: Request<{}, {}, InventoryInitializeInput>, res: Response) => {
    const data = await InventoryService.initialize(parsePayload<InventoryInitializeInput>(req.body));
    return res.status(201).json(data);
  },

  createAudit: async (req: Request<{}, {}, InventoryAuditUpsertInput>, res: Response) => {
    const data = await InventoryService.createAudit(parsePayload<InventoryAuditUpsertInput>(req.body));
    return res.status(201).json(data);
  },

  updateAudit: async (
    req: Request<InventoryAuditParams, {}, InventoryAuditUpsertInput>,
    res: Response,
  ) => {
    const data = await InventoryService.updateAudit(
      parseId(req.params.id),
      parsePayload<InventoryAuditUpsertInput>(req.body),
    );
    return res.status(200).json(data);
  },

  deleteAudit: async (req: Request<InventoryAuditParams>, res: Response) => {
    await InventoryService.deleteAudit(parseId(req.params.id));
    return res.status(204).send();
  },

  completeAudit: async (
    req: Request<InventoryAuditParams, {}, InventoryAuditFinalizeInput>,
    res: Response,
  ) => {
    const data = await InventoryService.completeAudit(
      parseId(req.params.id),
      parsePayload<InventoryAuditFinalizeInput>(req.body),
    );
    return res.status(200).json(data);
  },

  adjust: async (req: Request<{}, {}, InventoryAdjustInput>, res: Response) => {
    const data = await InventoryService.adjust(parsePayload<InventoryAdjustInput>(req.body));
    return res.status(200).json(data);
  },

  reserve: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    const data = await InventoryService.reserve(parsePayload<InventoryQuantityCommandInput>(req.body));
    return res.status(200).json(data);
  },

  release: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    const data = await InventoryService.release(parsePayload<InventoryQuantityCommandInput>(req.body));
    return res.status(200).json(data);
  },

  moveToPacking: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    const data = await InventoryService.moveToPacking(
      parsePayload<InventoryQuantityCommandInput>(req.body),
    );
    return res.status(200).json(data);
  },

  packCancel: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    const data = await InventoryService.packCancel(
      parsePayload<InventoryQuantityCommandInput>(req.body),
    );
    return res.status(200).json(data);
  },

  fulfill: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    const data = await InventoryService.fulfill(parsePayload<InventoryQuantityCommandInput>(req.body));
    return res.status(200).json(data);
  },

  returnRestock: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    const data = await InventoryService.returnRestock(
      parsePayload<InventoryQuantityCommandInput>(req.body),
    );
    return res.status(200).json(data);
  },

  incomingCreate: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    const data = await InventoryService.incomingCreate(
      parsePayload<InventoryQuantityCommandInput>(req.body),
    );
    return res.status(200).json(data);
  },

  incomingReceive: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    const data = await InventoryService.incomingReceive(
      parsePayload<InventoryQuantityCommandInput>(req.body),
    );
    return res.status(200).json(data);
  },
};
