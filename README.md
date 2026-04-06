# Org-CLI

An interactive file organization CLI built with Node.js, React, and Ink.

## CLI Usage

```text
  Usage
    $ org-cli

  Options
    --config, -c <path>  Path to the strategy config JSON (default: strategy.config.json)
    --init-test          Initialize a test playground with dummy files
    --help, -h           Show help
    --version, -v        Show version

  Commands
    /dryrun    Preview file organization
    /strategy  View current organization strategy (Explicit Semantic JSON)
    /help      Show organization plan
    /run       Execute file organization
    /exit      Quit the CLI
```

## Semantic Configuration (显式语义配置)

为了提高配置的可读性和可维护性，系统采用了显式的语义定义结构。每个配置块都包含 `mode` 和 `value`。

### 格式规范

```json
{
  "categories": {
    "mode": "inherit", 
    "value": ["NewCategory"]
  },
  "rules": {
    "mode": "override",
    "value": [
      { "match": [".exe"], "target": "Installers" }
    ]
  },
  "fallback": {
    "mode": "inherit",
    "value": {}
  }
}
```

### 语义说明
- **mode**:
  - `override`: 完全忽略基础配置，仅使用当前 `value` 定义的内容。
  - `inherit`: 
    - 对于数组（如 `categories`, `rules`），会将 `value` 中的内容追加到基础配置之后。
    - 对于对象（如 `fallback`），如果当前没有定义有效值，将沿用基础配置。
- **value**: 具体的规则内容。

## Development

```bash
# Install dependencies
npm install

# Build & Link
npm run build
npm link
```
