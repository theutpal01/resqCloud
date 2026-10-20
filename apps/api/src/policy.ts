import { Configuration } from "./database.js";
import {
  categories as supportedCategories,
  categoryDepartment,
} from "../../../packages/shared/src/index.js";

export const defaultResponseTargets = { high: 60, critical: 15 } as const;

export async function operationalPolicy() {
  const [currentCategories, currentTargets] = await Promise.all([
    Configuration.findOne({ where: { key: "incident-policy" } }),
    Configuration.findOne({ where: { key: "service-targets" } }),
  ]);
  const categoryValue = currentCategories?.get().value;
  const rawCategories =
    categoryValue && typeof categoryValue === "object"
      ? (categoryValue as { categories?: unknown }).categories
      : undefined;
  const categories =
    Array.isArray(rawCategories) &&
    rawCategories.every((category) => typeof category === "string")
      ? [...new Set(rawCategories)].filter(
          (category): category is (typeof supportedCategories)[number] =>
            (supportedCategories as readonly string[]).includes(category),
        )
      : [...supportedCategories];
  const rawDepartments =
    categoryValue && typeof categoryValue === "object"
      ? (categoryValue as { departmentsByCategory?: unknown })
          .departmentsByCategory
      : undefined;
  const configuredDepartments =
    rawDepartments && typeof rawDepartments === "object"
      ? (rawDepartments as Record<string, unknown>)
      : {};
  const departmentsByCategory = Object.fromEntries(
    supportedCategories.map((category) => {
      const value = configuredDepartments[category];
      return [
        category,
        Number.isInteger(value) && Number(value) > 0
          ? Number(value)
          : categoryDepartment[category],
      ];
    }),
  ) as Record<(typeof supportedCategories)[number], number>;
  const targetValue = currentTargets?.get().value;
  const targets =
    targetValue &&
    typeof targetValue === "object" &&
    Number.isInteger((targetValue as { high?: unknown }).high) &&
    Number.isInteger((targetValue as { critical?: unknown }).critical) &&
    Number((targetValue as { high: number }).high) > 0 &&
    Number((targetValue as { critical: number }).critical) > 0
      ? {
          high: Number((targetValue as { high: number }).high),
          critical: Number((targetValue as { critical: number }).critical),
        }
      : { ...defaultResponseTargets };
  return {
    categories: categories.length ? categories : [...supportedCategories],
    departmentsByCategory,
    targets,
  };
}
