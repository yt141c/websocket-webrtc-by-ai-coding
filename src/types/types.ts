// UI要素の型定義
export interface Elements {
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

// 通話状態の型定義
export interface CallState {
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

// シグナリングメッセージの型定義
export interface SignalingMessage {
    type: 'connection-established' | 'offer' | 'answer' | 'ice-candidate';
    data?: any;
    from?: string;
    to?: string;
    clientId?: string;
}

// WebRTC設定の型定義
export const rtcConfig: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};