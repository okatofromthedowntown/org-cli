import fs from 'fs-extra';
import path from 'path';

export interface ConfigRule {
  match: string[];
  target: string;
}

export interface FallbackConfig {
  action: 'skip' | 'move';
  target?: string;
  log: boolean;
}

export interface Config {
  categories: string[];
  rules: ConfigRule[];
  fallback: FallbackConfig;
}

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
  for (const rule of config.rules) {
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
  config.categories.forEach(cat => stats[cat] = 0);
  
  const logs: string[] = [];
  const tree: Record<string, string[]> = {};
  const unmoved: { name: string; isDir: boolean }[] = [];

  for (const itemName of items.sort()) {
    // Also ignore the config file itself if it's in the same directory
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
          logs.push(`[Error] Could not move '${itemName}': ${err.message}`);
          stats[targetFolder]--;
        }
      }
    } else {
      // Fallback logic
      const fb = config.fallback;
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
          logs.push(`[Fallback-Error] Could not move '${itemName}': ${err.message}`);
        }
      } else {
        unmoved.push({ name: itemName, isDir });
        if (!dryRun && fb.log) {
          logs.push(`[Fallback] '${itemName}' (Action: ${fb.action})`);
        }
      }
    }
  }

  return { stats, logs, tree, unmoved };
}
