import { z } from "zod";

export const envConfig = z
  .object({
    USE_SQLITE_SEARCH: z
      .string()
      .refine((s) => s === "true" || s === "false")
      .transform((s) => s === "true")
      .optional()
      .default("false"),
  })
  .parse(process.env);
