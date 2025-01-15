import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig({
    server: {
        port: 3000,
        https: {
            key: fs.readFileSync('certs/server.key'),
            cert: fs.readFileSync('certs/server.crt')
        }
    },
    build: {
        outDir: 'dist/client',
        sourcemap: true,
    },
    root: '.',
    publicDir: 'public',
});