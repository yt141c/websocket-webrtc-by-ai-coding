import { defineConfig } from 'vite';
import fs from 'fs';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    plugins: [basicSsl()],
    server: {
        port: 3000,
        host: '0.0.0.0',
        https: {
            key: fs.readFileSync('certs/server.key'),
            cert: fs.readFileSync('certs/server.crt')
        }
    },
    build: {
        outDir: 'dist/client',
        sourcemap: true,
        // クライアントのファイルをdist/clientではなく、
        // dist直下に出力するための設定
        rollupOptions: {
            input: {
                main: './index.html'
            },
            output: {
                entryFileNames: `assets/[name].js`,
                chunkFileNames: `assets/[name].js`,
                assetFileNames: `assets/[name].[ext]`
            }
        }
    },
    root: '.',
    publicDir: 'public',
    resolve: {
        extensions: ['.ts', '.js']
    }
});