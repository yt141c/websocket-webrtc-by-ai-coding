// 型定義
interface Elements {
    callButton: HTMLButtonElement;
    loadingIndicator: HTMLDivElement;
    muteButton: HTMLButtonElement;
    hangUpButton: HTMLButtonElement;
    errorMessage: HTMLDivElement;
    audioStatus: HTMLDivElement;
    localAudioMeter: HTMLDivElement;
    remoteAudioMeter: HTMLDivElement;
    localAudioIndicator: HTMLDivElement;
    remoteAudioIndicator: HTMLDivElement;
    connectionStatus: HTMLDivElement;
    connectionStatusText: HTMLSpanElement;
}

interface CallState {
    isInCall: boolean;
    isMuted: boolean;
    isLoading: boolean;
    clientId?: string;
    localStream?: MediaStream;
    remoteStream?: MediaStream;
    peerConnection?: RTCPeerConnection;
    websocket?: WebSocket;
    audioContext?: AudioContext;
    localAnalyser?: AnalyserNode;
    remoteAnalyser?: AnalyserNode;
    audioMeterInterval?: number;
    remoteAudio?: HTMLAudioElement;
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
    errorMessage: document.getElementById('errorMessage') as HTMLDivElement,
    audioStatus: document.getElementById('audioStatus') as HTMLDivElement,
    localAudioMeter: document.getElementById('localAudioMeter') as HTMLDivElement,
    remoteAudioMeter: document.getElementById('remoteAudioMeter') as HTMLDivElement,
    localAudioIndicator: document.getElementById('localAudioIndicator') as HTMLDivElement,
    remoteAudioIndicator: document.getElementById('remoteAudioIndicator') as HTMLDivElement,
    connectionStatus: document.getElementById('connectionStatus') as HTMLDivElement,
    connectionStatusText: document.getElementById('connectionStatusText') as HTMLSpanElement
};

// 通話状態の管理
const state: CallState = {
    isInCall: false,
    isMuted: false,
    isLoading: false
};

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
    elements.audioStatus.classList.toggle('hidden', !inCall);
}

// 接続状態の更新
function updateConnectionStatus(status: string, isConnected: boolean = false): void {
    elements.connectionStatus.classList.remove('hidden');
    elements.connectionStatus.classList.toggle('connected', isConnected);
    elements.connectionStatus.classList.toggle('disconnected', !isConnected);
    elements.connectionStatusText.textContent = status;
}

// AudioContextの初期化（ユーザーアクション時に呼び出し）
async function initializeAudioContext(): Promise<void> {
    try {
        if (!state.audioContext || state.audioContext.state === 'closed') {
            state.audioContext = new AudioContext();
        }

        if (state.audioContext.state === 'suspended') {
            await state.audioContext.resume();
            console.log('AudioContext resumed successfully');
        }
    } catch (error) {
        console.error('Failed to initialize AudioContext:', error);
        throw new Error('音声処理の初期化に失敗しました');
    }
}

// 音声レベルの監視を開始
async function startAudioMeters(): Promise<void> {
    try {
        // AudioContextの初期化を待機
        await initializeAudioContext();

        // ローカル音声の分析
        if (state.localStream && state.audioContext) {
            const source = state.audioContext.createMediaStreamSource(state.localStream);
            state.localAnalyser = state.audioContext.createAnalyser();
            state.localAnalyser.fftSize = 256;
            state.localAnalyser.smoothingTimeConstant = 0.3;
            source.connect(state.localAnalyser);
            console.log('Local audio meter setup completed');
        }

        // 音声レベルの定期的な更新
        const dataArray = new Uint8Array(128);
        state.audioMeterInterval = window.setInterval(() => {
            // ローカル音声レベルの更新
            if (state.localAnalyser) {
                state.localAnalyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                const level = Math.min(100, (average / 128) * 100);
                elements.localAudioMeter.style.width = `${level}%`;
                elements.localAudioIndicator.classList.toggle('active', level > 10);

                // デバッグログ
                if (level > 10) {
                    console.log('Local audio level:', level);
                }
            }

            // リモート音声レベルの更新
            if (state.remoteAnalyser) {
                state.remoteAnalyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                const level = Math.min(100, (average / 128) * 100);
                elements.remoteAudioMeter.style.width = `${level}%`;
                elements.remoteAudioIndicator.classList.toggle('active', level > 10);

                // デバッグログ
                if (level > 10) {
                    console.log('Remote audio level:', level);
                }
            }
        }, 100);

        elements.audioStatus.classList.remove('hidden');
    } catch (error) {
        console.error('Error starting audio meters:', error);
    }
}

