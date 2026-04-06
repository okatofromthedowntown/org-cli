import fs from 'fs-extra';
import path from 'path';
import { Plan } from './schema';

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
