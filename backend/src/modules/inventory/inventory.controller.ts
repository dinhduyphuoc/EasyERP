import type { Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "@/common";
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
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.getStockList(req.store.id, req.query);
    return res.status(200).json(data);
  },

  getAuditList: async (
    req: Request<{}, {}, {}, InventoryAuditListQuery>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.getAuditList(req.store.id, req.query);
    return res.status(200).json(data);
  },

  getAuditById: async (req: Request<InventoryAuditParams>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.getAuditById(req.store.id, parseId(req.params.id));
    return res.status(200).json(data);
  },

  getInventory: async (req: Request<InventoryParams>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.getInventory(req.store.id, req.params.productVariantId);
    return res.status(200).json(data);
  },

  getHistory: async (
    req: Request<InventoryParams, {}, {}, InventoryHistoryQuery>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.getHistory(req.store.id, req.params.productVariantId, req.query);
    return res.status(200).json(data);
  },

  initialize: async (req: Request<{}, {}, InventoryInitializeInput>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.initialize(req.store.id, parsePayload<InventoryInitializeInput>(req.body));
    return res.status(201).json(data);
  },

  createAudit: async (req: Request<{}, {}, InventoryAuditUpsertInput>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.createAudit(req.store.id, parsePayload<InventoryAuditUpsertInput>(req.body));
    return res.status(201).json(data);
  },

  updateAudit: async (
    req: Request<InventoryAuditParams, {}, InventoryAuditUpsertInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.updateAudit(
      req.store.id,
      parseId(req.params.id),
      parsePayload<InventoryAuditUpsertInput>(req.body),
    );
    return res.status(200).json(data);
  },

  deleteAudit: async (req: Request<InventoryAuditParams>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    await InventoryService.deleteAudit(req.store.id, parseId(req.params.id));
    return res.status(204).send();
  },

  completeAudit: async (
    req: Request<InventoryAuditParams, {}, InventoryAuditFinalizeInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.completeAudit(
      req.store.id,
      parseId(req.params.id),
      parsePayload<InventoryAuditFinalizeInput>(req.body),
    );
    return res.status(200).json(data);
  },

  adjust: async (req: Request<{}, {}, InventoryAdjustInput>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.adjust(req.store.id, parsePayload<InventoryAdjustInput>(req.body));
    return res.status(200).json(data);
  },

  reserve: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.reserve(req.store.id, parsePayload<InventoryQuantityCommandInput>(req.body));
    return res.status(200).json(data);
  },

  release: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.release(req.store.id, parsePayload<InventoryQuantityCommandInput>(req.body));
    return res.status(200).json(data);
  },

  moveToPacking: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.moveToPacking(
      req.store.id,
      parsePayload<InventoryQuantityCommandInput>(req.body),
    );
    return res.status(200).json(data);
  },

  packCancel: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.packCancel(
      req.store.id,
      parsePayload<InventoryQuantityCommandInput>(req.body),
    );
    return res.status(200).json(data);
  },

  fulfill: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.fulfill(req.store.id, parsePayload<InventoryQuantityCommandInput>(req.body));
    return res.status(200).json(data);
  },

  returnRestock: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.returnRestock(
      req.store.id,
      parsePayload<InventoryQuantityCommandInput>(req.body),
    );
    return res.status(200).json(data);
  },

  incomingCreate: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.incomingCreate(
      req.store.id,
      parsePayload<InventoryQuantityCommandInput>(req.body),
    );
    return res.status(200).json(data);
  },

  incomingReceive: async (req: Request<{}, {}, InventoryQuantityCommandInput>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const data = await InventoryService.incomingReceive(
      req.store.id,
      parsePayload<InventoryQuantityCommandInput>(req.body),
    );
    return res.status(200).json(data);
  },
};
