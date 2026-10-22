import { z } from 'zod';

export const blockSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((b) => b.startMinute !== b.endMinute, { message: 'start and end must differ' });

export const profileInputSchema = z.object({
  gradeGoal: z.enum(['A_TRACK', 'PASS_TRACK']),
  workStyle: z.enum(['SOLO', 'GROUP']),
  blocks: z.array(blockSchema).min(1),
});

export type Block = z.infer<typeof blockSchema>;
export type ProfileInput = z.infer<typeof profileInputSchema>;

// A block that ends before it starts crosses midnight: split it into two days.
export function normalizeBlocks(blocks: Block[]): Block[] {
  return blocks.flatMap((b) =>
    b.endMinute > b.startMinute
      ? [b]
      : [
          { weekday: b.weekday, startMinute: b.startMinute, endMinute: 1440 },
          { weekday: (b.weekday + 1) % 7, startMinute: 0, endMinute: b.endMinute },
        ],
  );
}
