require('./symlink-patch.cjs');
const { spawnSync } = require('child_process');
const r = spawnSync('npx', ['--yes', 'vercel', 'build', '--prod', '--yes'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
  cwd: process.cwd(),
});
process.exit(r.status ?? 1);