#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import App from './ui';

const cli = meow(`
	Usage
	  $ org-cli

	Options
	  --help, -h  Show help
	  --version, -v  Show version

	Commands
	  /dryrun  Preview file organization
	  /help    Show organization plan
	  /run     Execute file organization
`, {
	flags: {
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

render(<App />);
