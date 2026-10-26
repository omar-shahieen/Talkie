// apps/frontend/test/loader.mjs
import esbuild from 'esbuild';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch {}
      }
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  let src = '';
  if (typeof result.source === 'string') {
    src = result.source;
  } else if (result.source && (result.source instanceof Uint8Array || Buffer.isBuffer(result.source))) {
    src = Buffer.from(result.source).toString('utf8');
  }

  if (url.endsWith('.ts') || url.endsWith('.tsx') || src.includes('import.meta.env')) {
    const transformed = esbuild.transformSync(src, {
      loader: url.endsWith('.tsx') ? 'tsx' : 'ts',
      format: 'esm',
      define: {
        'import.meta.env.VITE_API_URL': 'process.env.VITE_API_URL',
        'import.meta.env': 'process.env',
      },
    });

    return {
      format: 'module',
      source: transformed.code,
      shortCircuit: true,
    };
  }

  return result;
}
