import fs from 'fs-extra';
import path from 'path';

export const EXT_MAP: Record<string, string[]> = {
  'Music': ['.mp3', '.m4a'],
  'Images': ['.jpg', '.jpeg', '.png', '.heic', '.webp'],
  'Documents': ['.pdf', '.epub', '.txt', '.md'],
  'Installers': ['.dmg', '.exe', '.iso', '.app'],
  'Archives': ['.zip'],
  'Videos': ['.mp4'],
  'Keys': ['.key', '.cer']
};

export const IGNORE_FILES = ['organize_files.py', 'organization_plan.md', '.DS_Store', '.localized', 'package.json', 'package-lock.json', 'tsconfig.json', 'node_modules', 'src', 'dist'];

export interface FileItem {
  name: string;
  isDir: boolean;
  targetFolder: string | null;
}

export function getTargetFolder(filename: string): string | null {
  if (filename.endsWith('.app')) {
    return 'Installers';
  }
  const ext = path.extname(filename).toLowerCase();
  for (const [folder, extensions] of Object.entries(EXT_MAP)) {
    if (extensions.includes(ext)) {
      return folder;
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

export async function organize(targetDir: string, dryRun: boolean = false): Promise<OrganizedResult> {
  const targetPath = path.resolve(targetDir);
  const items = await fs.readdir(targetPath);
  
  const stats: OrganizeStats = {};
  Object.keys(EXT_MAP).forEach(key => stats[key] = 0);
  
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
      targetFolder = getTargetFolder(itemName);
    }

    if (targetFolder) {
      if (!tree[targetFolder]) tree[targetFolder] = [];
      tree[targetFolder].push(itemName);
      stats[targetFolder]++;

      if (!dryRun) {
        const destFolder = path.join(targetPath, targetFolder);
        const destPath = path.join(destFolder, itemName);
        
        try {
          await fs.ensureDir(destFolder);
          if (await fs.pathExists(destPath)) {
            logs.push(`[Skipped] File '${itemName}' already exists in '${targetFolder}'`);
            stats[targetFolder]--; // Don't count skipped as moved
          } else {
            await fs.move(itemPath, destPath);
            logs.push(`[Moved] '${itemName}' -> '${targetFolder}/'`);
          }
        } catch (err: any) {
          logs.push(`[Error] Could not move '${itemName}': ${err.message}`);
          stats[targetFolder]--;
        }
      }
    } else {
      unmoved.push({ name: itemName, isDir });
    }
  }

  return { stats, logs, tree, unmoved };
}
