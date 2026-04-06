import React, { useState, useEffect } from 'react';
import { render, Text, Box, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import fs from 'fs-extra';
import path from 'path';
import { createPlan, applyPlan, Plan, Config, ConfigSchema } from './organizer';
import { ZodError } from 'zod';

const HELP_TEXT = `# 文件整理方案

本方案采用 **Plan-Execution (计划-执行)** 模式。所有的操作都会先经过决策引擎生成计划，确认无误后再执行。

## 目标文件夹结构与规则

| 目标文件夹 (Folder) | 说明 (Description) | 包含的文件扩展名 (Extensions) |
| :--- | :--- | :--- |
| **Music** | 音乐文件 | \`.mp3\`, \`.m4a\` |
| **Images** | 图片文件 | \`.jpg\`, \`.jpeg\`, \`.png\`, \`.heic\`, \`.webp\` |
| **Documents** | 文档与书籍 | \`.pdf\`, \`.epub\`, \`.txt\`, \`.md\` |
| **Installers** | 安装包与软件 | \`.dmg\`, \`.exe\`, \`.iso\`, \`.app\` |
| **Archives** | 压缩包 | \`.zip\` |
| **Videos** | 视频文件 | \`.mp4\` |
| **Keys** | 密钥与证书 | \`.key\`, \`.cer\` |

## 注意事项

1.  **计划优先**：建议先运行 \`/dryrun\` 查看决策原因。
2.  **自身忽略**：脚本不应移动自身或相关的配置文件。
3.  **冲突处理**：如果目标文件夹中已存在同名文件，脚本将在文件名末尾追加系统时间戳（YYYYMMDDHHmmss）。
`;

interface Props {
  configPath: string;
}

const normalizeFallbackValue = (fb: any): any => {
  if (!fb) return null;
  if (fb.target && !fb.action) {
    return {
      action: 'move',
      target: fb.target,
      log: fb.log !== undefined ? fb.log : true
    };
  }
  return {
    action: fb.action || 'skip',
    target: fb.target,
    log: fb.log !== undefined ? fb.log : true
  };
};

const mergeSection = <T,>(base: any, custom: any, normalizer?: (val: any) => T): any => {
  if (!custom) return base;
  
  const customMode = custom.mode || 'override';
  const customRawValue = custom.value !== undefined ? custom.value : custom;
  const customValue = normalizer ? normalizer(customRawValue) : customRawValue;

  if (customMode === 'override') {
    return { mode: 'override', value: customValue };
  }

  if (Array.isArray(base.value) && Array.isArray(customValue)) {
    return {
      mode: 'inherit',
      value: [...base.value, ...customValue]
    };
  }
  return base;
};

const App: React.FC<Props> = ({ configPath }) => {
  const { exit } = useApp();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'prompt' | 'help' | 'dryrun' | 'run' | 'strategy'>('prompt');
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const defaultPath = path.resolve('strategy.config.json');
        const defaultConfigRaw = await fs.readJson(defaultPath);
        
        ConfigSchema.parse(defaultConfigRaw);

        if (configPath !== 'strategy.config.json') {
          const customPath = path.resolve(configPath);
          if (await fs.pathExists(customPath)) {
            const customRaw = await fs.readJson(customPath);
            const finalConfigRaw = {
              categories: mergeSection(defaultConfigRaw.categories, customRaw.categories),
              rules: mergeSection(defaultConfigRaw.rules, customRaw.rules),
              fallback: mergeSection(defaultConfigRaw.fallback, customRaw.fallback, normalizeFallbackValue)
            };
            const validated = ConfigSchema.parse(finalConfigRaw);
            validated.rules.value.sort((a, b) => b.priority - a.priority);
            setConfig(validated);
          } else {
            setError(`Config file not found: ${configPath}`);
          }
        } else {
          const validated = ConfigSchema.parse(defaultConfigRaw);
          validated.rules.value.sort((a, b) => b.priority - a.priority);
          setConfig(validated);
        }
      } catch (err: any) {
        if (err instanceof ZodError) {
          const formattedError = err.issues.map((e: any) => `[${e.path.join('.')}] ${e.message}`).join('\n');
          setError(`Invalid Configuration Schema:\n${formattedError}`);
        } else {
          setError(`Failed to load config: ${err.message}`);
        }
      }
    };
    loadConfig();
  }, [configPath]);

  const handleSubmit = async (value: string) => {
    const cmd = value.trim().toLowerCase();
    setQuery('');

    if (!config) return;

    if (cmd === '/help') {
      setView('help');
    } else if (cmd === '/strategy') {
      setView('strategy');
    } else if (cmd === '/dryrun') {
      setLoading(true);
      const plan = await createPlan('.', config);
      setCurrentPlan(plan);
      setLoading(false);
      setView('dryrun');
    } else if (cmd === '/run') {
      setLoading(true);
      setLogs([]);
      const plan = await createPlan('.', config);
      const resultLogs = await applyPlan('.', plan, (msg) => {
        setLogs(prev => [...prev, msg]);
      });
      setLoading(false);
      setView('run');
    } else if (cmd === '/exit' || cmd === 'exit' || cmd === 'quit') {
      exit();
    } else {
      setView('prompt');
    }
  };

  useInput((input, key) => {
    if (key.escape) setView('prompt');
  });

  if (error) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red" bold>Error: {error}</Text>
        <Box marginTop={1}><Text color="gray">Please check your config file.</Text></Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">Org-CLI Manager (Plan-Execution Mode)</Text>
      </Box>

      {view === 'prompt' && (
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">Available commands:</Text>
          <Text>  /dryrun   - Generate & Preview Plan</Text>
          <Text>  /run      - Apply Plan & Execute</Text>
          <Text>  /strategy - View Config</Text>
          <Text>  /help     - View Plan Documentation</Text>
          <Box marginTop={1}>
            <Text color="green">{'>'} </Text>
            <TextInput value={query} onChange={setQuery} onSubmit={handleSubmit} placeholder="Enter command..." />
          </Box>
        </Box>
      )}

      {view === 'help' && (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow" bold>--- Organization Plan ---</Text>
          <Text>{HELP_TEXT}</Text>
          <Box marginTop={1}><Text color="gray">(Press ESC to go back)</Text></Box>
        </Box>
      )}

      {view === 'strategy' && config && (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow" bold>--- Current Strategy ---</Text>
          <Box borderStyle="single" padding={1} marginTop={1}>
            <Text>{JSON.stringify(config, null, 2)}</Text>
          </Box>
          <Box marginTop={1}><Text color="gray">(Press ESC to go back)</Text></Box>
        </Box>
      )}

      {view === 'dryrun' && (
        <Box marginTop={1} flexDirection="column">
          <Text color="magenta" bold>--- Generated Plan (Preview) ---</Text>
          {loading ? <Text>Planning...</Text> : currentPlan && (
            <>
              <PlanView plan={currentPlan} />
              <Box marginTop={1}>
                <Text color="gray">Summary: {Object.values(currentPlan.stats).reduce((a, b) => a + b, 0)} actions planned.</Text>
              </Box>
            </>
          )}
          <Box marginTop={1}><Text color="gray">(Press ESC to go back)</Text></Box>
        </Box>
      )}

      {view === 'run' && (
        <Box marginTop={1} flexDirection="column">
          <Text color="green" bold>--- Executing Plan ---</Text>
          {logs.map((log, i) => (
            <Text key={i} color={log.startsWith('[Error]') ? 'red' : log.startsWith('[Renamed]') ? 'yellow' : 'white'}>
              {log}
            </Text>
          ))}
          {loading && <Text>Processing...</Text>}
          {!loading && <Box marginTop={1}><Text bold color="green">Execution Completed.</Text></Box>}
          <Box marginTop={1}><Text color="gray">(Press ESC to go back)</Text></Box>
        </Box>
      )}
    </Box>
  );
};

