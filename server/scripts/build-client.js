#!/usr/bin/env node
// Build the React frontend and copy its output into the directory Express serves.
// Resolve paths relative to this script so it works from different working directories.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientDirectory = join(serverDirectory, '..', 'client');
const buildDirectory = join(clientDirectory, 'dist');
const deploymentDirectory = join(serverDirectory, 'public', 'app');

if (!fs.existsSync(clientDirectory)) {
  console.error(`Client directory not found: ${clientDirectory}`);
  process.exit(1);
}

console.log('Building Pokee-Pal client...');
execSync('npm run build', { cwd: clientDirectory, stdio: 'inherit' });

// Replace the previous bundle completely so stale hashed assets cannot survive
// alongside the new build. Runtime images are stored in a separate directory.
fs.rmSync(deploymentDirectory, { recursive: true, force: true });
fs.mkdirSync(deploymentDirectory, { recursive: true });
fs.cpSync(buildDirectory, deploymentDirectory, { recursive: true });

if (!fs.existsSync(join(deploymentDirectory, 'index.html'))) {
  console.error('Client deployment failed: index.html was not copied.');
  process.exit(1);
}

console.log(`Pokee-Pal client deployed to ${deploymentDirectory}`);
