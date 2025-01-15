import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

// 自己署名証明書の設定
const options = {
    key: fs.readFileSync(path.join(__dirname, '../../certs/server.key')),
    cert: fs.readFileSync(path.join(__dirname, '../../certs/server.crt'))
};

const server = https.createServer(options, (req, res) => {
    // 1) リクエストされたパスを決定
    const url = (req.url === '/' ? '/index.html' : req.url) ?? '/index.html';

    // 2) プロジェクトルートを基点にファイルを探す
    //    2階層上がプロジェクトルートなので、そこにあるファイルを返す
    //    例: "/index.html" → "[プロジェクトルート]/index.html"
    const filePath = path.join(__dirname, '../../', url);

    fs.readFile(filePath, (err, content) => {
        if (err) {
            // ファイルが見つからなかったら 404
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                // それ以外のエラーは 500
                res.writeHead(500);
                res.end('500 Internal Server Error');
            }
        } else {
            // MIME タイプを決めてレスポンス
            const contentType = getContentType(filePath);
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