import fs from 'fs-extra';
import path from 'path';
import { Config } from './schema';
import chalk from 'chalk';

/**
 * Initializes a test playground based on the configuration.
 */
export async function initPlayground(config: Config) {
  if (!config.playground) {
    console.error(chalk.red('Error: No playground configuration found in the strategy config.'));
    return;
  }

  const playgroundDir = path.resolve(config.playground.folder);
  
  try {
    // Create the playground directory if it doesn't exist
    await fs.ensureDir(playgroundDir);
    console.log(chalk.cyan(`Initializing playground in: ${playgroundDir}`));

    for (const filename of config.playground.files) {
      const filePath = path.join(playgroundDir, filename);
      
      // We use empty strings for content to simulate empty files
      await fs.ensureFile(filePath);
      console.log(chalk.gray(`  - Created: ${filename}`));
    }

    console.log(chalk.green('\nPlayground initialization complete!'));
    console.log(chalk.yellow(`You can now run: cd ${config.playground.folder} && org-cli`));
  } catch (err: any) {
    console.error(chalk.red(`Failed to initialize playground: ${err.message}`));
  }
}
