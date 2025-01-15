import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    plugins: [basicSsl()],
    server: {
        port: 3000,
        https: {
            // basicSslプラグインが自動的に証明書を生成します
        }
    },
    build: {
        outDir: 'dist/client',
        sourcemap: true,
    },
    root: '.',
    publicDir: 'public',
});