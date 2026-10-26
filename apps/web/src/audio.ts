// Original synthesized melodies and event sounds. No sampled recordings or third-party music.
export class EchoAudio {
  context: AudioContext | null = null;
  music = 0.25;
  effects = 0.45;
  muted = false;
  active = false;
  level = 1;
  private timer = 0;
  private step = 0;
  private voices = new Set<OscillatorNode>();
  async unlock(): Promise<void> {
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
    if (!this.timer) this.timer = window.setInterval(() => this.pulse(), 320);
  }
  silence(): void {
    for (const voice of this.voices) { try {voice.stop();} catch {/* already ended */} }
    this.voices.clear();
  }
  private tone(note: number, duration: number, volume: number, delay = 0, type: OscillatorType = 'sine'): void {
    const context = this.context;
    if (!context || this.muted || context.state !== 'running' || volume === 0) return;
    const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume * 0.13, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(start); oscillator.stop(start + duration + 0.01);
    this.voices.add(oscillator);
    oscillator.onended = () => {this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect();};
  }
  private pulse(): void {
    if (!this.active || this.muted) return;
    const motifs = [[57,64,69,64,60,67,72,67,57,64,71,64,60,67,69,64],
      [62,69,74,77,65,72,76,72,62,69,72,76,65,69,74,72],
      [64,71,76,79,67,74,78,74,64,71,74,78,67,71,76,74]];
    const notes = motifs[this.level < 4 ? 0 : this.level < 8 ? 1 : 2]!;
    const note = notes[this.step++ % notes.length]!;
    this.tone(note, 0.85, this.music * 0.35);
    if (this.step % 4 === 0) this.tone(note - 24, 1.1, this.music * 0.3);
  }
  play(kind: 'turn' | 'drop' | 'line' | 'spin' | 'perfect' | 'end', lines = 1): void {
    if (kind === 'turn') this.tone(72, 0.07, this.effects * 0.35);
    else if (kind === 'drop') {this.tone(43, 0.13, this.effects, 0, 'triangle'); this.tone(55, 0.07, this.effects * 0.3);}
    else if (kind === 'end') [64,60,57].forEach((n,i) => this.tone(n,0.7,this.effects*0.5,i*0.16));
    else {
      const notes = kind === 'perfect' ? [60,64,67,72,76,79,84] : kind === 'spin' ? [62,69,74,81] : [64,67,72,76].slice(0,Math.min(4,lines+1));
      notes.forEach((n,i) => this.tone(n,0.4,this.effects*0.6,i*0.055));
    }
  }
}
