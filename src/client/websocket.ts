import { CallState, SignalingMessage } from '../types/types';
import { updateConnectionStatus, showError } from './ui';
import { handleSignalingMessage } from './webrtc';

// WebSocket接続を確立
export function connectWebSocket(state: CallState): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            // 現在のホストのIPアドレスを使用
            const host = window.location.hostname;
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const port = window.location.protocol === 'https:' ? '8443' : '8080';
            const wsUrl = `${protocol}//${host}:${port}`;
            console.log('Connecting to WebSocket server:', wsUrl);

            if (state.websocket) {
                state.websocket.close();
            }

            state.websocket = new WebSocket(wsUrl);

            let connectTimeout = setTimeout(() => {
                if (state.websocket?.readyState !== WebSocket.OPEN) {
                    state.websocket?.close();
                    reject(new Error('シグナリングサーバーへの接続がタイムアウトしました。ネットワーク設定を確認してください。'));
                }
            }, 5000);

            state.websocket.onopen = () => {
                console.log('WebSocket connected successfully');
                updateConnectionStatus('シグナリングサーバーに接続済み', true);
                clearTimeout(connectTimeout);
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
                reject(new Error('シグナリングサーバーへの接続に失敗しました。ネットワーク設定を確認してください。'));
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
        showError('シグナリングサーバーに接続できません。ネットワーク設定を確認してください。');
    }
}