// リモートストリームの処理と音声出力の設定
async function handleRemoteStream(stream: MediaStream): Promise<void> {
    console.log('Setting up remote stream:', stream);
    state.remoteStream = stream;

    try {
        // AudioContextの初期化を待機
        await initializeAudioContext();

        // 既存の音声要素を停止・削除
        if (state.remoteAudio) {
            state.remoteAudio.pause();
            state.remoteAudio.srcObject = null;
        }

        // 新しい音声要素を作成
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;

        // 音量を設定（0.0から1.0）
        audio.volume = 1.0;

        // エラーハンドリング
        audio.onerror = (error) => {
            console.error('Audio playback error:', error);
            showError('音声の再生に失敗しました');
        };

        // 再生開始時のログ
        audio.onplay = () => {
            console.log('Remote audio playback started');
        };

        // 再生を開始
        await audio.play();
        console.log('Remote audio playback started successfully');
        state.remoteAudio = audio;

        // 音声レベルメーターの設定
        if (state.audioContext) {
            await setupRemoteAudioMeter(stream);
        }
    } catch (error) {
        console.error('Error handling remote stream:', error);
        showError('音声の再生に失敗しました。ブラウザの自動再生設定を確認してください。');
    }
}

// リモート音声のレベルメーター設定
async function setupRemoteAudioMeter(stream: MediaStream): Promise<void> {
    if (!state.audioContext) {
        return;
    }

    try {
        // 既存の接続を解除
        if (state.remoteAnalyser) {
            state.remoteAnalyser.disconnect();
        }

        // 新しいAnalyserNodeを作成
        state.remoteAnalyser = state.audioContext.createAnalyser();
        state.remoteAnalyser.fftSize = 256;
        state.remoteAnalyser.smoothingTimeConstant = 0.3;

        // ストリームをAudioContextに接続
        const source = state.audioContext.createMediaStreamSource(stream);
        source.connect(state.remoteAnalyser);

        // 音声出力のために別の接続を作成
        const destination = state.audioContext.createMediaStreamDestination();
        source.connect(destination);

        console.log('Remote audio meter setup completed');
    } catch (error) {
        console.error('Error setting up remote audio meter:', error);
    }
}

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
                updateConnectionStatus('シグナリングサーバーに接続済み', true);
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
                updateConnectionStatus('シグナリングサーバーへの接続エラー');
                clearTimeout(connectTimeout);
                reject(new Error('シグナリングサーバーへの接続に失敗しました。ネットワーク設定を確認してください。'));
            };

            state.websocket.onclose = () => {
                console.log('WebSocket connection closed');
                updateConnectionStatus('シグナリングサーバーから切断');
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
                updateConnectionStatus('シグナリングサーバーに接続済み', true);
                break;

            case 'offer':
                console.log('Received offer');
                updateConnectionStatus('通話要求を受信', true);
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
                    handleCallEnd();
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
                handleRemoteStream(event.streams[0]);
            }
        };

        // 接続状態の監視
        state.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', state.peerConnection?.connectionState);
        };

        // ローカルストリームの追加
        if (!state.localStream) {
            state.localStream = await getLocalStream();
            await startAudioMeters();
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

// 通話開始処理
async function startCall(): Promise<void> {
    try {
        toggleLoading(true);
        updateConnectionStatus('接続準備中...');

        // AudioContextの初期化（ユーザーアクション時）
        await initializeAudioContext();

        // WebSocket接続
        await connectWebSocket();
        console.log('WebSocket connection established');

        // マイクのストリームを取得
        if (!state.localStream) {
            state.localStream = await getLocalStream();
            await startAudioMeters();
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

    updateCallUI(false);
    updateConnectionStatus('切断済み');
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
elements.callButton.addEventListener('click', async () => {
    try {
        // AudioContextの初期化を試みる
        await initializeAudioContext();
        // 通話開始処理を実行
        await startCall();
    } catch (error) {
        console.error('Failed to start call:', error);
        showError(error instanceof Error ? error.message : '通話の開始に失敗しました');
    }
});

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
    updateConnectionStatus('未接続');
});