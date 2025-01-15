// websocket.ts
import { CallState, SignalingMessage } from '../types/types';
import { updateConnectionStatus, showError } from './ui';
import { handleSignalingMessage } from './webrtc';

// WebSocket接続を確立
export function connectWebSocket(state: CallState, isHost: boolean, roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const host = window.location.hostname;
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // HTTPSの場合は8443、HTTPの場合は8080を使用
            const port = window.location.protocol === 'https:' ? '8443' : '8080';
            const wsUrl = `${protocol}//${host}:${port}`;

            console.log('Connecting to WebSocket server:', wsUrl);

            if (state.websocket) {
                state.websocket.close();
            }

            state.websocket = new WebSocket(wsUrl);
            state.isHost = isHost;
            state.roomId = roomId;

            let connectTimeout = setTimeout(() => {
                if (state.websocket?.readyState !== WebSocket.OPEN) {
                    state.websocket?.close();
                    reject(new Error('シグナリングサーバーへの接続がタイムアウトしました。'));
                }
            }, 5000);

            state.websocket.onopen = () => {
                console.log('WebSocket connected successfully');
                updateConnectionStatus('シグナリングサーバーに接続済み', true);
                clearTimeout(connectTimeout);

                // 接続後、部屋の作成または参加メッセージを送信
                const message: SignalingMessage = isHost ?
                    { type: 'create' as const, room: roomId } :
                    { type: 'join' as const, room: roomId };

                sendSignalingMessage(message, state);
                resolve();
            };

            state.websocket.onmessage = async (event: MessageEvent) => {
                try {
                    const message = JSON.parse(event.data) as SignalingMessage;
                    console.log('Received WebSocket message:', message.type);
                    await handleSignalingMessage(message, state);
                } catch (error) {
                    console.error('Error handling WebSocket message:', error);
                }
            };

            state.websocket.onerror = (error: Event) => {
                console.error('WebSocket error:', error);
                updateConnectionStatus('シグナリングサーバーへの接続エラー');
                clearTimeout(connectTimeout);
                reject(new Error('シグナリングサーバーへの接続に失敗しました。'));
            };

            state.websocket.onclose = () => {
                console.log('WebSocket connection closed');
                updateConnectionStatus('シグナリングサーバーから切断');
            };
        } catch (error) {
            console.error('Error creating WebSocket connection:', error);
            reject(error);
        }
    });
}

// シグナリングメッセージの送信
export function sendSignalingMessage(message: SignalingMessage, state: CallState): void {
    if (state.websocket?.readyState === WebSocket.OPEN) {
        console.log('Sending message:', message.type);
        state.websocket.send(JSON.stringify(message));
    } else {
        console.error('WebSocket is not open');
        showError('シグナリングサーバーに接続できません。');
    }
}