import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registerUrl = new URL('./register.mjs', import.meta.url).href;

const testFiles = [
  path.join(__dirname, 'api-client.integration.test.mjs'),
  path.join(__dirname, 'auth-integration.test.mjs'),
  path.join(__dirname, 'services-integration.test.mjs'),
];

console.log('====================================================');
console.log('TALKIE FRONTEND <-> API INTEGRATION TEST RUNNER');
console.log('====================================================\n');

let hasFailures = false;

const testStream = run({
  files: testFiles,
  concurrency: 1, // run sequentially to avoid state collisions
  execArgv: ['--import', registerUrl],
});

testStream.on('test:fail', () => {
  hasFailures = true;
});

testStream.compose(spec).pipe(process.stdout);

testStream.on('error', (err) => {
  console.error('Test runner encountered an error:', err);
  process.exit(1);
});

testStream.on('end', () => {
  console.log('\n====================================================');
  console.log('ALL INTEGRATION TEST SUITES COMPLETED');
  console.log('====================================================');
  process.exit(hasFailures ? 1 : 0);
});
