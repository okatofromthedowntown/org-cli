import path from 'path';
import { Config, Decision } from './schema';
import { IGNORE_FILES } from './constants';

/**
 * 决策引擎：根据文件和配置，决定该如何处理。
 */
export function decide(filename: string, isDir: boolean, config: Config): Decision {
  // 1. Check Ignore
  if (IGNORE_FILES.includes(filename)) {
    return { action: 'skip', reason: 'Ignored file', source: 'ignore' };
  }

  // 2. Try Rules (Priority already sorted by UI layer)
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
