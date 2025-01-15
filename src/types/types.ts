// types.ts
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

export interface CallState {
    isInCall: boolean;
    isMuted: boolean;
    isLoading: boolean;
    clientId?: string;
    roomId?: string;
    isHost?: boolean;
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

export interface SignalingMessage {
    type: 'offer' | 'answer' | 'ice-candidate' | 'create' | 'join' |
    'connection-established' | 'room-created' | 'joined' |
    'guest-joined' | 'host-left' | 'guest-left';
    data?: any;
    from?: string;
    to?: string;
    room?: string;
    clientId?: string;
}

export const rtcConfig: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};