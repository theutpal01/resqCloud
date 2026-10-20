import { Op, type WhereOptions } from "sequelize";
import type { z } from "zod";
import type { dateRangeQuerySchema } from "../../../packages/shared/src/index.js";

type DateRange = z.infer<typeof dateRangeQuerySchema>;

export function withCreatedAtRange(
  scopeWhere: WhereOptions,
  range: DateRange,
): WhereOptions {
  const createdAt = {
    ...(range.from
      ? { [Op.gte]: new Date(`${range.from}T00:00:00.000Z`) }
      : {}),
    ...(range.to
      ? {
          [Op.lt]: new Date(
            new Date(`${range.to}T00:00:00.000Z`).getTime() + 86400000,
          ),
        }
      : {}),
  };
  return Reflect.ownKeys(createdAt).length
    ? { [Op.and]: [scopeWhere, { createdAt }] }
    : scopeWhere;
}
