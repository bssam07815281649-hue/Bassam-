import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function scanModelFiles(modelsDir: string): string[] {
  if (!fs.existsSync(modelsDir)) return [];
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(glb|gltf)$/i.test(entry.name)) {
        const rel = path.relative(modelsDir, fullPath).split(path.sep).join('/');
        results.push(`/assets/models/${rel}`);
      }
    }
  };
  walk(modelsDir);
  return results.sort();
}

function modelManifestPlugin(): Plugin {
  const modelsDir = path.resolve(__dirname, 'public/assets/models');
  return {
    name: 'protect-the-house-model-manifest',
    configureServer(server) {
      server.middlewares.use('/assets/models/manifest.json', (_req, res) => {
        const present = scanModelFiles(modelsDir);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({present}, null, 2));
      });
    },
    closeBundle(error?: Error) {
      if (error) return;
      const distModelsDir = path.resolve(__dirname, 'dist/assets/models');
      if (fs.existsSync(path.resolve(__dirname, 'dist'))) {
        fs.mkdirSync(distModelsDir, {recursive: true});
        const present = scanModelFiles(modelsDir);
        fs.writeFileSync(
          path.join(distModelsDir, 'manifest.json'),
          JSON.stringify({present}, null, 2),
        );
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      modelManifestPlugin(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
