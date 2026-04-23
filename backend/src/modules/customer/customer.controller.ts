import type { Request, Response } from "express";
import { BadRequestError } from "@/common";
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
    const customer = await CustomerService.createCustomer(
      parsePayload<CustomerRequestInput>(req.body),
    );
    return res.status(201).json(customer);
  },

  getCustomers: async (
    req: Request<{}, {}, {}, CustomerListQuery>,
    res: Response,
  ) => {
    const customers = await CustomerService.getCustomers(req.query);
    return res.status(200).json(customers);
  },

  getCustomerById: async (req: Request<CustomerParams>, res: Response) => {
    const customer = await CustomerService.getCustomerById(parseId(req.params.id));
    return res.status(200).json(customer);
  },

  updateCustomer: async (
    req: Request<CustomerParams, {}, UpdateCustomerRequestInput>,
    res: Response,
  ) => {
    const customer = await CustomerService.updateCustomer(
      parseId(req.params.id),
      parsePayload<UpdateCustomerRequestInput>(req.body),
    );
    return res.status(200).json(customer);
  },

  getCustomerCategories: async (_req: Request, res: Response) => {
    const categories = await CustomerService.getCustomerCategories();
    return res.status(200).json(categories);
  },

  deleteCustomers: async (
    req: Request<CustomerParams, {}, BulkDeleteRequestInput>,
    res: Response,
  ) => {
    const result = await CustomerService.deleteCustomers(parseIds(req.body));
    return res.status(200).json(result);
  },

  deleteCustomer: async (req: Request<CustomerParams>, res: Response) => {
    const result = await CustomerService.deleteCustomers([parseId(req.params.id)]);
    return res.status(200).json(result);
  },

  restoreCustomer: async (req: Request<CustomerParams>, res: Response) => {
    const customer = await CustomerService.restoreCustomer(parseId(req.params.id));
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
