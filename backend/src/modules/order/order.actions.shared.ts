import { Prisma } from "../../../generated/prisma/client";
import { getOrderForMutation } from "./order.persistence";

export type MutableOrder = Awaited<ReturnType<typeof getOrderForMutation>>;

export type OrderActionHistoryEntry = {
  event_type: string;
  description: string;
  actor_name: string | null;
  metadata: Prisma.InputJsonValue;
};

export type OrderActionPlan = {
  nextData: Prisma.OrderUpdateInput;
  historyEntry: OrderActionHistoryEntry;
};
