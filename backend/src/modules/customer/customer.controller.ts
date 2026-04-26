import type { Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "@/common";
import { CustomerService } from "./customer.service";
import type {
  BulkDeleteRequestInput,
  CustomerListQuery,
  CustomerParams,
  CustomerRequestInput,
  LocationListQuery,
  UpdateCustomerRequestInput,
} from "./customer.types";

const parsePayload = <T>(body: unknown) => {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body is required");
  }

  return body as T;
};

const parseIds = (body: unknown) => {
  const payload = parsePayload<BulkDeleteRequestInput>(body);

  if (!Array.isArray(payload.ids) || payload.ids.length === 0) {
    throw new BadRequestError("ids must be a non-empty array");
  }

  const ids = payload.ids.map((value) => Number(value));

  if (ids.some((id) => Number.isNaN(id) || id <= 0 || !Number.isInteger(id))) {
    throw new BadRequestError("ids must contain valid positive integers");
  }

  return [...new Set(ids)];
};

const parseId = (value: string | undefined) => {
  const id = Number(value);

  if (!value || Number.isNaN(id) || id <= 0 || !Number.isInteger(id)) {
    throw new BadRequestError("Invalid id");
  }

  return id;
};

export const CustomerController = {
  createCustomer: async (
    req: Request<{}, {}, CustomerRequestInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const customer = await CustomerService.createCustomer(
      req.store.id,
      parsePayload<CustomerRequestInput>(req.body),
    );
    return res.status(201).json(customer);
  },

  getCustomers: async (
    req: Request<{}, {}, {}, CustomerListQuery>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const customers = await CustomerService.getCustomers(req.store.id, req.query);
    return res.status(200).json(customers);
  },

  getCustomerById: async (req: Request<CustomerParams>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const customer = await CustomerService.getCustomerById(req.store.id, parseId(req.params.id));
    return res.status(200).json(customer);
  },

  updateCustomer: async (
    req: Request<CustomerParams, {}, UpdateCustomerRequestInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const customer = await CustomerService.updateCustomer(
      req.store.id,
      parseId(req.params.id),
      parsePayload<UpdateCustomerRequestInput>(req.body),
    );
    return res.status(200).json(customer);
  },

  getCustomerCategories: async (_req: Request, res: Response) => {
    if (!_req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const categories = await CustomerService.getCustomerCategories(_req.store.id);
    return res.status(200).json(categories);
  },

  deleteCustomers: async (
    req: Request<CustomerParams, {}, BulkDeleteRequestInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const result = await CustomerService.deleteCustomers(req.store.id, parseIds(req.body));
    return res.status(200).json(result);
  },

  deleteCustomer: async (req: Request<CustomerParams>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const result = await CustomerService.deleteCustomers(req.store.id, [parseId(req.params.id)]);
    return res.status(200).json(result);
  },

  restoreCustomer: async (req: Request<CustomerParams>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const customer = await CustomerService.restoreCustomer(req.store.id, parseId(req.params.id));
    return res.status(200).json(customer);
  },

  getStates: async (
    req: Request<{}, {}, {}, LocationListQuery>,
    res: Response,
  ) => {
    const states = await CustomerService.getStates(req.query);
    return res.status(200).json(states);
  },

  getCities: async (
    req: Request<{}, {}, {}, LocationListQuery>,
    res: Response,
  ) => {
    const cities = await CustomerService.getCities(req.query);
    return res.status(200).json(cities);
  },

  getDistricts: async (
    req: Request<{}, {}, {}, LocationListQuery>,
    res: Response,
  ) => {
    const districts = await CustomerService.getDistricts(req.query);
    return res.status(200).json(districts);
  },
};
