import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';

// 型定義
interface SignalingMessage {
    type: 'offer' | 'answer' | 'ice-candidate';
    data: any;
    from: string;
    to?: string;
}

// WebSocketサーバーの設定
const wss = new WebSocketServer({ port: 8080 });

// クライアント管理
const clients = new Map<string, WebSocket>();
let clientIdCounter = 0;

// クライアント接続時の処理
wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const clientId = (++clientIdCounter).toString();
    clients.set(clientId, ws);

    console.log(`Client ${clientId} connected`);

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
            console.log(`Received message from client ${clientId}:`, parsedMessage.type);

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
        console.log(`Client ${clientId} disconnected`);
        clients.delete(clientId);
        broadcastConnectedClients();
    });

    // エラー時の処理
    ws.on('error', (error) => {
        console.error(`Client ${clientId} error:`, error);
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

// サーバー起動時のログ
console.log('WebSocket Signaling Server running on ws://localhost:8080');

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