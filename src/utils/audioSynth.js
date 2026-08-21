// Audio Manager for Real MP3 Audio Files with Mobile Autoplay Unlocking

let sounds = null;
let audioContext = null;
const playbackVersions = new WeakMap();

function beginAudioOperation(audio) {
  const version = (playbackVersions.get(audio) || 0) + 1;
  playbackVersions.set(audio, version);
  return version;
}

// These files are the supplied CS:GO explosion and defuse recordings.  Keep
// one preloaded element per sound: a previously unlocked element can be played
// later when a Firebase/BroadcastChannel event arrives (which is not a user
// gesture on mobile browsers).

function initSounds() {
  if (typeof window !== 'undefined' && !sounds) {
    sounds = {
      arm: new Audio('/audio/arm.mp3'),
      explosion: new Audio('/audio/explosion.mp3'),
      defuse: new Audio('/audio/defuse.mp3')
    };
    
    Object.values(sounds).forEach(audio => {
      audio.preload = 'auto';
    });
  }
  return sounds;
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

async function resumeAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (err) {
      console.warn('Audio context resume failed:', err);
    }
  }
  return ctx;
}

function playTone({ frequency, duration, wave = 'square', gainLevel = 0.15, rampDown = true }) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(gainLevel, ctx.currentTime + 0.01);
    if (rampDown) {
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    } else {
      gain.gain.setValueAtTime(gainLevel, ctx.currentTime + duration);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.03);
  } catch (err) {
    console.warn('Synth tone failed:', err);
  }
}

function playToneSequence(steps) {
  steps.forEach((step) => {
    window.setTimeout(() => {
      playTone(step);
    }, step.delay || 0);
  });
}

/**
 * Prime and unlock future background audio elements (explosion & defuse) on user tap
 */
export function unlockAudio() {
  const s = initSounds();
  if (s) {
    // Prime every recorded event during a real tap. Later timer/database
    // callbacks are not browser user gestures.
    Object.values(s).forEach(audio => {
      if (audio) {
        try {
          const version = beginAudioOperation(audio);
          const p = audio.play();
          if (p !== undefined) {
            p.then(() => {
              // Never stop a real event that began while warm-up was loading.
              if (playbackVersions.get(audio) === version) {
                audio.pause();
                audio.currentTime = 0;
              }
            }).catch(() => {});
          }
        } catch (e) {}
      }
    });
  }
  resumeAudioContext();
}

function playRecordedSound(sound, label) {
  const s = initSounds();
  const audio = s?.[sound];
  if (!audio) return;

  try {
    beginAudioOperation(audio);
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1.0;
    const playAttempt = audio.play();
    if (playAttempt !== undefined) {
      playAttempt.catch((err) => {
        // This normally means that the player has not tapped the bomb screen
        // yet.  The join/keypad controls call unlockAudio before the round.
        console.warn(`${label} audio play error:`, err);
      });
    }
  } catch (err) {
    console.warn(`${label} audio error:`, err);
  }
}

/**
 * Play CS:GO "The Bomb Has Been Planted" Arming Sound
 */
export function playArmSound() {
  playRecordedSound('arm', 'Arm');
}

/**
 * Play CS:GO "Bomb Has Been Defused" Sound
 */
export function playDefuseSound() {
  playRecordedSound('defuse', 'Defuse');
}

/**
 * Play CS:GO Bomb Explosion Sound
 */
export function playExplosionSound() {
  playRecordedSound('explosion', 'Explosion');
}

/**
 * Short synthesized timer beep.
 * Uses Web Audio so it works without shipping a beep file.
 */
export function playCsgoBeep(frequency = 880, duration = 0.08) {
  try {
    playTone({
      frequency,
      duration,
      wave: 'square',
      gainLevel: 0.2,
      rampDown: true
    });
  } catch (err) {
    console.warn('Timer beep failed:', err);
  }
}

/**
 * Play Error / Strike Buzzer Sound
 */
export function playBuzzerSound() {
  playTone({ frequency: 150, duration: 0.25, wave: 'sawtooth', gainLevel: 0.35 });
}

/**
 * Trigger Mobile Device Vibration
 */
export function triggerVibration(pattern = [500, 200, 500, 200, 800]) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (err) {
      console.warn('Vibration API error:', err);
    }
  }
}
