#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import App from './ui';
import fs from 'fs-extra';
import path from 'path';
import { ConfigSchema } from './schema';
import { initPlayground } from './playground';
import chalk from 'chalk';

const cli = meow(`
	Usage
	  $ org-cli

	Options
	  --config, -c <path>  Path to the strategy config JSON (default: strategy.config.json)
    --init-test          Initialize a test playground with dummy files
	  --help, -h           Show help
	  --version, -v        Show version

	Commands
	  /dryrun    Preview file organization
	  /strategy  View current organization strategy
	  /help      Show organization plan
	  /run       Execute file organization
`, {
	flags: {
		config: {
			type: 'string',
			alias: 'c',
			default: 'strategy.config.json'
		},
    initTest: {
      type: 'boolean'
    },
		help: {
			type: 'boolean',
			alias: 'h'
		},
		version: {
			type: 'boolean',
			alias: 'v'
		}
	}
});

async function run() {
  if (cli.flags.initTest) {
    try {
      const configPath = path.resolve(cli.flags.config);
      if (!(await fs.pathExists(configPath))) {
        console.error(chalk.red(`Error: Config file not found at ${configPath}`));
        process.exit(1);
      }
      const configRaw = await fs.readJson(configPath);
      const config = ConfigSchema.parse(configRaw);
      await initPlayground(config);
      process.exit(0);
    } catch (err: any) {
      console.error(chalk.red(`Initialization Error: ${err.message}`));
      process.exit(1);
    }
  }

  render(<App configPath={cli.flags.config} />);
}

run();
