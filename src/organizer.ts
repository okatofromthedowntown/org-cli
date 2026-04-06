import fs from 'fs-extra';
import path from 'path';
import { z } from 'zod';

// --- Schema Definitions ---

export const ConfigModeSchema = z.enum(['inherit', 'override']);
export type ConfigMode = z.infer<typeof ConfigModeSchema>;

export const ConfigRuleSchema = z.object({
  match: z.array(z.string()),
  target: z.string(),
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
  fallback: createConfigSectionSchema(FallbackConfigSchema)
});

export type Config = z.infer<typeof ConfigSchema>;
export type ConfigSection<T> = { mode: ConfigMode; value: T };

// --- New Plan-Execution Types ---

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

// --- Constants ---

export const IGNORE_FILES = [
  'organize_files.py',
  'organization_plan.md',
  '.DS_Store',
  '.localized',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'node_modules',
  'src',
  'dist',
  '.git',
  '.gitignore',
  'README.md',
  'strategy.config.json'
];

// --- Core Engine ---

/**
 * 决策引擎：根据文件和配置，决定该如何处理。
 */
export function decide(filename: string, isDir: boolean, config: Config): Decision {
  // 1. Check Ignore
  if (IGNORE_FILES.includes(filename)) {
    return { action: 'skip', reason: 'Ignored file', source: 'ignore' };
  }

  // 2. Try Rules (Higher priority first)
  if (!isDir || filename.endsWith('.app')) {
    const ext = path.extname(filename).toLowerCase();
    for (const rule of config.rules.value) {
      if (rule.match.includes(ext)) {
        return { 
          action: 'move', 
          target: rule.target, 
          reason: `Matched rule [${rule.match.join(', ')}]`, 
          source: 'rule' 
        };
      }
    }
  }

  // 3. Fallback
  const fb = config.fallback.value;
  return {
    action: fb.action,
    target: fb.target,
    reason: `No rules matched, applying fallback (${fb.action})`,
    source: 'fallback'
  };
}

/**
 * 计划生成器：扫描目录并生成完整的执行计划。
 */
export async function createPlan(targetDir: string, config: Config): Promise<Plan> {
  const targetPath = path.resolve(targetDir);
  const filenames = await fs.readdir(targetPath);
  
  const items: PlanItem[] = [];
  const stats: Record<string, number> = {};
  config.categories.value.forEach(cat => stats[cat] = 0);

  for (const name of filenames.sort()) {
    const filePath = path.join(targetPath, name);
    const stat = await fs.stat(filePath);
    const decision = decide(name, stat.isDirectory(), config);
    
    let to: string | undefined = undefined;
    if (decision.action === 'move' && decision.target) {
      to = path.join(targetPath, decision.target, name);
      if (!stats[decision.target]) stats[decision.target] = 0;
      stats[decision.target]++;
    }

    items.push({ from: name, to, decision });
  }

  return { items, stats };
}

/**
 * 执行器：按照计划进行实际的 IO 操作。
 */
export async function applyPlan(targetDir: string, plan: Plan, onProgress?: (msg: string) => void): Promise<string[]> {
  const targetPath = path.resolve(targetDir);
  const logs: string[] = [];

  for (const item of plan.items) {
    if (item.decision.action === 'skip') {
      if (item.decision.source === 'fallback' && onProgress) {
        onProgress(`[Fallback] '${item.from}' (Action: skip)`);
      }
      continue;
    }

    if (item.decision.action === 'move' && item.to && item.decision.target) {
      const destFolder = path.join(targetPath, item.decision.target);
      let finalDestPath = item.to;
      let finalName = item.from;

      try {
        await fs.ensureDir(destFolder);
        
        // Handle Collisions (Rename with timestamp)
        if (await fs.pathExists(finalDestPath)) {
          const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
          finalName = `${item.from}.${timestamp}`;
          finalDestPath = path.join(destFolder, finalName);
          const msg = `[Renamed] '${item.from}' already exists, moving as '${finalName}'`;
          logs.push(msg);
          if (onProgress) onProgress(msg);
        }

        await fs.move(path.join(targetPath, item.from), finalDestPath);
        const msg = `[Moved] '${item.from}' -> '${item.decision.target}/${finalName}' (${item.decision.reason})`;
        logs.push(msg);
        if (onProgress) onProgress(msg);
      } catch (err: any) {
        const msg = `[Error] Could not move '${item.from}': ${err.message}`;
        logs.push(msg);
        if (onProgress) onProgress(msg);
      }
    }
  }

  return logs;
}
