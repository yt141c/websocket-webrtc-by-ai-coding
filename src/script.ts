// 型定義
interface Elements {
    callButton: HTMLButtonElement;
    loadingIndicator: HTMLDivElement;
    muteButton: HTMLButtonElement;
    hangUpButton: HTMLButtonElement;
    errorMessage: HTMLDivElement;
}

// DOM要素の取得と型安全な参照
const elements: Elements = {
    callButton: document.getElementById('callButton') as HTMLButtonElement,
    loadingIndicator: document.getElementById('loadingIndicator') as HTMLDivElement,
    muteButton: document.getElementById('muteButton') as HTMLButtonElement,
    hangUpButton: document.getElementById('hangUpButton') as HTMLButtonElement,
    errorMessage: document.getElementById('errorMessage') as HTMLDivElement
};

// エラーメッセージを表示する関数
function showError(message: string): void {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
}

// エラーメッセージを非表示にする関数
function hideError(): void {
    elements.errorMessage.classList.add('hidden');
}

// ローディングインジケータの表示/非表示を制御する関数
function toggleLoading(show: boolean): void {
    elements.loadingIndicator.classList.toggle('hidden', !show);
}

// イベントリスナーの設定
elements.callButton.addEventListener('click', () => {
    // 通話開始処理（後で実装）
    console.log('Call button clicked');
});

elements.muteButton.addEventListener('click', () => {
    // ミュート処理（後で実装）
    console.log('Mute button clicked');
});

elements.hangUpButton.addEventListener('click', () => {
    // 通話終了処理（後で実装）
    console.log('Hang up button clicked');
});