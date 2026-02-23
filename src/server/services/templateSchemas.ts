import { z } from "zod";

export const templateSchemaV1 = z.object({
  version: z.literal(1),
  description: z.string().optional(),
  allowedBlockTypes: z.array(z.string().min(1)),
  defaultBlocks: z.array(
    z.object({
      key: z.string().min(1).optional(),
      type: z.string().min(1),
      title: z.string().nullable().optional(),
      contentMd: z.string().optional(),
      meta: z.record(z.unknown()).optional(),
    }),
  ),
});

export type TemplateSchemaV1 = z.infer<typeof templateSchemaV1>;
