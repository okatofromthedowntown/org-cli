import React, { useState, useEffect } from 'react';
import { render, Text, Box, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import fs from 'fs-extra';
import path from 'path';
import { organize, OrganizedResult, Config } from './organizer';

const HELP_TEXT = `# 文件整理方案

本方案旨在根据文件扩展名将文件归类到特定的文件夹中，以保持目录整洁。

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

1.  **文件夹忽略**：脚本不会移动现有的文件夹（以 \`.app\` 结尾的 macOS 应用包除外，它们会被视为安装包处理）。
2.  **自身忽略**：脚本不应移动自身或相关的配置文件。
3.  **冲突处理**：如果目标文件夹中已存在同名文件，脚本将在文件名末尾追加系统时间戳（YYYYMMDDHHmmss），以避免覆盖并确保移动成功。
`;

interface Props {
  configPath: string;
}

const App: React.FC<Props> = ({ configPath }) => {
  const { exit } = useApp();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'prompt' | 'help' | 'dryrun' | 'run' | 'strategy'>('prompt');
  const [result, setResult] = useState<OrganizedResult | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const fullPath = path.resolve(configPath);
        if (await fs.pathExists(fullPath)) {
          const data = await fs.readJson(fullPath);
          setConfig(data);
        } else {
          setError(`Config file not found: ${configPath}`);
        }
      } catch (err: any) {
        setError(`Failed to load config: ${err.message}`);
      }
    };
    loadConfig();
  }, [configPath]);

  const handleSubmit = async (value: string) => {
    const cmd = value.trim().toLowerCase();
    setQuery('');

    if (!config) {
      setError("Configuration not loaded.");
      return;
    }

    if (cmd === '/help') {
      setView('help');
    } else if (cmd === '/strategy') {
      setView('strategy');
    } else if (cmd === '/dryrun') {
      setLoading(true);
      const res = await organize('.', config, true);
      setResult(res);
      setLoading(false);
      setView('dryrun');
    } else if (cmd === '/run') {
      setLoading(true);
      const res = await organize('.', config, false);
      setResult(res);
      setLoading(false);
      setView('run');
    } else if (cmd === '/exit' || cmd === 'exit' || cmd === 'quit') {
      exit();
    } else {
      setView('prompt');
    }
  };

  useInput((input, key) => {
    if (key.escape) {
      setView('prompt');
    }
  });

  if (error) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red" bold>Error: {error}</Text>
        <Box marginTop={1}>
          <Text color="gray">Please check your config file or use --config to specify a valid one.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">Org-CLI Manager</Text>
      </Box>

      {view === 'prompt' && (
        <Box marginTop={1} flexDirection="column">
          <Text>Welcome to File Organizer CLI. Available commands:</Text>
          <Text color="gray">  /dryrun   - Preview organization</Text>
          <Text color="gray">  /strategy - View current strategy (JSON)</Text>
          <Text color="gray">  /help     - View organization plan</Text>
          <Text color="gray">  /run      - Organize files now</Text>
          <Text color="gray">  /exit     - Quit</Text>
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
          <Box marginTop={1}>
            <Text color="gray">(Press ESC to go back)</Text>
          </Box>
        </Box>
      )}

      {view === 'strategy' && config && (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow" bold>--- Current Strategy (from {configPath}) ---</Text>
          <Box borderStyle="single" padding={1} marginTop={1}>
            <Text>{JSON.stringify(config, null, 2)}</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">(Press ESC to go back)</Text>
          </Box>
        </Box>
      )}

      {view === 'dryrun' && (
        <Box marginTop={1} flexDirection="column">
          <Text color="magenta" bold>--- Dry Run Result (Preview) ---</Text>
          {loading ? (
            <Text>Analyzing files...</Text>
          ) : result && (
            <>
              <TreeView result={result} />
              <Box marginTop={1}>
                <Text color="gray">({Object.values(result.stats).reduce((a, b) => a + b, 0)} files would be moved)</Text>
              </Box>
            </>
          )}
          <Box marginTop={1}>
            <Text color="gray">(Press ESC to go back)</Text>
          </Box>
        </Box>
      )}

      {view === 'run' && (
        <Box marginTop={1} flexDirection="column">
          <Text color="green" bold>--- Execution Result ---</Text>
          {loading ? (
            <Text>Moving files...</Text>
          ) : result && (
            <>
              {result.logs.map((log, i) => (
                <Text key={i} color={log.startsWith('[Error]') ? 'red' : log.startsWith('[Skipped]') ? 'yellow' : 'white'}>
                  {log}
                </Text>
              ))}
              <Box marginTop={1} flexDirection="column">
                <Text bold underline>Summary:</Text>
                {Object.entries(result.stats).map(([folder, count]) => (
                  count > 0 && <Text key={folder}>{folder}: {count} files</Text>
                ))}
                <Text bold color="green">Total files moved: {Object.values(result.stats).reduce((a, b) => a + b, 0)}</Text>
              </Box>
            </>
          )}
          <Box marginTop={1}>
            <Text color="gray">(Press ESC to go back)</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

const TreeView = ({ result }: { result: OrganizedResult }) => {
  const allItems = [...result.unmoved.map(u => ({ ...u, isCat: false, children: [] as string[] }))];
  
  Object.entries(result.tree).forEach(([cat, children]) => {
    allItems.push({ name: cat, isDir: true, isCat: true, children });
  });

  allItems.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return (
    <Box flexDirection="column">
      <Text>.</Text>
      {allItems.map((item, i) => {
        const isLast = i === allItems.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        return (
          <Box key={i} flexDirection="column">
            <Text>{connector}{item.name}</Text>
            {item.children.length > 0 && item.children.map((child, j) => {
              const isLastChild = j === item.children.length - 1;
              const childConnector = isLastChild ? '└── ' : '├── ';
              const prefix = isLast ? '    ' : '│   ';
              return (
                <Text key={j}>{prefix}{childConnector}{child}</Text>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
};

export default App;
