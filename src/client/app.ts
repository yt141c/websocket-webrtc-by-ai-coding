import { CallState } from '../types/types';
import { elements, showError, toggleLoading, updateCallUI, updateMuteUI, updateConnectionStatus } from './ui';
import { initializeAudioContext, startAudioMeters, getLocalStream } from './audio';
import { connectWebSocket, sendSignalingMessage } from './websocket';
import { initializePeerConnection, handleCallEnd } from './webrtc';

// 通話状態の管理
export const state: CallState = {
    isInCall: false,
    isMuted: false,
    isLoading: false
};

// 通話開始処理
async function startCall(): Promise<void> {
    try {
        toggleLoading(true, state);
        updateConnectionStatus('接続準備中...');

        // AudioContextの初期化（ユーザーアクション時）
        await initializeAudioContext(state);

        // WebSocket接続
        await connectWebSocket(state);
        console.log('WebSocket connection established');

        // マイクのストリームを取得
        if (!state.localStream) {
            state.localStream = await getLocalStream();
            await startAudioMeters(state);
        }
        console.log('Media stream obtained');

        // PeerConnection初期化
        await initializePeerConnection(state);
        console.log('PeerConnection initialized');

        // Offerの作成と送信
        console.log('Creating offer');
        const offer = await state.peerConnection!.createOffer();
        await state.peerConnection!.setLocalDescription(offer);
        sendSignalingMessage({
            type: 'offer',
            data: offer
        }, state);

        updateCallUI(true, state);
    } catch (error) {
        console.error('Error starting call:', error);
        showError(error instanceof Error ? error.message : '通話の開始に失敗しました');
        handleCallEnd(state);
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
    elements.callButton.addEventListener('click', async () => {
        try {
            // AudioContextの初期化を試みる
            await initializeAudioContext(state);
            // 通話開始処理を実行
            await startCall();
        } catch (error) {
            console.error('Failed to start call:', error);
            showError(error instanceof Error ? error.message : '通話の開始に失敗しました');
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
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            console.warn('Warning: Running on non-HTTPS connection. MediaDevices may not work.');
        }
        updateConnectionStatus('未接続');
    });
}

// アプリケーションの初期化
export function initializeApp(): void {
    initializeEventListeners();
    console.log('Application initialized');
}

export { handleCallEnd };
