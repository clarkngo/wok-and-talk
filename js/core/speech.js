// Text-to-speech via the browser's built-in Web Speech API (no network calls of our own).

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

let voice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  voice = voices.find((v) => /^zh[-_]CN/i.test(v.lang))
       ?? voices.find((v) => /^cmn/i.test(v.lang))
       ?? voices.find((v) => /^zh/i.test(v.lang))
       ?? null;
}

if (canSpeak) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function speak(text, rate = 0.9) {
  if (!canSpeak || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang ?? 'zh-CN';
  if (voice) u.voice = voice;
  u.rate = rate;
  speechSynthesis.speak(u);
}

export function hasChineseVoice() {
  return !!voice;
}
