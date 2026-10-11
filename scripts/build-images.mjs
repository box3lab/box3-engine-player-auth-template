import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, createReadStream, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const architecture = process.argv[2] || 'all';
if (!['all', 'amd64', 'arm64'].includes(architecture)) {
    throw new Error('请选择 all、amd64 或 arm64');
}
const { version, license, displayName } = JSON.parse(
    readFileSync(path.join(ROOT_DIRECTORY, 'package.json'), 'utf8'),
);
// Internal compatibility marker: template users do not configure it.
const labels = {
    'org.opencontainers.image.title': displayName,
    'org.opencontainers.image.licenses': license,
    'box.routing.base-path': 'runtime-v1',
};
if (Object.values(labels).some((value) => typeof value !== 'string' || !value.trim())) {
    throw new Error('请在 package.json 配置 displayName 和 license');
}
const labelArguments = Object.entries(labels).flatMap(([name, value]) => [
    '--label',
    `${name}=${value}`,
]);
const output = path.join(ROOT_DIRECTORY, 'dist');
await mkdir(output, { recursive: true });
for (const arch of architecture === 'all' ? ['arm64', 'amd64'] : [architecture]) {
    const tag = `box3-player-auth-portal:${version}-${arch}`;
    const filename = `box3-player-auth-portal-${version}-${arch}.tar.gz`;
    const build = spawnSync(
        'docker',
        [
            'buildx',
            'build',
            '--platform',
            `linux/${arch}`,
            '--load',
            ...labelArguments,
            '-t',
            tag,
            '.',
        ],
        { cwd: ROOT_DIRECTORY, stdio: 'inherit' },
    );
    if (build.error) {
        throw build.error;
    }
    if (build.status !== 0) {
        throw new Error(`${arch} 镜像构建失败`);
    }
    const inspect = spawnSync(
        'docker',
        ['image', 'inspect', tag, '--format', '{{.Architecture}}'],
        { encoding: 'utf8' },
    );
    if (inspect.status !== 0 || inspect.stdout.trim() !== arch) {
        throw new Error('镜像架构验证失败');
    }
    const save = spawn('docker', ['image', 'save', tag], {
        stdio: ['ignore', 'pipe', 'inherit'],
    });
    const exited = new Promise((resolve, reject) => {
        save.on('error', reject);
        save.on('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`镜像导出失败：${code}`)),
        );
    });
    await Promise.all([
        exited,
        pipeline(
            save.stdout,
            createGzip({ level: 6 }),
            createWriteStream(path.join(output, filename)),
        ),
    ]);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path.join(output, filename))) {
        hash.update(chunk);
    }
    await writeFile(
        path.join(output, `${filename}.sha256`),
        `${hash.digest('hex')}  ${filename}\n`,
    );
    console.log(`已生成 ${filename}；启动器登录页面镜像填写 ${tag}`);
}
