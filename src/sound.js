let audioContext = null;

const SFX_VOLUME = 0.78;
const PITCH_VARIATION = 0.035;
const SFX_VOLUME_STORAGE_KEY = "mindbug.sfxVolume";
const SFX_VOLUME_LEVELS = [0.45, 0.75, 1.05, 1.35, 1.7];
const DEFAULT_SFX_LEVEL = 3;
let sfxVolumeLevel = loadStoredSfxVolumeLevel();

function clampSfxLevel(level) {
  const parsed = Number.parseInt(level, 10);
  if (!Number.isInteger(parsed)) return DEFAULT_SFX_LEVEL;
  return Math.max(1, Math.min(parsed, SFX_VOLUME_LEVELS.length));
}

function volumeToLevel(value) {
  let bestLevel = DEFAULT_SFX_LEVEL;
  let bestDistance = Infinity;
  SFX_VOLUME_LEVELS.forEach((volume, index) => {
    const distance = Math.abs(volume - value);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLevel = index + 1;
    }
  });
  return bestLevel;
}

function loadStoredSfxVolumeLevel() {
  try {
    const saved = window.localStorage?.getItem(SFX_VOLUME_STORAGE_KEY);
    const value = Number.parseFloat(saved ?? "");
    if (!Number.isFinite(value)) return DEFAULT_SFX_LEVEL;
    if (Number.isInteger(value) && value >= 1 && value <= SFX_VOLUME_LEVELS.length) return value;
    return volumeToLevel(value);
  } catch {
    // Audio still works if localStorage is unavailable.
  }
  return DEFAULT_SFX_LEVEL;
}

function saveStoredSfxVolumeLevel(level) {
  try {
    window.localStorage?.setItem(SFX_VOLUME_STORAGE_KEY, String(level));
  } catch {
    // Ignore persistence failures in private contexts.
  }
}

function jitter(value, amount = PITCH_VARIATION) {
  return value * (1 + (Math.random() * 2 - 1) * amount);
}

function clampGain(value) {
  return Math.max(0.0001, Math.min(value, 0.9));
}

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass();
  return audioContext;
}

function resolveVolume(volume) {
  if (volume === false || volume == null) return 0;
  if (volume === true) return 1;
  return Math.max(0, Math.min(Number(volume), 1.5));
}

function tone(ctx, {
  frequency,
  endFrequency = null,
  duration = 0.08,
  type = "square",
  gain = 0.04,
  delay = 0,
  attack = 0.006,
  pitch = 1,
  filter = null,
  masterVolume = 1
}) {
  const now = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  const destination = filter ? ctx.createBiquadFilter() : volume;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(jitter(frequency * pitch), now);
  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, jitter(endFrequency * pitch, 0.015)), now + duration);
  }

  volume.gain.setValueAtTime(0.0001, now);
  volume.gain.exponentialRampToValueAtTime(clampGain(gain * masterVolume), now + attack);
  volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(destination);
  if (filter) {
    destination.type = filter.type ?? "lowpass";
    destination.frequency.setValueAtTime(filter.frequency ?? 1400, now);
    destination.Q.setValueAtTime(filter.q ?? 1.2, now);
    destination.connect(volume);
  }
  volume.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function noise(ctx, {
  duration = 0.08,
  gain = 0.025,
  delay = 0,
  filterType = "bandpass",
  frequency = 900,
  q = 1.8,
  masterVolume = 1
}) {
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const volume = ctx.createGain();
  const now = ctx.currentTime + delay;
  filter.type = filterType;
  filter.frequency.setValueAtTime(jitter(frequency, 0.08), now);
  filter.Q.setValueAtTime(q, now);
  volume.gain.setValueAtTime(clampGain(gain * masterVolume), now);
  volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(volume);
  volume.connect(ctx.destination);
  source.start(now);
}

function chord(ctx, notes, options = {}) {
  notes.forEach((frequency, index) => {
    tone(ctx, {
      ...options,
      frequency,
      delay: (options.delay ?? 0) + index * (options.spread ?? 0),
      gain: (options.gain ?? 0.02) * (options.falloff ? Math.max(0.55, 1 - index * 0.12) : 1)
    });
  });
}

function cardRustle(ctx, { delay = 0, masterVolume = 1, pitch = 1 } = {}) {
  noise(ctx, { duration: 0.055, gain: 0.075, delay, frequency: 1450, q: 2.6, masterVolume });
  noise(ctx, { duration: 0.05, gain: 0.05, delay: delay + 0.035, frequency: 2450, q: 3.4, masterVolume });
  tone(ctx, { frequency: 340, endFrequency: 430, duration: 0.07, gain: 0.045, delay: delay + 0.015, type: "triangle", pitch, masterVolume });
}

