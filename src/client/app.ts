// app.ts
import { CallState } from '../types/types';
import { elements, showError, toggleLoading, updateCallUI, updateMuteUI, updateConnectionStatus } from './ui';
import { initializeAudioContext, startAudioMeters, getLocalStream } from './audio';
import { connectWebSocket } from './websocket';
import { initializePeerConnection, handleCallEnd } from './webrtc';

// 通話状態の管理
const state: CallState = {
    isInCall: false,
    isMuted: false,
    isLoading: false,
    roomId: undefined,
    isHost: undefined
};

// 通話開始処理（ホスト）
async function startCall(): Promise<void> {
    try {
        // ランダムな部屋IDを生成
        const roomId = Math.random().toString(36).substring(7);
        await initiateConnection(true, roomId);
    } catch (error) {
        console.error('Error starting call:', error);
        showError(error instanceof Error ? error.message : '通話の開始に失敗しました');
        handleCallEnd(state);
    }
}

// 通話参加処理（ゲスト）
async function joinCall(): Promise<void> {
    try {
        const roomId = prompt('参加する部屋IDを入力してください:');
        if (!roomId) {
            return;
        }
        await initiateConnection(false, roomId);
    } catch (error) {
        console.error('Error joining call:', error);
        showError(error instanceof Error ? error.message : '通話への参加に失敗しました');
        handleCallEnd(state);
    }
}

// 共通の接続処理
async function initiateConnection(isHost: boolean, roomId: string): Promise<void> {
    toggleLoading(true, state);
    updateConnectionStatus(isHost ? '部屋を作成中...' : '部屋に参加中...');

    try {
        // AudioContextの初期化（ユーザーアクション時）
        await initializeAudioContext(state);

        // マイクのストリームを取得
        if (!state.localStream) {
            state.localStream = await getLocalStream();
            await startAudioMeters(state);
        }
        console.log('Media stream obtained');

        // PeerConnection初期化
        await initializePeerConnection(state);
        console.log('PeerConnection initialized');

        // WebSocket接続とシグナリング開始
        await connectWebSocket(state, isHost, roomId);
        console.log('WebSocket connection established');

        // UIの更新
        updateCallUI(true, state);

        // 部屋IDの表示（ホストの場合）
        if (isHost) {
            showError(`部屋IDは "${roomId}" です。このIDを相手に伝えてください。`);
        }
    } finally {
        toggleLoading(false, state);
    }
}

// ミュート状態を切り替える関数
function toggleMute(): void {
    if (state.localStream) {
        state.isMuted = !state.isMuted;
        state.localStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
            track.enabled = !state.isMuted;
        });
        updateMuteUI(state.isMuted);
    }
}

// イベントリスナーの設定
export function initializeEventListeners(): void {
    // 「Call」ボタンを「Create Room」と「Join Room」に分割
    elements.callButton.textContent = 'Create Room';

    // Join Roomボタンを作成
    const joinButton = document.createElement('button');
    joinButton.textContent = 'Join Room';
    joinButton.className = elements.callButton.className;
    elements.callButton.parentNode?.insertBefore(joinButton, elements.callButton.nextSibling);

    // Create Roomボタンのイベントリスナー
    elements.callButton.addEventListener('click', async () => {
        try {
            await initializeAudioContext(state);
            await startCall();
        } catch (error) {
            console.error('Failed to create room:', error);
            showError(error instanceof Error ? error.message : '部屋の作成に失敗しました');
        }
    });

    // Join Roomボタンのイベントリスナー
    joinButton.addEventListener('click', async () => {
        try {
            await initializeAudioContext(state);
            await joinCall();
        } catch (error) {
            console.error('Failed to join room:', error);
            showError(error instanceof Error ? error.message : '部屋への参加に失敗しました');
        }
    });

    elements.muteButton.addEventListener('click', toggleMute);

    elements.hangUpButton.addEventListener('click', () => handleCallEnd(state));

    // エラーハンドリング
    window.addEventListener('error', (event) => {
        showError(`エラーが発生しました: ${event.message}`);
    });

    // ページ終了時の処理
    window.addEventListener('beforeunload', () => {
        if (state.isInCall) {
            handleCallEnd(state);
        }
    });

    // 初期化時のチェック
    window.addEventListener('load', () => {
        // HTTPSチェック
        if (window.location.protocol !== 'https:' &&
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1') {
            console.warn('Warning: Running on non-HTTPS connection.');
        }
        updateConnectionStatus('未接続');
    });
}

// アプリケーションの初期化
export function initializeApp(): void {
    initializeEventListeners();
    console.log('Application initialized');
}

export { handleCallEnd, state };