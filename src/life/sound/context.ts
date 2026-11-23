// The town, the fires and the raids all make sound, and building an AudioContext
// costs tens of milliseconds inside the player's first tap. They share one, so
// that cost is paid once; it closes when the last of them lets go.
let ac: AudioContext | null = null;
let holders = 0;

export function holdAudio(): AudioContext {
  if (!ac || ac.state === 'closed') ac = new AudioContext();
  holders++;
  return ac;
}

export function releaseAudio(): void {
  if (holders === 0) return;
  holders--;
  if (holders === 0 && ac) {
    void ac.close();
    ac = null;
  }
}
