import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Default playground configuration, now independent of the core config schema.
 */
const PLAYGROUND_DEFAULTS = {
  folder: 'test-playground',
  files: [
    "vacation.jpg",
    "budget.pdf",
    "theme_song.mp3",
    "archive_v1.zip",
    "tutorial.mp4",
    "id_rsa.key",
    "installer.dmg",
    "unknown_file.xyz",
    "old_photo.png",
    "notes.txt"
  ]
};

/**
 * Initializes a test playground. Completely decoupled from the organization engine.
 */
export async function initPlayground() {
  const playgroundDir = path.resolve(PLAYGROUND_DEFAULTS.folder);
  
  try {
    // Create the playground directory if it doesn't exist
    await fs.ensureDir(playgroundDir);
    console.log(chalk.cyan(`Initializing playground in: ${playgroundDir}`));

    for (const filename of PLAYGROUND_DEFAULTS.files) {
      const filePath = path.join(playgroundDir, filename);
      await fs.ensureFile(filePath);
      console.log(chalk.gray(`  - Created: ${filename}`));
    }

    console.log(chalk.green('\nPlayground initialization complete!'));
    console.log(chalk.yellow(`You can now run: cd ${PLAYGROUND_DEFAULTS.folder} && org-cli`));
  } catch (err: any) {
    console.error(chalk.red(`Failed to initialize playground: ${err.message}`));
  }
}
