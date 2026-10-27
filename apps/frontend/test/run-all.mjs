import { register } from 'node:module';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Automatically register TypeScript/ESM loader hook if not already registered via CLI
try {
  register(new URL('./loader.mjs', import.meta.url).href, import.meta.url);
} catch {
  // Already registered or unsupported
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const testFiles = [
  path.join(__dirname, 'api-client.integration.test.mjs'),
  path.join(__dirname, 'auth-integration.test.mjs'),
  path.join(__dirname, 'services-integration.test.mjs'),
  path.join(__dirname, 'realtime-integration.test.mjs'),
];

console.log('====================================================');
console.log('TALKIE FRONTEND <-> API INTEGRATION TEST RUNNER');
console.log('====================================================\n');

let hasFailures = false;

const testStream = run({
  files: testFiles,
  concurrency: 1, // run sequentially to avoid state collisions
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
  // Explicit exit so lingering background intervals or open sockets don't hang the process
  setTimeout(() => {
    process.exit(hasFailures ? 1 : 0);
  }, 100).unref();
});
