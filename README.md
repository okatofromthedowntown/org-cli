# Org-CLI

An interactive file organization CLI built with Node.js, React, and Ink.

## CLI Usage

```text
  File organization CLI built with Ink

  Usage
    $ org-cli

  Options
    --help, -h  Show help
    --version, -v  Show version

  Commands
    /dryrun  Preview file organization
    /help    Show organization plan
    /run     Execute file organization
    /exit    Quit the CLI
```

## Organization Plan (文件整理方案)

本方案旨在根据文件扩展名将文件归类到特定的文件夹中，以保持目录整洁。

### Target Folders & Rules (目标文件夹结构与规则)

| 目标文件夹 (Folder) | 说明 (Description) | 包含的文件扩展名 (Extensions) |
| :--- | :--- | :--- |
| **Music** | 音乐文件 | `.mp3`, `.m4a` |
| **Images** | 图片文件 | `.jpg`, `.jpeg`, `.png`, `.heic`, `.webp` |
| **Documents** | 文档与书籍 | `.pdf`, `.epub`, `.txt`, `.md` |
| **Installers** | 安装包与软件 | `.dmg`, `.exe`, `.iso`, `.app` |
| **Archives** | 压缩包 | `.zip` |
| **Videos** | 视频文件 | `.mp4` |
| **Keys** | 密钥与证书 | `.key`, `.cer` |

### Important Notes (注意事项)

1.  **文件夹忽略**：脚本不会移动现有的文件夹（以 `.app` 结尾的 macOS 应用包除外，它们会被视为安装包处理）。
2.  **自身忽略**：脚本不应移动自身或相关的配置文件。
3.  **安全检查**：如果目标文件夹中已存在同名文件，脚本应跳过该文件或提示，避免覆盖。

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm start

# Build production version
npm run build

# Link globally to use 'org-cli' command
npm link
```
