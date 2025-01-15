// 型定義
interface Elements {
    callButton: HTMLButtonElement;
    loadingIndicator: HTMLDivElement;
    muteButton: HTMLButtonElement;
    hangUpButton: HTMLButtonElement;
    errorMessage: HTMLDivElement;
}

interface CallState {
    isInCall: boolean;
    isMuted: boolean;
    isLoading: boolean;
    clientId?: string;
    localStream?: MediaStream;
    peerConnection?: RTCPeerConnection;
    websocket?: WebSocket;
}

// WebRTC設定
const rtcConfig: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// DOM要素の取得と型安全な参照
const elements: Elements = {
    callButton: document.getElementById('callButton') as HTMLButtonElement,
    loadingIndicator: document.getElementById('loadingIndicator') as HTMLDivElement,
    muteButton: document.getElementById('muteButton') as HTMLButtonElement,
    hangUpButton: document.getElementById('hangUpButton') as HTMLButtonElement,
    errorMessage: document.getElementById('errorMessage') as HTMLDivElement
};

// 通話状態の管理
const state: CallState = {
    isInCall: false,
    isMuted: false,
    isLoading: false
};

// WebSocket接続を確立
function connectWebSocket(): Promise<void> {
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
                clearTimeout(connectTimeout);
                resolve();
            };

            state.websocket.onmessage = async (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('Received WebSocket message:', message.type);
                    await handleSignalingMessage(message);
                } catch (error) {
                    console.error('Error handling WebSocket message:', error);
                }
            };

            state.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                clearTimeout(connectTimeout);
                reject(new Error('シグナリングサーバーへの接続に失敗しました。ネットワーク設定を確認してください。'));
            };

            state.websocket.onclose = () => {
                console.log('WebSocket connection closed');
                if (state.isInCall) {
                    handleCallEnd();
                }
            };
        } catch (error) {
            console.error('Error creating WebSocket connection:', error);
            reject(error);
        }
    });
}

// シグナリングメッセージの処理
async function handleSignalingMessage(message: any): Promise<void> {
    try {
        switch (message.type) {
            case 'connection-established':
                state.clientId = message.clientId;
                console.log('Connection established, client ID:', state.clientId);
                break;

            case 'offer':
                console.log('Received offer');
                if (!state.peerConnection) {
                    await initializePeerConnection();
                }
                await state.peerConnection!.setRemoteDescription(new RTCSessionDescription(message.data));
                const answer = await state.peerConnection!.createAnswer();
                await state.peerConnection!.setLocalDescription(answer);
                sendSignalingMessage({
                    type: 'answer',
                    data: answer,
                    to: message.from
                });
                break;

            case 'answer':
                console.log('Received answer');
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

// シグナリングメッセージの送信
function sendSignalingMessage(message: any): void {
    if (state.websocket?.readyState === WebSocket.OPEN) {
        console.log('Sending message:', message.type);
        state.websocket.send(JSON.stringify(message));
    } else {
        console.error('WebSocket is not open');
        showError('シグナリングサーバーに接続できません。ネットワーク設定を確認してください。');
    }
}

// メディアストリームの取得
async function getLocalStream(): Promise<MediaStream> {
    try {
        // WebSocket接続の確認
        if (!state.websocket || state.websocket.readyState !== WebSocket.OPEN) {
            throw new Error('シグナリングサーバーに接続できません。ネットワーク設定を確認してください。');
        }

        // HTTPSチェック
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            throw new Error('マイクへのアクセスにはHTTPS接続が必要です。HTTPSで接続し直すか、localhostで試してください。');
        }

        // mediaDevicesのサポートチェック
        if (!navigator.mediaDevices) {
            console.log('mediaDevices not available, trying legacy APIs');
            // 古いブラウザのサポート
            const getUserMedia = (navigator as any).getUserMedia ||
                (navigator as any).webkitGetUserMedia ||
                (navigator as any).mozGetUserMedia ||
                (navigator as any).msGetUserMedia;

            if (!getUserMedia) {
                throw new Error('このブラウザはマイクをサポートしていません。最新のChromeまたはSafariをお試しください。');
            }

            // 古いAPIを使用してマイクにアクセス
            return new Promise((resolve, reject) => {
                getUserMedia.call(navigator, { audio: true }, resolve, reject);
            });
        }

        // マイクのストリームを取得
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        };

        console.log('Requesting media stream with constraints:', constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Media stream obtained successfully');

        return stream;
    } catch (error) {
        console.error('Error accessing media devices:', error);
        if (error instanceof Error) {
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                throw new Error('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
            } else if (error.name === 'NotFoundError') {
                throw new Error('マイクが見つかりません。デバイスを確認してください。');
            } else if (error.name === 'NotReadableError') {
                throw new Error('マイクにアクセスできません。他のアプリが使用中かもしれません。');
            } else if (error.name === 'SecurityError') {
                throw new Error('マイクへのアクセスが制限されています。HTTPS接続で試してください。');
            } else {
                throw error;
            }
        }
        throw error;
    }
}

// PeerConnectionの初期化
async function initializePeerConnection(): Promise<void> {
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
                });
            }
        };

        // ICE接続状態の監視
        state.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', state.peerConnection?.iceConnectionState);
            if (state.peerConnection?.iceConnectionState === 'failed') {
                showError('通話接続に失敗しました。ネットワーク設定を確認してください。');
                handleCallEnd();
            }
        };

        // リモートストリームの処理
        state.peerConnection.ontrack = (event) => {
            console.log('Remote track received');
            const audio = new Audio();
            audio.srcObject = event.streams[0];
            audio.play().catch(console.error);
        };

        // ローカルストリームの追加
        if (!state.localStream) {
            state.localStream = await getLocalStream();
        }
        state.localStream.getTracks().forEach(track => {
            console.log('Adding local track to peer connection');
            state.peerConnection!.addTrack(track, state.localStream!);
        });
    } catch (error) {
        console.error('Error initializing peer connection:', error);
        throw error;
    }
}

