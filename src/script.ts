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
        state.websocket = new WebSocket('ws://localhost:8080');

        state.websocket.onopen = () => {
            console.log('WebSocket connected');
            resolve();
        };

        state.websocket.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            handleSignalingMessage(message);
        };

        state.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            showError('シグナリングサーバーに接続できません');
            reject(error);
        };

        state.websocket.onclose = () => {
            console.log('WebSocket closed');
            if (state.isInCall) {
                handleCallEnd();
            }
        };
    });
}

// シグナリングメッセージの処理
async function handleSignalingMessage(message: any): Promise<void> {
    switch (message.type) {
        case 'connection-established':
            state.clientId = message.clientId;
            break;

        case 'offer':
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
            await state.peerConnection?.setRemoteDescription(new RTCSessionDescription(message.data));
            break;

        case 'ice-candidate':
            if (message.data) {
                await state.peerConnection?.addIceCandidate(new RTCIceCandidate(message.data));
            }
            break;
    }
}

// シグナリングメッセージの送信
function sendSignalingMessage(message: any): void {
    if (state.websocket?.readyState === WebSocket.OPEN) {
        state.websocket.send(JSON.stringify(message));
    }
}

// メディアストリームの取得
async function getLocalStream(): Promise<MediaStream> {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return stream;
    } catch (error) {
        console.error('Error accessing media devices:', error);
        throw new Error('マイクへのアクセスが拒否されました');
    }
}

// PeerConnectionの初期化
async function initializePeerConnection(): Promise<void> {
    state.peerConnection = new RTCPeerConnection(rtcConfig);

    // ICE candidateの送信
    state.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignalingMessage({
                type: 'ice-candidate',
                data: event.candidate
            });
        }
    };

    // リモートストリームの処理
    state.peerConnection.ontrack = (event) => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play();
    };

    // ローカルストリームの追加
    if (!state.localStream) {
        state.localStream = await getLocalStream();
    }
    state.localStream.getTracks().forEach(track => {
        state.peerConnection!.addTrack(track, state.localStream!);
    });
}

// 通話開始処理
async function startCall(): Promise<void> {
    try {
        toggleLoading(true);

        // WebSocket接続
        await connectWebSocket();

        // PeerConnection初期化
        await initializePeerConnection();

        // Offerの作成と送信
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