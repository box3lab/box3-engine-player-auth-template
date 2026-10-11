import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [task, architecture = 'all'] = process.argv.slice(2);
if (!['check', 'image'].includes(task) || !['all', 'arm64', 'amd64'].includes(architecture)) {
    throw new Error('使用 check 或 image [all|arm64|amd64]');
}
function run(args) {
    const result = spawnSync(process.execPath, args, {
        cwd: ROOT_DIRECTORY,
        stdio: 'inherit',
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
run(['node_modules/typescript/bin/tsc', '--noEmit']);
const testsDirectory = path.join(ROOT_DIRECTORY, 'tests');
const tests = existsSync(testsDirectory)
    ? readdirSync(testsDirectory)
          .filter((file) => file.endsWith('.test.ts'))
          .map((file) => `tests/${file}`)
    : [];
if (tests.length) {
    run(['--conditions=react-server', '--import', 'tsx', '--test', ...tests]);
} else {
    console.log('未找到本地测试，跳过测试步骤');
}
run(['node_modules/next/dist/bin/next', 'build']);
if (task === 'image') {
    run(['scripts/build-images.mjs', architecture]);
}