// 通話開始処理
async function startCall(): Promise<void> {
    try {
        toggleLoading(true);

        // WebSocket接続
        await connectWebSocket();
        console.log('WebSocket connection established');

        // マイクのストリームを取得
        if (!state.localStream) {
            state.localStream = await getLocalStream();
        }
        console.log('Media stream obtained');

        // PeerConnection初期化
        await initializePeerConnection();
        console.log('PeerConnection initialized');

        // Offerの作成と送信
        console.log('Creating offer');
        const offer = await state.peerConnection!.createOffer();
        await state.peerConnection!.setLocalDescription(offer);
        sendSignalingMessage({
            type: 'offer',
            data: offer
        });

        updateCallUI(true);
    } catch (error) {
        console.error('Error starting call:', error);
        showError(error instanceof Error ? error.message : '通話の開始に失敗しました');
        handleCallEnd();
    } finally {
        toggleLoading(false);
    }
}

// 通話終了処理
function handleCallEnd(): void {
    console.log('Ending call');
    state.localStream?.getTracks().forEach(track => track.stop());
    state.peerConnection?.close();
    state.websocket?.close();

    state.localStream = undefined;
    state.peerConnection = undefined;
    state.websocket = undefined;

    updateCallUI(false);
}

// エラーメッセージを表示する関数
function showError(message: string): void {
    console.error('Error:', message);
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    setTimeout(hideError, 5000);
}

// エラーメッセージを非表示にする関数
function hideError(): void {
    elements.errorMessage.classList.add('hidden');
}

// ローディングインジケータの表示/非表示を制御する関数
function toggleLoading(show: boolean): void {
    state.isLoading = show;
    elements.loadingIndicator.classList.toggle('hidden', !show);
    elements.callButton.disabled = show;
}

// 通話状態のUIを更新する関数
function updateCallUI(inCall: boolean): void {
    state.isInCall = inCall;
    elements.callButton.classList.toggle('hidden', inCall);
    elements.muteButton.classList.toggle('hidden', !inCall);
    elements.hangUpButton.classList.toggle('hidden', !inCall);
}

// ミュート状態を切り替える関数
function toggleMute(): void {
    if (state.localStream) {
        state.isMuted = !state.isMuted;
        state.localStream.getAudioTracks().forEach(track => {
            track.enabled = !state.isMuted;
        });
        elements.muteButton.classList.toggle('muted', state.isMuted);
        elements.muteButton.textContent = state.isMuted ? 'Unmute' : 'Mute';
    }
}

// イベントリスナーの設定
elements.callButton.addEventListener('click', startCall);

elements.muteButton.addEventListener('click', toggleMute);

elements.hangUpButton.addEventListener('click', handleCallEnd);

// エラーハンドリング
window.addEventListener('error', (event) => {
    showError(`エラーが発生しました: ${event.message}`);
});

// ページ終了時の処理
window.addEventListener('beforeunload', () => {
    if (state.isInCall) {
        handleCallEnd();
    }
});

// 初期化時のチェック
window.addEventListener('load', () => {
    // HTTPSチェック
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.warn('Warning: Running on non-HTTPS connection. MediaDevices may not work.');
    }
});