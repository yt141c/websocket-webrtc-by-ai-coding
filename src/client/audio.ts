import { CallState } from './types';
import { showError, updateAudioMeter } from './ui';

// AudioContextの初期化（ユーザーアクション時に呼び出し）
export async function initializeAudioContext(state: CallState): Promise<void> {
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

// メディアストリームの取得
export async function getLocalStream(): Promise<MediaStream> {
    try {
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
            }
        }
        throw error;
    }
}

// 音声レベルの監視を開始
export async function startAudioMeters(state: CallState): Promise<void> {
    try {
        // AudioContextの初期化を待機
        await initializeAudioContext(state);

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
                updateAudioMeter(level, true);
            }

            // リモート音声レベルの更新
            if (state.remoteAnalyser) {
                state.remoteAnalyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                const level = Math.min(100, (average / 128) * 100);
                updateAudioMeter(level, false);
            }
        }, 100);
    } catch (error) {
        console.error('Error starting audio meters:', error);
    }
}

// リモートストリームの処理と音声出力の設定
export async function handleRemoteStream(stream: MediaStream, state: CallState): Promise<void> {
    console.log('Setting up remote stream:', stream);
    state.remoteStream = stream;

    try {
        // AudioContextの初期化を待機
        await initializeAudioContext(state);

        // 既存の音声要素を停止・削除
        if (state.remoteAudio) {
            state.remoteAudio.pause();
            state.remoteAudio.srcObject = null;
        }

        // 新しい音声要素を作成
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
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
            await setupRemoteAudioMeter(stream, state);
        }
    } catch (error) {
        console.error('Error handling remote stream:', error);
        showError('音声の再生に失敗しました。ブラウザの自動再生設定を確認してください。');
    }
}

// リモート音声のレベルメーター設定
async function setupRemoteAudioMeter(stream: MediaStream, state: CallState): Promise<void> {
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