function paperFlip(ctx, { delay = 0, masterVolume = 1, pitch = 1 } = {}) {
  noise(ctx, { duration: 0.038, gain: 0.105, delay, frequency: 2600, q: 2.8, filterType: "bandpass", masterVolume });
  noise(ctx, { duration: 0.032, gain: 0.08, delay: delay + 0.038, frequency: 4200, q: 4.8, filterType: "highpass", masterVolume });
  tone(ctx, { frequency: 920, endFrequency: 1380, duration: 0.075, gain: 0.046, delay: delay + 0.018, type: "triangle", pitch, masterVolume });
}

function lowThump(ctx, { delay = 0, frequency = 120, gain = 0.14, duration = 0.13, masterVolume = 1, pitch = 1 } = {}) {
  tone(ctx, { frequency, endFrequency: Math.max(45, frequency * 0.48), duration, gain, delay, type: "triangle", pitch, masterVolume });
  noise(ctx, { duration: duration * 0.55, gain: gain * 0.32, delay: delay + 0.01, frequency: frequency * 2.2, q: 1.1, filterType: "lowpass", masterVolume });
}

function sparkle(ctx, notes, { delay = 0, gain = 0.045, masterVolume = 1, pitch = 1 } = {}) {
  notes.forEach((frequency, index) => {
    tone(ctx, {
      frequency,
      duration: 0.075,
      gain: gain * Math.max(0.58, 1 - index * 0.12),
      delay: delay + index * 0.042,
      type: "sine",
      pitch,
      filter: { frequency: 3400, q: 0.9 },
      masterVolume
    });
  });
}

export function unlockAudio() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
}

export function getSfxVolume() {
  return SFX_VOLUME_LEVELS[sfxVolumeLevel - 1] ?? 1;
}

export function getSfxVolumeLevel() {
  return sfxVolumeLevel;
}

export function setSfxVolumeLevel(level) {
  sfxVolumeLevel = clampSfxLevel(level);
  saveStoredSfxVolumeLevel(sfxVolumeLevel);
  return getSfxVolume();
}

