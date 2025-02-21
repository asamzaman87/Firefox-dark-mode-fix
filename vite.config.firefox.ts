import { resolve } from 'path';
import { mergeConfig, defineConfig } from 'vite';
import { crx, ManifestV3Export } from '@crxjs/vite-plugin';
import baseConfig, { baseManifest, baseBuildOptions } from './vite.config.base'

const outDir = resolve(__dirname, 'dist_firefox');

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [
      crx({
        manifest: {
          ...baseManifest,
          "name": "GPT Reader: Free AI Text to Speech (TTS)",
          "browser_specific_settings": {
            "gecko": {
              "id": "democraticdeveloper@gmail.com"
            }
          },
          background: {
            scripts: ['src/pages/background/index.ts']
          },
        } as unknown as ManifestV3Export,
        browser: 'firefox',
        contentScripts: {
          injectCss: true,
        }
      })
    ],
    build: {
      ...baseBuildOptions,
      outDir
    },
    publicDir: resolve(__dirname, 'public'),
  })
)