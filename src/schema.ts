import { z } from 'zod';

// --- Configuration Schema ---

export const ConfigModeSchema = z.enum(['inherit', 'override']);
export type ConfigMode = z.infer<typeof ConfigModeSchema>;

export const ConfigRuleSchema = z.object({
  match: z.array(z.string()),
  target: z.string(),
  /**
   * Priority of the rule. 
   * Rule with SMALLER value has HIGHER priority (e.g., -1 > 0 > 1).
   * Rules with the same priority follow the order of definition.
   * @default 0
   */
  priority: z.number().default(0)
});
export type ConfigRule = z.infer<typeof ConfigRuleSchema>;

export const FallbackConfigSchema = z.object({
  action: z.enum(['skip', 'move']),
  target: z.string().optional(),
  log: z.boolean()
});
export type FallbackConfig = z.infer<typeof FallbackConfigSchema>;

export function createConfigSectionSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    mode: ConfigModeSchema,
    value: valueSchema
  });
}

export const ConfigSchema = z.object({
  categories: createConfigSectionSchema(z.array(z.string())),
  rules: createConfigSectionSchema(z.array(ConfigRuleSchema)),
  fallback: createConfigSectionSchema(FallbackConfigSchema),
  playground: z.object({
    folder: z.string().default('playground'),
    files: z.array(z.string())
  }).optional()
});

export type Config = z.infer<typeof ConfigSchema>;
export type ConfigSection<T> = { mode: ConfigMode; value: T };

// --- Plan & Decision Types ---

export interface Decision {
  action: 'move' | 'skip';
  target?: string;
  reason: string;
  source: 'rule' | 'fallback' | 'ignore';
}

export interface PlanItem {
  from: string;
  to?: string;
  decision: Decision;
}

export interface Plan {
  items: PlanItem[];
  stats: Record<string, number>;
}
