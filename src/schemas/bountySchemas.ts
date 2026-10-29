import { z } from 'zod';

export const createBountySchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(5).max(5000),
  creator_address: z.string().regex(/^G[A-Z0-9]{55}$/, 'Invalid Stellar public key'),
  target_amount: z.number().positive(),
  contract_id: z.string().optional(),
});

export const createMilestoneSchema = z.object({
  contract_milestone_id: z.number().int().positive(),
  description: z.string().min(3).max(250),
  reward_amount: z.number().positive(),
  recipient_address: z.string().regex(/^G[A-Z0-9]{55}$/, 'Invalid Stellar public key'),
  approval_threshold: z.number().int().min(1).default(2),
});
