import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

// 自己署名証明書の設定
const options = {
    key: fs.readFileSync(path.join(__dirname, '../certs/server.key')),
    cert: fs.readFileSync(path.join(__dirname, '../certs/server.crt'))
};

// HTTPSサーバーの作成
const server = https.createServer(options, (req, res) => {
    const url = req.url === '/' ? '/index.html' : req.url;
    const filePath = path.join(__dirname, '..', url!);
    const contentType = getContentType(filePath);

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('500 Internal Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// コンテンツタイプの判定
function getContentType(filePath: string): string {
    const ext = path.extname(filePath);
    switch (ext) {
        case '.html':
            return 'text/html';
        case '.css':
            return 'text/css';
        case '.js':
            return 'text/javascript';
        case '.json':
            return 'application/json';
        default:
            return 'text/plain';
    }
}

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`HTTPS Server running on https://localhost:${PORT}`);
    console.log('Note: 自己署名証明書を使用しているため、ブラウザで警告が表示されます');
    console.log('開発目的のみに使用してください');
});