const PlanView = ({ plan }: { plan: Plan }) => {
  const categories: Record<string, any[]> = {};
  const unmoved: any[] = [];

  plan.items.forEach(item => {
    if (item.decision.action === 'move' && item.decision.target) {
      if (!categories[item.decision.target]) categories[item.decision.target] = [];
      categories[item.decision.target].push(item);
    } else {
      unmoved.push(item);
    }
  });

  const sortedCats = Object.keys(categories).sort();

  return (
    <Box flexDirection="column">
      <Text>.</Text>
      {sortedCats.map((cat, i) => (
        <Box key={cat} flexDirection="column">
          <Text>├── {cat} <Text color="gray">(Target Folder)</Text></Text>
          {categories[cat].map((item, j) => {
            const isLast = i === sortedCats.length - 1 && unmoved.length === 0 && j === categories[cat].length - 1;
            const connector = j === categories[cat].length - 1 ? '└── ' : '├── ';
            return (
              <Text key={j}>│   {connector}{item.from} <Text color="dim" italic>({item.decision.reason})</Text></Text>
            );
          })}
        </Box>
      ))}
      {unmoved.map((item, i) => {
        const isLast = i === unmoved.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        return (
          <Text key={i}>{connector}{item.from} <Text color="dim" italic>({item.decision.reason})</Text></Text>
        );
      })}
    </Box>
  );
};

export default App;
