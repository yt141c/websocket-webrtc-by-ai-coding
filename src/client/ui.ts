import { Elements, CallState } from '../types/types';

// DOM要素の取得と型安全な参照
export const elements: Elements = {
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

// エラーメッセージを表示する関数
export function showError(message: string): void {
    console.error('Error:', message);
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    setTimeout(hideError, 5000);
}

// エラーメッセージを非表示にする関数
export function hideError(): void {
    elements.errorMessage.classList.add('hidden');
}

// ローディングインジケータの表示/非表示を制御する関数
export function toggleLoading(show: boolean, state: CallState): void {
    state.isLoading = show;
    elements.loadingIndicator.classList.toggle('hidden', !show);
    elements.callButton.disabled = show;
}

// 通話状態のUIを更新する関数
export function updateCallUI(inCall: boolean, state: CallState): void {
    state.isInCall = inCall;
    elements.callButton.classList.toggle('hidden', inCall);
    elements.muteButton.classList.toggle('hidden', !inCall);
    elements.hangUpButton.classList.toggle('hidden', !inCall);
    elements.audioStatus.classList.toggle('hidden', !inCall);
}

// 接続状態の更新
export function updateConnectionStatus(status: string, isConnected: boolean = false): void {
    elements.connectionStatus.classList.remove('hidden');
    elements.connectionStatus.classList.toggle('connected', isConnected);
    elements.connectionStatus.classList.toggle('disconnected', !isConnected);
    elements.connectionStatusText.textContent = status;
}

// ミュート状態を更新する関数
export function updateMuteUI(isMuted: boolean): void {
    elements.muteButton.classList.toggle('muted', isMuted);
    elements.muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
}

// 音声メーターを更新する関数
export function updateAudioMeter(level: number, isLocal: boolean): void {
    const meter = isLocal ? elements.localAudioMeter : elements.remoteAudioMeter;
    const indicator = isLocal ? elements.localAudioIndicator : elements.remoteAudioIndicator;

    meter.style.width = `${level}%`;
    indicator.classList.toggle('active', level > 10);

    if (level > 10) {
        console.log(`${isLocal ? 'Local' : 'Remote'} audio level:`, level);
    }
}