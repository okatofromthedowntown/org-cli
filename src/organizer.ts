import fs from 'fs-extra';
import path from 'path';
import { z } from 'zod';

// --- Schema Definitions (Runtime & Type-safe) ---

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

// We can still export the interface for type-safety across the project
export type Config = z.infer<typeof ConfigSchema>;
export type ConfigSection<T> = { mode: ConfigMode; value: T };

// --- End of Schema ---

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

export function getTargetFolder(filename: string, config: Config): string | null {
  if (filename.endsWith('.app')) {
    return 'Installers';
  }
  const ext = path.extname(filename).toLowerCase();
  for (const rule of config.rules.value) {
    if (rule.match.includes(ext)) {
      return rule.target;
    }
  }
  return null;
}

export interface OrganizeStats {
  [key: string]: number;
}

export interface OrganizedResult {
  stats: OrganizeStats;
  logs: string[];
  tree: Record<string, string[]>;
  unmoved: { name: string; isDir: boolean }[];
}

export async function organize(targetDir: string, config: Config, dryRun: boolean = false): Promise<OrganizedResult> {
  const targetPath = path.resolve(targetDir);
  const items = await fs.readdir(targetPath);
  
  const stats: OrganizeStats = {};
  config.categories.value.forEach(cat => stats[cat] = 0);
  
  const logs: string[] = [];
  const tree: Record<string, string[]> = {};
  const unmoved: { name: string; isDir: boolean }[] = [];

  for (const itemName of items.sort()) {
    if (IGNORE_FILES.includes(itemName)) {
      unmoved.push({ name: itemName, isDir: false });
      continue;
    }

    const itemPath = path.join(targetPath, itemName);
    const stat = await fs.stat(itemPath);
    const isDir = stat.isDirectory();

    let targetFolder: string | null = null;
    if (!isDir || itemName.endsWith('.app')) {
      targetFolder = getTargetFolder(itemName, config);
    }

    if (targetFolder) {
      if (!tree[targetFolder]) tree[targetFolder] = [];
      tree[targetFolder].push(itemName);
      stats[targetFolder]++;

      if (!dryRun) {
        const destFolder = path.join(targetPath, targetFolder);
        let finalItemName = itemName;
        let destPath = path.join(destFolder, finalItemName);

        try {
          await fs.ensureDir(destFolder);
          if (await fs.pathExists(destPath)) {
            const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
            finalItemName = `${itemName}.${timestamp}`;
            destPath = path.join(destFolder, finalItemName);
            logs.push(`[Renamed] File '${itemName}' already exists, moving as '${finalItemName}'`);
          }
          await fs.move(itemPath, destPath);
          logs.push(`[Moved] '${itemName}' -> '${targetFolder}/${finalItemName}'`);
        } catch (err: any) {
          logs.push(`[Error] Could not move '${itemName}': {err.message}`);
          stats[targetFolder]--;
        }
      }
    } else {
      const fb = config.fallback.value;
      if (!dryRun && fb.action === 'move' && fb.target) {
        const targetFolder = fb.target;
        const destFolder = path.join(targetPath, targetFolder);
        let finalItemName = itemName;
        let destPath = path.join(destFolder, finalItemName);

        try {
          await fs.ensureDir(destFolder);
          if (await fs.pathExists(destPath)) {
            const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
            finalItemName = `${itemName}.${timestamp}`;
            destPath = path.join(destFolder, finalItemName);
            if (fb.log) logs.push(`[Fallback-Rename] '${itemName}' exists, moving as '${finalItemName}'`);
          }
          await fs.move(itemPath, destPath);
          if (fb.log) logs.push(`[Fallback-Move] '${itemName}' -> '${targetFolder}/${finalItemName}'`);
          
          if (!stats[targetFolder]) stats[targetFolder] = 0;
          stats[targetFolder]++;
        } catch (err: any) {
          logs.push(`[Fallback-Error] Could not move '${itemName}': {err.message}`);
        }
      } else {
        unmoved.push({ name: itemName, isDir });
        if (!dryRun && fb.log) {
          logs.push(`[Fallback] '${itemName}' (Action: {fb.action})`);
        }
      }
    }
  }

  return { stats, logs, tree, unmoved };
}