export function playSoundEffect(effect, volume = 1) {
  const masterVolume = resolveVolume(volume) * SFX_VOLUME * getSfxVolume();
  if (masterVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const pitch = 1 + (Math.random() * 2 - 1) * 0.025;
  const patterns = {
    click: () => {
      noise(ctx, { duration: 0.018, gain: 0.11, frequency: 2600, q: 4.2, masterVolume });
      tone(ctx, { frequency: 1180, endFrequency: 720, duration: 0.038, gain: 0.1, pitch, filter: { frequency: 3200, q: 1.8 }, masterVolume });
      tone(ctx, { frequency: 255, duration: 0.055, gain: 0.055, delay: 0.006, pitch, type: "triangle", masterVolume });
    },
    select: () => {
      tone(ctx, { frequency: 250, endFrequency: 380, duration: 0.085, gain: 0.11, type: "triangle", pitch, masterVolume });
      tone(ctx, { frequency: 620, endFrequency: 760, duration: 0.075, gain: 0.07, delay: 0.035, pitch, type: "square", filter: { frequency: 2100, q: 1.2 }, masterVolume });
      sparkle(ctx, [880, 1175], { delay: 0.055, gain: 0.035, pitch, masterVolume });
    },
    draw: () => {
      cardRustle(ctx, { masterVolume, pitch });
      paperFlip(ctx, { delay: 0.018, masterVolume, pitch });
      noise(ctx, { duration: 0.032, gain: 0.08, delay: 0.045, frequency: 3200, q: 4.4, filterType: "highpass", masterVolume });
      tone(ctx, { frequency: 520, endFrequency: 760, duration: 0.11, gain: 0.082, delay: 0.04, type: "triangle", pitch, masterVolume });
      tone(ctx, { frequency: 1040, duration: 0.065, gain: 0.05, delay: 0.09, type: "sine", pitch, masterVolume });
    },
    playCard: () => {
      cardRustle(ctx, { masterVolume, pitch });
      lowThump(ctx, { delay: 0.045, frequency: 170, gain: 0.13, duration: 0.14, pitch, masterVolume });
      tone(ctx, { frequency: 520, duration: 0.055, gain: 0.075, delay: 0.095, pitch, type: "square", filter: { frequency: 1900, q: 1.3 }, masterVolume });
      tone(ctx, { frequency: 780, endFrequency: 620, duration: 0.08, gain: 0.045, delay: 0.125, pitch, type: "triangle", masterVolume });
    },
    mindbug: () => {
      noise(ctx, { duration: 0.22, gain: 0.12, frequency: 430, q: 1.5, masterVolume });
      tone(ctx, { frequency: 210, endFrequency: 72, duration: 0.34, gain: 0.16, type: "sawtooth", pitch, filter: { frequency: 950, q: 1.8 }, masterVolume });
      tone(ctx, { frequency: 74, endFrequency: 56, duration: 0.32, gain: 0.12, delay: 0.03, type: "triangle", masterVolume });
      chord(ctx, [466, 392, 311, 233], { duration: 0.16, gain: 0.065, delay: 0.08, spread: 0.038, type: "square", falloff: true, pitch, masterVolume });
      noise(ctx, { duration: 0.06, gain: 0.09, delay: 0.22, frequency: 1800, q: 3.8, masterVolume });
    },
    attack: () => {
      noise(ctx, { duration: 0.055, gain: 0.12, frequency: 1350, q: 2.8, masterVolume });
      tone(ctx, { frequency: 360, endFrequency: 150, duration: 0.16, gain: 0.13, type: "sawtooth", pitch, filter: { frequency: 1500, q: 1.3 }, masterVolume });
      tone(ctx, { frequency: 90, duration: 0.12, gain: 0.08, delay: 0.04, type: "triangle", masterVolume });
      noise(ctx, { duration: 0.05, gain: 0.07, delay: 0.115, frequency: 2100, q: 4, filterType: "highpass", masterVolume });
    },
    hit: () => {
      lowThump(ctx, { frequency: 104, gain: 0.22, duration: 0.16, masterVolume });
      lowThump(ctx, { delay: 0.045, frequency: 68, gain: 0.1, duration: 0.18, masterVolume });
      noise(ctx, { duration: 0.14, gain: 0.16, frequency: 330, q: 1.1, filterType: "lowpass", masterVolume });
      noise(ctx, { duration: 0.06, gain: 0.095, delay: 0.012, frequency: 1500, q: 3.2, filterType: "bandpass", masterVolume });
      tone(ctx, { frequency: 330, endFrequency: 135, duration: 0.13, gain: 0.105, delay: 0.018, type: "sawtooth", pitch, filter: { frequency: 1050, q: 1.4 }, masterVolume });
      tone(ctx, { frequency: 190, endFrequency: 145, duration: 0.09, gain: 0.065, delay: 0.07, type: "square", filter: { frequency: 720, q: 1.5 }, masterVolume });
    },
    directHit: () => {
      lowThump(ctx, { frequency: 72, gain: 0.28, duration: 0.22, masterVolume });
      lowThump(ctx, { delay: 0.038, frequency: 48, gain: 0.18, duration: 0.28, masterVolume });
      noise(ctx, { duration: 0.22, gain: 0.2, frequency: 230, q: 0.9, filterType: "lowpass", masterVolume });
      noise(ctx, { duration: 0.12, gain: 0.085, delay: 0.018, frequency: 920, q: 1.5, filterType: "bandpass", masterVolume });
      tone(ctx, { frequency: 300, endFrequency: 82, duration: 0.22, gain: 0.13, delay: 0.012, type: "sawtooth", pitch, filter: { frequency: 760, q: 1.4 }, masterVolume });
      tone(ctx, { frequency: 42, duration: 0.3, gain: 0.18, delay: 0.055, type: "triangle", masterVolume });
    },
    defeat: () => {
      noise(ctx, { duration: 0.08, gain: 0.15, frequency: 980, q: 2.4, masterVolume });
      tone(ctx, { frequency: 300, endFrequency: 92, duration: 0.28, gain: 0.16, type: "sawtooth", pitch, filter: { frequency: 1200, q: 1.2 }, masterVolume });
      lowThump(ctx, { delay: 0.075, frequency: 102, gain: 0.12, duration: 0.18, masterVolume });
      noise(ctx, { duration: 0.18, gain: 0.08, delay: 0.12, frequency: 520, q: 1.1, masterVolume });
    },
    lifeLoss: () => {
      tone(ctx, { frequency: 390, endFrequency: 145, duration: 0.2, gain: 0.13, type: "sawtooth", pitch, filter: { frequency: 1200, q: 1.4 }, masterVolume });
      lowThump(ctx, { delay: 0.035, frequency: 92, gain: 0.11, duration: 0.17, masterVolume });
      noise(ctx, { duration: 0.13, gain: 0.08, delay: 0.04, frequency: 500, q: 1.4, masterVolume });
    },
    lifeGain: () => {
      tone(ctx, { frequency: 330, endFrequency: 495, duration: 0.13, gain: 0.1, type: "triangle", pitch, masterVolume });
      sparkle(ctx, [660, 880, 1320], { delay: 0.045, gain: 0.048, pitch, masterVolume });
      noise(ctx, { duration: 0.055, gain: 0.035, delay: 0.075, frequency: 2500, q: 3.2, masterVolume });
    },
    ability: () => {
      chord(ctx, [247, 330, 494, 659], { duration: 0.1, gain: 0.062, spread: 0.026, type: "square", pitch, falloff: true, masterVolume });
      sparkle(ctx, [740, 988, 1480], { delay: 0.07, gain: 0.035, pitch, masterVolume });
      noise(ctx, { duration: 0.07, gain: 0.055, delay: 0.05, frequency: 1500, q: 2.4, masterVolume });
    },
    waterdrop: () => {
      tone(ctx, { frequency: 820, endFrequency: 430, duration: 0.13, gain: 0.07, type: "sine", pitch, filter: { frequency: 2600, q: 1.1 }, masterVolume });
      tone(ctx, { frequency: 1480, endFrequency: 980, duration: 0.08, gain: 0.045, delay: 0.018, type: "triangle", pitch, masterVolume });
      noise(ctx, { duration: 0.055, gain: 0.05, delay: 0.035, frequency: 2100, q: 5.4, filterType: "bandpass", masterVolume });
      tone(ctx, { frequency: 620, endFrequency: 780, duration: 0.09, gain: 0.04, delay: 0.22, type: "sine", pitch, masterVolume });
      noise(ctx, { duration: 0.075, gain: 0.035, delay: 0.26, frequency: 1300, q: 3.6, filterType: "bandpass", masterVolume });
      sparkle(ctx, [1175, 1568], { delay: 0.38, gain: 0.025, pitch, masterVolume });
    },
    evolve: () => {
      tone(ctx, { frequency: 128, endFrequency: 280, duration: 0.92, gain: 0.118, type: "triangle", pitch, filter: { frequency: 900, q: 1.1 }, masterVolume });
      tone(ctx, { frequency: 64, endFrequency: 98, duration: 1.02, gain: 0.095, delay: 0.04, type: "sine", masterVolume });
      noise(ctx, { duration: 1.06, gain: 0.058, delay: 0.02, frequency: 720, q: 1.2, filterType: "bandpass", masterVolume });
      chord(ctx, [330, 494, 659], { duration: 0.16, gain: 0.05, delay: 0.22, spread: 0.085, type: "triangle", falloff: true, pitch, masterVolume });
      sparkle(ctx, [880, 1175, 1568, 2093], { delay: 0.54, gain: 0.039, pitch, masterVolume });
      noise(ctx, { duration: 0.12, gain: 0.1, delay: 1.14, frequency: 2800, q: 4.6, filterType: "highpass", masterVolume });
      lowThump(ctx, { delay: 1.16, frequency: 118, gain: 0.135, duration: 0.2, pitch, masterVolume });
      chord(ctx, [523, 784, 1046], { duration: 0.18, gain: 0.048, delay: 1.2, spread: 0.034, type: "square", falloff: true, pitch, masterVolume });
    },
    turn: () => {
      tone(ctx, { frequency: 392, endFrequency: 523, duration: 0.105, gain: 0.09, type: "triangle", pitch, masterVolume });
      tone(ctx, { frequency: 523, endFrequency: 659, duration: 0.1, gain: 0.075, delay: 0.075, type: "triangle", pitch, masterVolume });
      tone(ctx, { frequency: 1046, duration: 0.07, gain: 0.045, delay: 0.145, type: "sine", pitch, masterVolume });
    },
    win: () => {
      chord(ctx, [392, 523, 659], { duration: 0.17, gain: 0.075, spread: 0.052, type: "triangle", pitch, masterVolume });
      chord(ctx, [523, 659, 784], { duration: 0.2, gain: 0.08, delay: 0.22, spread: 0.055, type: "triangle", pitch, masterVolume });
      sparkle(ctx, [1046, 1318, 1568], { delay: 0.46, gain: 0.05, masterVolume });
      lowThump(ctx, { delay: 0.18, frequency: 155, gain: 0.075, duration: 0.2, masterVolume });
    },
    lose: () => {
      noise(ctx, { duration: 0.2, gain: 0.085, frequency: 390, q: 1.2, masterVolume });
      tone(ctx, { frequency: 392, endFrequency: 247, duration: 0.36, gain: 0.105, type: "triangle", pitch, masterVolume });
      tone(ctx, { frequency: 196, endFrequency: 98, duration: 0.5, gain: 0.11, delay: 0.22, type: "sine", masterVolume });
      noise(ctx, { duration: 0.12, gain: 0.045, delay: 0.42, frequency: 260, q: 1, filterType: "lowpass", masterVolume });
    }
  };

  (patterns[effect] ?? patterns.click)();
}
