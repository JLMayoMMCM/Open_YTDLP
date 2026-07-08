import { z } from "zod";

export const probeRequestSchema = z.object({
  url: z.string().trim().min(1, "URL is required"),
  cookies: z.string().trim().min(1).optional(),
});

export const resolveRequestSchema = z.object({
  url: z.string().trim().min(1, "URL is required"),
  formatIds: z
    .array(z.string().trim().min(1))
    .min(1, "At least one format ID is required")
    .max(2, "At most two format IDs (video+audio) can be resolved together"),
  cookies: z.string().trim().min(1).optional(),
});
