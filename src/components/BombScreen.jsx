import React, { useState, useEffect, useRef } from 'react';
import { subscribeToPath, writeData, pushData, readDataOnce } from '../firebase';
import { 
  playDefuseSound, 
  playExplosionSound, 
  playBuzzerSound, 
  playArmSound,
  playCsgoBeep,
  triggerVibration, 
  unlockAudio 
} from '../utils/audioSynth';
import { 
  Bomb, 
  ShieldAlert, 
  ShieldCheck, 
  Key, 
  HelpCircle, 
  AlertTriangle, 
  Volume2, 
  Sparkles, 
  Check, 
  X, 
  Delete,
  CornerDownLeft,
  Flame,
  Zap,
  Lightbulb,
  Maximize2,
  Minimize2
} from 'lucide-react';

export default function BombScreen() {
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');
  
  const [session, setSession] = useState(null);
  const [stage, setStage] = useState('join'); // 'join', 'armed', 'defused', 'detonated'
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Game Play transient state
  const [localTimerSec, setLocalTimerSec] = useState(0);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userTextAnswer, setUserTextAnswer] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);

  const clockIntervalRef = useRef(null);
  const finalBeepTimeoutRef = useRef(null);
  const deviceIdRef = useRef(null);
  const prevSessionStatusRef = useRef(null);
  const activeSessionIdRef = useRef(null);
  const playedOutcomeRef = useRef(null);

  if (!deviceIdRef.current) {
    if (typeof window === 'undefined') {
      deviceIdRef.current = 'device-unknown';
    } else {
      const storageKey = 'bomb_defusal_device_id';
      const existing = window.localStorage.getItem(storageKey);
      if (existing) {
        deviceIdRef.current = existing;
      } else {
        const freshId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        window.localStorage.setItem(storageKey, freshId);
        deviceIdRef.current = freshId;
      }
    }
  }

  // Helper to trigger Browser Fullscreen & Landscape Orientation Lock
  const triggerFullScreenLock = () => {
    try {
      const docEl = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          docEl.msRequestFullscreen();
        }
      }

      // Lock Screen Orientation to Landscape if supported
      if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
        window.screen.orientation.lock('landscape').catch(() => {});
      }
      setIsFullscreen(true);
    } catch (e) {
      console.warn("Fullscreen request error:", e);
    }
  };

  // Exit Fullscreen helper
  const exitFullScreen = () => {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      setIsFullscreen(false);
    } catch (e) {}
  };

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  useEffect(() => {
    if (stage === 'armed' && session?.status === 'active') {
      triggerFullScreenLock();
    }
  }, [stage, session?.status]);

  // Subscribe to Firebase session changes once joined
  useEffect(() => {
    const unsub = subscribeToPath('currentSession', (val) => {
      setSession(val);

      if (!val) {
        prevSessionStatusRef.current = null;
        activeSessionIdRef.current = null;
        playedOutcomeRef.current = null;
        setStage('join');
        setJoinError('');
        setJoinCodeInput('');
        setCurrentQIndex(0);
        setUserTextAnswer('');
        setEnteredPin('');
        setShowHint(false);
        setLocalTimerSec(0);
        return;
      }

      const currentStatus = val.status || null;
      const prevStatus = prevSessionStatusRef.current;
      prevSessionStatusRef.current = currentStatus;

      // A freshly generated round must never inherit the old round's join
      // code, progress, outcome, or one-time sound guard.
      if (val.id && val.id !== activeSessionIdRef.current) {
        activeSessionIdRef.current = val.id;
        playedOutcomeRef.current = null;
      }

      if (currentStatus === 'waiting_for_join' || currentStatus === 'pending') {
        playedOutcomeRef.current = null;
        setStage('join');
        setJoinError('');
        setJoinCodeInput('');
        setCurrentQIndex(0);
        setUserTextAnswer('');
        setEnteredPin('');
        setShowHint(false);
        setLocalTimerSec(val.timeRemainingSeconds ?? val.timerDurationSeconds ?? 0);
        return;
      }

      if (val.status === 'active') {
        if (val.joinedDeviceId && val.joinedDeviceId !== deviceIdRef.current) {
          setJoinError('This join code is already being used on another device.');
          setStage('join');
          return;
        }
        setJoinError('');
        setStage('armed');
        setLocalTimerSec(val.timeRemainingSeconds ?? val.timerDurationSeconds ?? 0);
        return;
      }

      if (val.status === 'defused') {
        if (finalBeepTimeoutRef.current) clearTimeout(finalBeepTimeoutRef.current);
        if (prevStatus !== 'defused' && playedOutcomeRef.current !== 'defused') {
          playDefuseSound();
          playedOutcomeRef.current = 'defused';
        }
        setStage('defused');
      } else if (val.status === 'detonated') {
        if (finalBeepTimeoutRef.current) clearTimeout(finalBeepTimeoutRef.current);
        if (prevStatus !== 'detonated' && playedOutcomeRef.current !== 'detonated') {
          playExplosionSound();
          playedOutcomeRef.current = 'detonated';
        }
        triggerVibration([500, 200, 500, 200, 800]);
        setStage('detonated');
      }
    });

    return () => unsub();
  }, []);

  // Handle joining game round
  const handleJoinGame = async (e) => {
    e?.preventDefault();
    unlockAudio();
    triggerFullScreenLock(); // Enter Fullscreen Lock on user tap

    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      setJoinError('Please enter Join Code!');
      return;
    }

    const current = await readDataOnce('currentSession');
    if (!current || !current.joinCode) {
      setJoinError('No active game session found on server. Ask Admin to generate join code.');
      return;
    }

    if (current.joinCode.toUpperCase() !== code) {
      setJoinError('Invalid Join Code! Check the admin screen.');
      return;
    }

    if (current.status === 'active' && current.joinedDeviceId && current.joinedDeviceId !== deviceIdRef.current) {
      setJoinError('This join code is already being used on another device.');
      return;
    }

    playArmSound();

    setLocalTimerSec(current.timerDurationSeconds);
    const updated = {
      ...current,
      status: 'active',
      startedAt: Date.now(),
      joinedDeviceId: deviceIdRef.current,
      joinedAt: Date.now()
    };

    await writeData('currentSession', updated);
    setStage('armed');
    setJoinError('');
  };

  // Live Countdown Timer Loop
  useEffect(() => {
    if (stage === 'armed' && session && session.status === 'active') {
      clockIntervalRef.current = setInterval(() => {
        setLocalTimerSec((prevSec) => {
          if (prevSec <= 1) {
            if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
            handleTriggerDetonation('Timer Expired');
            return 0;
          }

          const nextSec = prevSec - 1;
          writeData('currentSession/timeRemainingSeconds', nextSec);
          const duration = session?.timerDurationSeconds || 0;
          const progress = duration > 0 ? 1 - (nextSec / duration) : 0;
          const frequency = Math.round(740 + (progress * 700));
          const beepDuration = nextSec <= 5 ? 0.12 : 0.09;
          playCsgoBeep(frequency, beepDuration);

          if (finalBeepTimeoutRef.current) {
            clearTimeout(finalBeepTimeoutRef.current);
          }

          if (nextSec <= 10) {
            finalBeepTimeoutRef.current = setTimeout(() => {
              playCsgoBeep(Math.min(1600, frequency + 120), 0.08);
            }, 170);
          }

          return nextSec;
        });
      }, 1000);

    } else {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      if (finalBeepTimeoutRef.current) clearTimeout(finalBeepTimeoutRef.current);
    }

    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      if (finalBeepTimeoutRef.current) clearTimeout(finalBeepTimeoutRef.current);
    };
  }, [stage, session?.status]);

  // Trigger Detonation sequence
  const handleTriggerDetonation = async (reason = 'Wrong Attempt Exceeded') => {
    if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    if (finalBeepTimeoutRef.current) clearTimeout(finalBeepTimeoutRef.current);

    triggerVibration([500, 200, 500, 200, 800]);
    // Start the supplied recording while this action still has the mobile
    // browser's user-gesture audio permission. The subscription below handles
    // outcomes forced from the admin screen.
    if (playedOutcomeRef.current !== 'detonated') {
      playExplosionSound();
      playedOutcomeRef.current = 'detonated';
    }

    setStage('detonated');

    const timeTaken = session ? session.timerDurationSeconds - localTimerSec : 0;
    
    if (session) {
      const updated = {
        ...session,
        status: 'detonated',
        result: 'detonated',
        endedAt: Date.now()
      };
      await writeData('currentSession', updated);

      await pushData('leaderboard', {
        teamName: session.teamName,
        questionsSolved: session.progress?.questionsSolved || 0,
        totalQuestions: session.questions?.length || 0,
        attemptsUsed: session.progress?.attemptsUsed || 0,
        timeTakenSeconds: timeTaken,
        timerDurationSeconds: session.timerDurationSeconds,
        result: 'detonated',
        timestamp: Date.now()
      });
    }
  };

  // Trigger Defuse sequence
  const handleTriggerDefuse = async () => {
    if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    if (finalBeepTimeoutRef.current) clearTimeout(finalBeepTimeoutRef.current);

    if (playedOutcomeRef.current !== 'defused') {
      playDefuseSound();
      playedOutcomeRef.current = 'defused';
    }

    setStage('defused');

    const timeTaken = session ? session.timerDurationSeconds - localTimerSec : 0;

    if (session) {
      const updated = {
        ...session,
        status: 'defused',
        result: 'defused',
        endedAt: Date.now()
      };
      await writeData('currentSession', updated);

      await pushData('leaderboard', {
        teamName: session.teamName,
        questionsSolved: session.progress?.questionsSolved || 0,
        totalQuestions: session.questions?.length || 0,
        attemptsUsed: session.progress?.attemptsUsed || 0,
        timeTakenSeconds: timeTaken,
        timerDurationSeconds: session.timerDurationSeconds,
        result: 'defused',
        timestamp: Date.now()
      });
    }
  };

  // Record wrong attempt (Strike)
  const handleWrongAttempt = async () => {
    playBuzzerSound();
    triggerVibration([200, 100, 200]);

    setScreenFlash(true);
    setTimeout(() => setScreenFlash(false), 500);

    const currentProg = session?.progress || {};
    const newAttempts = (currentProg.attemptsUsed || 0) + 1;
    const max = session?.maxStrikes || 0;

    // This final wrong answer is a user action. Start the supplied explosion
    // immediately, before the asynchronous progress write finishes.
    if (max > 0 && newAttempts >= max && playedOutcomeRef.current !== 'detonated') {
      playExplosionSound();
      playedOutcomeRef.current = 'detonated';
    }

    const updatedProgress = {
      questionsSolved: currentProg.questionsSolved || 0,
      currentQuestionIndex: currentProg.currentQuestionIndex || currentQIndex,
      attemptsUsed: newAttempts
    };

    await writeData('currentSession/progress', updatedProgress);

    if (max > 0 && newAttempts >= max) {
      handleTriggerDetonation('Max Strikes Exceeded');
    }
  };

  // Handle MCQ Answer Submission
  const handleSelectMcqOption = async (optionText) => {
    unlockAudio();
    triggerFullScreenLock();
    const currentQ = session.questions[currentQIndex];
    if (optionText === currentQ.correctAnswer) {
      const currentProg = session?.progress || {};
      const nextSolved = (currentProg.questionsSolved || 0) + 1;
      const nextIndex = currentQIndex + 1;

      const updatedProgress = {
        questionsSolved: nextSolved,
        currentQuestionIndex: nextIndex,
        attemptsUsed: currentProg.attemptsUsed || 0
      };

      // The last correct answer is a trusted tap. Play now instead of after
      // awaiting Firebase/local-storage work, which mobile browsers may block.
      if (nextIndex >= session.questions.length && !session.diffuseMode?.pin) {
        playDefuseSound();
        playedOutcomeRef.current = 'defused';
      }

      await writeData('currentSession/progress', updatedProgress);

      if (nextIndex >= session.questions.length) {
        if (session.diffuseMode?.pin) {
          setCurrentQIndex(nextIndex);
        } else {
          handleTriggerDefuse();
        }
      } else {
        setCurrentQIndex(nextIndex);
      }
    } else {
      handleWrongAttempt();
    }
  };

  // Handle Text Question Submission
  const handleSubmitTextAnswer = async (e) => {
    e?.preventDefault();
    unlockAudio();
    triggerFullScreenLock();

    const currentQ = session.questions[currentQIndex];
    const userVal = userTextAnswer.trim().toLowerCase();
    const targetVal = currentQ.correctAnswer.trim().toLowerCase();

    if (userVal === targetVal) {
      setUserTextAnswer('');
      const currentProg = session?.progress || {};
      const nextSolved = (currentProg.questionsSolved || 0) + 1;
      const nextIndex = currentQIndex + 1;

      const updatedProgress = {
        questionsSolved: nextSolved,
        currentQuestionIndex: nextIndex,
        attemptsUsed: currentProg.attemptsUsed || 0
      };

      if (nextIndex >= session.questions.length && !session.diffuseMode?.pin) {
        playDefuseSound();
        playedOutcomeRef.current = 'defused';
      }

      await writeData('currentSession/progress', updatedProgress);

      if (nextIndex >= session.questions.length) {
        if (session.diffuseMode?.pin) {
          setCurrentQIndex(nextIndex);
        } else {
          handleTriggerDefuse();
        }
      } else {
        setCurrentQIndex(nextIndex);
      }
    } else {
      setUserTextAnswer('');
      handleWrongAttempt();
    }
  };

  // Keypad PIN Handlers
  const handleKeypadPress = (num) => {
    unlockAudio();
    triggerFullScreenLock();
    if (enteredPin.length < 8) {
      setEnteredPin(prev => prev + num);
    }
  };

  const handleKeypadClear = () => {
    unlockAudio();
    setEnteredPin('');
  };

  const handleKeypadSubmit = () => {
    unlockAudio();
    triggerFullScreenLock();
    if (!enteredPin) return;

    if (enteredPin === session?.pin?.code) {
      // PIN submission is a direct user gesture, so begin its real recording
      // here rather than after any asynchronous state update.
      if (playedOutcomeRef.current !== 'defused') {
        playDefuseSound();
        playedOutcomeRef.current = 'defused';
      }
      handleTriggerDefuse();
    } else {
      setEnteredPin('');
      handleWrongAttempt();
    }
  };

  const formatTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Determine active stage on bomb device
  const hasQuestions = session?.diffuseMode?.questions && session?.questions?.length > 0;
  const questionsCompleted = hasQuestions ? currentQIndex >= session.questions.length : true;
  const isQuestionStageActive = hasQuestions && !questionsCompleted;
  const isPinStageActive = session?.diffuseMode?.pin && questionsCompleted;

  return (
    <div className={`mobile-bomb-container landscape-mode ${screenFlash ? 'flash-red' : ''}`}>
      {/* High-Contrast Hazard Border Header with Fullscreen Toggle */}
      <div className="hazard-bartop-landscape flex-between-header">
        <div className="flex-gap-xs">
          <Zap size={14} className="inline-icon text-gold" />
          <span className="hazard-title-text">⚡ DANGER // BOMB DEFUSAL TERMINAL ⚡</span>
        </div>

        {stage === 'armed' ? (
          <div className="btn-fs-toggle fs-lock-indicator" aria-live="polite">
            <ShieldAlert size={13} />
            <span>FULLSCREEN LOCKED</span>
          </div>
        ) : (
          <button 
            type="button" 
            className="btn-fs-toggle"
            onClick={isFullscreen ? exitFullScreen : triggerFullScreenLock}
            title={isFullscreen ? "Exit Fullscreen" : "Lock Screen to Fullscreen"}
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={13} /> <span>EXIT FS</span>
              </>
            ) : (
              <>
                <Maximize2 size={13} /> <span>FULLSCREEN LOCK ⛶</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 1. HORIZONTAL LANDSCAPE JOIN SCREEN */}
      {stage === 'join' && (
        <div className="bomb-join-screen-landscape">
          <div className="join-left-panel">
            <div className="bomb-icon-glow">
              <Bomb size={64} className="text-red-light" />
            </div>
            <h1 className="bomb-title-visible">BOMB DEFUSAL TERMINAL</h1>
            <p className="bomb-subtitle-visible">TECH FEST COMPETITION PROP TERMINAL</p>
          </div>

          <div className="join-right-panel">
            <form onSubmit={handleJoinGame} className="join-form-landscape">
              <label className="form-input-label">ENTER 5-DIGIT JOIN CODE:</label>
              <input 
                type="text"
                maxLength={6}
                className="join-input-landscape mono-font"
                placeholder="XXXXX"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                autoFocus
              />

              {joinError && <div className="join-error">{joinError}</div>}

              <button type="submit" className="btn-arm-connect-landscape">
                <Flame size={20} /> CONNECT & ARM DEVICE ⛶
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. HORIZONTAL LANDSCAPE ARMED BOMB SCREEN */}
      {stage === 'armed' && session && (
        <div className="bomb-armed-landscape-grid">
          {/* LEFT SIDEBAR: LED Countdown Timer & Telemetry */}
          <div className="landscape-left-sidebar">
            <div className="team-badge-landscape">
              <span className="badge-lbl">TEAM:</span>
              <span className="badge-val">{session.teamName}</span>
            </div>

            {/* Glowing Digital LED Countdown Timer */}
            <div className="led-timer-landscape">
              <div className="led-header-lbl">COUNTDOWN TIMER</div>
              <div className={`led-digits-landscape ${localTimerSec <= 30 ? 'critical' : ''}`}>
                {formatTime(localTimerSec)}
              </div>
            </div>

            {/* Strikes Counter */}
            <div className="strikes-card-landscape">
              <span className="strikes-title">WRONG ATTEMPTS / STRIKES:</span>
              <div className="strikes-display">
                <span className="strikes-num text-red">{session.progress?.attemptsUsed || 0}</span>
                <span className="strikes-max text-muted">
                  {session.maxStrikes > 0 ? ` / ${session.maxStrikes}` : ' (UNLIMITED)'}
                </span>
              </div>
            </div>

            {/* Stage Indicator Badge */}
            <div className="stage-tag-landscape">
              {isQuestionStageActive && `STAGE 1: QUESTION ${currentQIndex + 1}/${session.questions.length}`}
              {isPinStageActive && `FINAL STAGE: PIN KEYPAD`}
            </div>
          </div>

          {/* RIGHT MAIN PANEL: Questions Grid OR PIN Keypad */}
          <div className="landscape-right-panel">
            {/* STAGE A: QUESTIONS STAGE */}
            {isQuestionStageActive && (
              <div className="landscape-question-card">
                <div className="q-header-high-visibility">
                  <HelpCircle size={20} className="text-cyan" /> 
                  <span className="q-header-text">QUESTION {currentQIndex + 1} OF {session.questions.length}</span>
                </div>

                <div className="q-prompt-high-visibility">
                  {session.questions[currentQIndex].question}
                </div>

                {/* MCQ Options 2x2 Landscape Grid */}
                {session.questions[currentQIndex].type === 'mcq' ? (
                  <div className="mcq-grid-landscape">
                    {session.questions[currentQIndex].options.map((opt, i) => (
                      <button 
                        key={i} 
                        className="mcq-btn-landscape"
                        onClick={() => handleSelectMcqOption(opt)}
                      >
                        <span className="opt-badge">{String.fromCharCode(65 + i)}</span>
                        <span className="opt-label">{opt}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  /* Text Answer Form */
                  <form onSubmit={handleSubmitTextAnswer} className="text-answer-form-landscape">
                    <input 
                      type="text"
                      className="text-input-landscape"
                      placeholder="Type your answer..."
                      value={userTextAnswer}
                      onChange={(e) => setUserTextAnswer(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" className="btn-submit-landscape">
                      SUBMIT ANSWER
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* STAGE B: PIN KEYPAD STAGE */}
            {isPinStageActive && (
              <div className="landscape-pin-card">
                {/* High Visibility Header with Integrated Hint Button */}
                <div className="pin-header-high-visibility">
                  <div className="pin-title-group">
                    <Key size={18} className="text-orange" />
                    <span>ENTER DEFUSAL PIN CODE</span>
                  </div>

                  {session.pin?.hint && (
                    <button 
                      type="button" 
                      className="btn-hint-inline"
                      onClick={() => setShowHint(!showHint)}
                    >
                      <Lightbulb size={14} />
                      {showHint ? 'HIDE HINT' : 'SHOW HINT'}
                    </button>
                  )}
                </div>

                {/* Expanded High-Visibility Hint Banner */}
                {showHint && session.pin?.hint && (
                  <div className="hint-banner-landscape">
                    <span className="hint-tag">💡 PIN HINT:</span> {session.pin.hint}
                  </div>
                )}

                {/* Code Display Box */}
                <div className="pin-display-landscape mono-font">
                  {enteredPin ? enteredPin : <span className="pin-dots">_ _ _ _</span>}
                </div>

                {/* 3x4 Compact Keypad Grid */}
                <div className="keypad-grid-landscape">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button key={n} type="button" className="keypad-btn-landscape" onClick={() => handleKeypadPress(n.toString())}>
                      {n}
                    </button>
                  ))}
                  <button type="button" className="keypad-btn-landscape btn-clear-l" onClick={handleKeypadClear}>
                    CLR
                  </button>
                  <button type="button" className="keypad-btn-landscape" onClick={() => handleKeypadPress('0')}>
                    0
                  </button>
                  <button type="button" className="keypad-btn-landscape btn-enter-l" onClick={handleKeypadSubmit}>
                    ENT
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. DEFUSED SUCCESS SCREEN */}
      {stage === 'defused' && (
        <div className="bomb-end-screen-landscape defused-bg">
          <div className="end-icon-pulse success">
            <ShieldCheck size={72} />
          </div>
          <h1 className="end-title-visible green">BOMB DEFUSED!</h1>
          <p className="end-subtitle-visible">EXCELLENT JOB TEAM {session?.teamName}!</p>

          <div className="stats-box-landscape">
            <div className="stat-pill">
              <span className="lbl">TIME REMAINING:</span>
              <span className="val green mono-font">{formatTime(localTimerSec)}</span>
            </div>
            <div className="stat-pill">
              <span className="lbl">STRIKES USED:</span>
              <span className="val">{session?.progress?.attemptsUsed || 0}</span>
            </div>
            <div className="stat-pill">
              <span className="lbl">QUESTIONS SOLVED:</span>
              <span className="val">{session?.progress?.questionsSolved || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. DETONATED FAIL SCREEN */}
      {stage === 'detonated' && (
        <div className="bomb-end-screen-landscape detonated-bg">
          <div className="end-icon-pulse danger">
            <AlertTriangle size={72} />
          </div>
          <h1 className="end-title-visible red">BOOM! BOMB DETONATED</h1>
          <p className="end-subtitle-visible">MISSION FAILED // SYSTEM CRITICAL</p>

          <div className="stats-box-landscape">
            <div className="stat-pill">
              <span className="lbl">TEAM:</span>
              <span className="val red">{session?.teamName}</span>
            </div>
            <div className="stat-pill">
              <span className="lbl">STRIKES:</span>
              <span className="val red">{session?.progress?.attemptsUsed || 0}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
