// wss-server.ts
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { createServer } from 'https';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// __dirname の代替を作成（ESモジュールでは __dirname が使えないため）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 型定義
interface SignalingMessage {
    type: 'offer' | 'answer' | 'ice-candidate' | 'create' | 'join' |
    'connection-established' | 'room-created' | 'joined' |
    'guest-joined' | 'host-left' | 'guest-left';
    data?: any;
    from?: string;
    to?: string;
    room?: string;
    clientId?: string;
}

// 証明書のパスを確認
const certPath = join(__dirname, '../../certs/server.crt');
const keyPath = join(__dirname, '../../certs/server.key');

console.log('Loading certificates from:');
console.log('Cert:', certPath);
console.log('Key:', keyPath);

// HTTPSサーバーの設定
const httpsServer = createServer({
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
    // 開発環境用の設定を追加
    rejectUnauthorized: false, // 自己署名証明書を許可
});

// WebSocketサーバーの設定
const wss = new WebSocketServer({
    server: httpsServer
});

// クライアント管理
const clients = new Map<string, WebSocket>();
const rooms = new Map<string, { host: string; guest?: string }>();
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
            console.log(`Received message from client ${clientId}:`, parsedMessage);

            switch (parsedMessage.type) {
                case 'create':
                    handleRoomCreation(clientId, parsedMessage.room!, ws);
                    break;
                case 'join':
                    handleRoomJoin(clientId, parsedMessage.room!, ws);
                    break;
                default:
                    handleSignalingMessage(clientId, parsedMessage);
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
        handleClientDisconnect(clientId);
    });

    // エラー時の処理
    ws.on('error', (error) => {
        console.error(`Client ${clientId} error:`, error);
        handleClientDisconnect(clientId);
    });
});

// 部屋の作成を処理
function handleRoomCreation(clientId: string, roomId: string, ws: WebSocket) {
    console.log(`Creating room: ${roomId} for client: ${clientId}`);

    if (rooms.has(roomId)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room already exists'
        }));
        return;
    }

    rooms.set(roomId, { host: clientId });
    ws.send(JSON.stringify({
        type: 'room-created',
        room: roomId
    }));
}

// 部屋への参加を処理
function handleRoomJoin(clientId: string, roomId: string, ws: WebSocket) {
    console.log(`Client ${clientId} attempting to join room: ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found'
        }));
        return;
    }

    if (room.guest) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room is full'
        }));
        return;
    }

    room.guest = clientId;
    rooms.set(roomId, room);

    // ゲストに参加成功を通知
    ws.send(JSON.stringify({
        type: 'joined',
        room: roomId
    }));

    // ホストにゲスト参加を通知
    const hostWs = clients.get(room.host);
    if (hostWs) {
        hostWs.send(JSON.stringify({
            type: 'guest-joined',
            room: roomId
        }));
    }
}

// シグナリングメッセージの転送
function handleSignalingMessage(fromClientId: string, message: SignalingMessage) {
    if (!message.room) {
        console.error('Room ID missing in signaling message');
        return;
    }

    const room = rooms.get(message.room);
    if (!room) {
        console.error('Room not found:', message.room);
        return;
    }

    const targetClientId = room.host === fromClientId ? room.guest : room.host;
    const targetWs = clients.get(targetClientId!);

    if (targetWs) {
        message.from = fromClientId;
        targetWs.send(JSON.stringify(message));
    }
}

// クライアントの切断処理
function handleClientDisconnect(clientId: string) {
    console.log(`Client ${clientId} disconnected`);

    // 部屋の更新
    for (const [roomId, room] of rooms.entries()) {
        if (room.host === clientId || room.guest === clientId) {
            const otherClientId = room.host === clientId ? room.guest : room.host;
            const otherWs = clients.get(otherClientId!);

            if (otherWs) {
                otherWs.send(JSON.stringify({
                    type: room.host === clientId ? 'host-left' : 'guest-left',
                    room: roomId
                }));
            }

            rooms.delete(roomId);
            break;
        }
    }

    clients.delete(clientId);
    broadcastConnectedClients();
}

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
const WSS_PORT = 8443;
httpsServer.listen(WSS_PORT, () => {
    console.log(`Secure WebSocket Server (WSS) running on port ${WSS_PORT}`);
});

// エラーハンドリング
wss.on('error', (error) => {
    console.error('WebSocket Server Error:', error);
});

// プロセス終了時の処理
process.on('SIGINT', () => {
    console.log('Shutting down WebSocket Server...');
    wss.close(() => {
        httpsServer.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
});