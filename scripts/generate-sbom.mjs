import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmTree = JSON.parse(execFileSync(npmExecutable, ['ls', '--all', '--json'], { encoding: 'utf8', shell: process.platform === 'win32' }));
const components = [];
function visit(node, path = []) {
  for (const [name, dependency] of Object.entries(node.dependencies ?? {})) {
    if (dependency.version) components.push({ type: 'library', 'bom-ref': `${name}@${dependency.version}`, name, version: dependency.version, scope: path.length ? 'optional' : 'required' });
    visit(dependency, [...path, name]);
  }
}
visit(npmTree);
await writeFile('sbom.cdx.json', JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1, metadata: { timestamp: new Date().toISOString() }, components }, null, 2));
