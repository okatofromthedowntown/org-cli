import fs from 'fs-extra';
import path from 'path';
import { Config, Plan, PlanItem } from './schema';
import { decide } from './decision';

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
