import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

// 型定義
interface SignalingMessage {
    type: 'offer' | 'answer' | 'ice-candidate';
    data: any;
    from: string;
    to?: string;
}

// HTTPSサーバーの設定
const httpsServer = https.createServer({
    key: fs.readFileSync(path.join(__dirname, '../certs/server.key')),
    cert: fs.readFileSync(path.join(__dirname, '../certs/server.crt'))
});

// WebSocketサーバーの設定
const wss = new WebSocketServer({
    server: httpsServer  // HTTPSサーバーにWebSocketサーバーを接続
});

// クライアント管理
const clients = new Map<string, WebSocket>();
let clientIdCounter = 0;

// クライアント接続時の処理
wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const clientId = (++clientIdCounter).toString();
    const clientIP = req.socket.remoteAddress;
    clients.set(clientId, ws);

    console.log(`Client ${clientId} connected from ${clientIP}`);

    // クライアントにIDを送信
    ws.send(JSON.stringify({
        type: 'connection-established',
        clientId
    }));

    // 接続中のクライアント数を通知
    broadcastConnectedClients();

    // メッセージ受信時の処理
    ws.on('message', (message: string) => {
        try {
            const parsedMessage = JSON.parse(message.toString()) as SignalingMessage;
            console.log(`Received message from client ${clientId} (${clientIP}):`, parsedMessage.type);

            // メッセージの転送
            if (parsedMessage.to) {
                const targetClient = clients.get(parsedMessage.to);
                if (targetClient) {
                    parsedMessage.from = clientId;
                    targetClient.send(JSON.stringify(parsedMessage));
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });

    // 切断時の処理
    ws.on('close', () => {
        console.log(`Client ${clientId} (${clientIP}) disconnected`);
        clients.delete(clientId);
        broadcastConnectedClients();
    });

    // エラー時の処理
    ws.on('error', (error) => {
        console.error(`Client ${clientId} (${clientIP}) error:`, error);
        clients.delete(clientId);
        broadcastConnectedClients();
    });
});

// 接続中のクライアント数をブロードキャスト
function broadcastConnectedClients(): void {
    const message = JSON.stringify({
        type: 'clients-count',
        count: clients.size
    });

    for (const client of clients.values()) {
        client.send(message);
    }
}

// サーバーの起動
const WSS_PORT = 8443; // HTTPSのWebSocket用ポート
httpsServer.listen(WSS_PORT, () => {
    console.log(`Secure WebSocket Server (WSS) running on wss://0.0.0.0:${WSS_PORT}`);
    console.log('Accepting secure WebSocket connections from all network interfaces');
});

// エラーハンドリング
wss.on('error', (error) => {
    console.error('WebSocket Server Error:', error);
});

// プロセス終了時の処理
process.on('SIGINT', () => {
    console.log('Shutting down WebSocket Server...');
    wss.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// 未処理のエラーをキャッチ
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});