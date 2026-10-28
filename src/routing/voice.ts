/** spoken guidance (browser speech synthesis); silent when the browser has no German voice */
export class Voice {
  enabled = false;
  private spoken = new Set<string>();

  available(): boolean {
    return 'speechSynthesis' in window;
  }

  say(text: string) {
    if (!this.enabled || !this.available() || !text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    const v = speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith('de'));
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  /** speaks `text` once per key (so a repeated fix does not repeat the announcement) */
  once(key: string, text: string) {
    if (this.spoken.has(key)) return;
    this.spoken.add(key);
    this.say(text);
  }

  reset() {
    this.spoken.clear();
    if (this.available()) speechSynthesis.cancel();
  }
}
