#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import App from './ui';

const cli = meow(`
	Usage
	  $ org-cli

	Options
	  --config, -c <path>  Path to the strategy config JSON (default: strategy.config.json)
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

render(<App configPath={cli.flags.config} />);
