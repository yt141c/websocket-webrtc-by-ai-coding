import { CallState, SignalingMessage, rtcConfig } from './types';
import { updateConnectionStatus, showError } from './ui';
import { handleRemoteStream, getLocalStream, startAudioMeters } from './audio';
import { sendSignalingMessage } from './websocket';

// PeerConnectionの初期化
export async function initializePeerConnection(state: CallState): Promise<void> {
    try {
        state.peerConnection = new RTCPeerConnection(rtcConfig);
        console.log('RTCPeerConnection created');

        // ICE candidateの送信
        state.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate');
                sendSignalingMessage({
                    type: 'ice-candidate',
                    data: event.candidate
                }, state);
            }
        };

        // ICE接続状態の監視
        state.peerConnection.oniceconnectionstatechange = () => {
            const connectionState = state.peerConnection?.iceConnectionState;
            console.log('ICE connection state:', connectionState);

            switch (connectionState) {
                case 'checking':
                    updateConnectionStatus('接続確認中...', true);
                    break;
                case 'connected':
                    updateConnectionStatus('通話接続完了', true);
                    break;
                case 'completed':
                    updateConnectionStatus('通話中', true);
                    break;
                case 'failed':
                    updateConnectionStatus('接続失敗');
                    showError('通話接続に失敗しました。ネットワーク設定を確認してください。');
                    handleCallEnd(state);
                    break;
                case 'disconnected':
                    updateConnectionStatus('切断済み');
                    break;
                case 'closed':
                    updateConnectionStatus('接続終了');
                    break;
            }
        };

        // リモートストリームの処理
        state.peerConnection.ontrack = (event) => {
            console.log('Remote track received:', event.track.kind);
            if (event.track.kind === 'audio') {
                handleRemoteStream(event.streams[0], state);
            }
        };

        // 接続状態の監視
        state.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', state.peerConnection?.connectionState);
        };

        // ローカルストリームの追加
        if (!state.localStream) {
            state.localStream = await getLocalStream();
            await startAudioMeters(state);
        }

        // 既存のトラックをすべて削除
        const senders = state.peerConnection.getSenders();
        for (const sender of senders) {
            state.peerConnection.removeTrack(sender);
        }

        // トラックを追加
        state.localStream.getTracks().forEach(track => {
            console.log('Adding local track to peer connection:', track.kind);
            state.peerConnection!.addTrack(track, state.localStream!);
        });
    } catch (error) {
        console.error('Error initializing peer connection:', error);
        throw error;
    }
}

// シグナリングメッセージの処理
export async function handleSignalingMessage(message: SignalingMessage, state: CallState): Promise<void> {
    try {
        switch (message.type) {
            case 'connection-established':
                state.clientId = message.clientId;
                console.log('Connection established, client ID:', state.clientId);
                updateConnectionStatus('シグナリングサーバーに接続済み', true);
                break;

            case 'offer':
                console.log('Received offer');
                updateConnectionStatus('通話要求を受信', true);
                if (!state.peerConnection) {
                    await initializePeerConnection(state);
                }
                await state.peerConnection!.setRemoteDescription(new RTCSessionDescription(message.data));
                const answer = await state.peerConnection!.createAnswer();
                await state.peerConnection!.setLocalDescription(answer);
                sendSignalingMessage({
                    type: 'answer',
                    data: answer,
                    to: message.from
                }, state);
                break;

            case 'answer':
                console.log('Received answer');
                updateConnectionStatus('通話接続中', true);
                await state.peerConnection?.setRemoteDescription(new RTCSessionDescription(message.data));
                break;

            case 'ice-candidate':
                if (message.data) {
                    console.log('Received ICE candidate');
                    await state.peerConnection?.addIceCandidate(new RTCIceCandidate(message.data));
                }
                break;
        }
    } catch (error) {
        console.error('Error handling signaling message:', error);
        showError('シグナリング処理中にエラーが発生しました');
    }
}

// 通話終了処理
export function handleCallEnd(state: CallState): void {
    console.log('Ending call');

    // 音声の停止
    if (state.remoteAudio) {
        state.remoteAudio.pause();
        state.remoteAudio.srcObject = null;
        state.remoteAudio = undefined;
    }

    // 音声レベルメーターの停止
    if (state.audioMeterInterval) {
        clearInterval(state.audioMeterInterval);
        state.audioMeterInterval = undefined;
    }

    // AudioContextの解放
    if (state.audioContext) {
        state.audioContext.close().catch(console.error);
        state.audioContext = undefined;
    }

    state.localStream?.getTracks().forEach(track => track.stop());
    state.peerConnection?.close();
    state.websocket?.close();

    state.localStream = undefined;
    state.remoteStream = undefined;
    state.peerConnection = undefined;
    state.websocket = undefined;

    updateConnectionStatus('切断済み');
}