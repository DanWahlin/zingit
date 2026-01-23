import { defineConfig, Plugin } from 'vite';

// Plugin to inline CSS into JS for single-file bookmarklet distribution
function inlineCssPlugin(): Plugin {
  return {
    name: 'inline-css',
    generateBundle(options, bundle) {
      const cssFiles: string[] = [];

      // Find and collect CSS
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (fileName.endsWith('.css') && chunk.type === 'asset') {
          cssFiles.push(chunk.source as string);
          delete bundle[fileName];
        }
      }

      // Inject CSS into JS
      if (cssFiles.length > 0) {
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (chunk.type === 'chunk' && chunk.isEntry) {
            const cssCode = cssFiles.join('\n');
            const injection = `(function(){const s=document.createElement('style');s.textContent=${JSON.stringify(cssCode)};document.head.appendChild(s)})();`;
            chunk.code = injection + chunk.code;
          }
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [inlineCssPlugin()],
  server: {
    port: 5200,
    cors: true,
    open: true,  // Auto-open browser on start
    hmr: false,  // Disable hot reload to simulate production (manual refresh needed to see changes)
  },
  preview: {
    port: 5200,  // Same port for preview mode
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'PokeUI',
      formats: ['es', 'iife'],
      fileName: (format) => `pokeui.${format}.js`
    },
    minify: 'terser',
    cssMinify: 'lightningcss',
    cssCodeSplit: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
