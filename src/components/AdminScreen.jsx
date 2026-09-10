import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { subscribeToPath, writeData, pushData, readDataOnce, isFirebaseConfigured } from '../firebase';
import { importQuestionsCsv, importTeamsCsv } from '../utils/csvImport';
import { 
  Bomb, 
  Trophy, 
  Play, 
  RotateCcw, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  HelpCircle, 
  Key, 
  Layers, 
  ShieldAlert,
  Flame,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Volume2,
  Pause,
  Tv,
  Eye,
  EyeOff,
  Lightbulb
} from 'lucide-react';

const SAMPLE_QUESTIONS = [
  {
    id: 'sample_q1',
    type: 'mcq',
    question: 'Which protocol is used for real-time web socket communication in modern apps?',
    options: ['WSS (WebSocket Secure)', 'FTP', 'SMTP', 'POP3'],
    correctAnswer: 'WSS (WebSocket Secure)'
  },
  {
    id: 'sample_q2',
    type: 'text',
    question: 'What is the default port for HTTP traffic?',
    correctAnswer: '80'
  },
  {
    id: 'sample_q3',
    type: 'mcq',
    question: 'In CS:GO / Counter-Strike, what is the default bomb defusal code?',
    options: ['7355608', '1337420', '8675309', '0000000'],
    correctAnswer: '7355608'
  }
];

const CELEBRATION_PARTICLES = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 7) * 0.18}s`,
  duration: `${2.8 + (index % 5) * 0.35}s`,
  color: ['#00f0ff', '#ffb700', '#ff2e4c', '#00ff66'][index % 4]
}));

export default function AdminScreen({ view = 'setup' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [winners, setWinners] = useState([]);
  const [winnerDisplay, setWinnerDisplay] = useState(false);
  const [teams, setTeams] = useState([]);
  const [importError, setImportError] = useState('');
  
  // Setup Form State
  const [teamName, setTeamName] = useState('');
  const [manualTeamName, setManualTeamName] = useState('');
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(0);
  
  const [pinEnabled, setPinEnabled] = useState(true);
  const [questionsEnabled, setQuestionsEnabled] = useState(true);
  const [modeOrder, setModeOrder] = useState('questions_then_pin'); // 'questions_then_pin' or 'pin_then_questions'
  const [maxStrikes, setMaxStrikes] = useState(3);
  
  const [pinCode, setPinCode] = useState('7355');
  const [pinHint, setPinHint] = useState('Year of the first microprocessor (Intel 4004)');

  const [questions, setQuestions] = useState([]);

  const handleCsvImport = (event, importer, onSuccess) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        onSuccess(importer(String(reader.result || '')));
        setImportError('');
      } catch (error) {
        setImportError(error.message);
      }
      event.target.value = '';
    };
    reader.onerror = () => {
      setImportError(`Could not read ${file.name}.`);
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleTeamsImport = (event) => {
    handleCsvImport(event, importTeamsCsv, (importedTeams) => {
      setTeams((currentTeams) => [...new Set([...currentTeams, ...importedTeams])]);
      setTeamName((currentTeam) => currentTeam || importedTeams[0]);
    });
  };

  const handleQuestionsImport = (event) => {
    handleCsvImport(event, importQuestionsCsv, setQuestions);
  };

  const handleLoadSampleQuestions = () => {
    setQuestions(SAMPLE_QUESTIONS.map((question) => ({ ...question })));
    setImportError('');
  };

  // Live Dashboard Security State
  const [showAdminPin, setShowAdminPin] = useState(false);

  // Tab State
  const activeTab = view;
  const showWinnersOnDashboard = activeTab === 'dashboard' && (
    new URLSearchParams(location.search).get('view') === 'winners' || winnerDisplay
  );

  // Subscribe to currentSession and leaderboard from Firebase
  useEffect(() => {
    const unsubSession = subscribeToPath('currentSession', (val) => {
      setSession(val);
    });

    const unsubLeaderboard = subscribeToPath('leaderboard', (val) => {
      if (!val) {
        setLeaderboard([]);
        return;
      }
      const list = Array.isArray(val) ? val : Object.values(val);
      list.sort((a, b) => {
        if (a.result === 'defused' && b.result !== 'defused') return -1;
        if (a.result !== 'defused' && b.result === 'defused') return 1;
        if (a.timeTakenSeconds !== b.timeTakenSeconds) {
          const bothDetonated = a.result === 'detonated' && b.result === 'detonated';
          return bothDetonated
            ? b.timeTakenSeconds - a.timeTakenSeconds
            : a.timeTakenSeconds - b.timeTakenSeconds;
        }
        return a.attemptsUsed - b.attemptsUsed;
      });
      setLeaderboard(list);
    });

    const unsubWinners = subscribeToPath('winners', (val) => {
      if (!val) {
        setWinners([]);
        return;
      }
      setWinners(Array.isArray(val) ? val : Object.values(val));
    });

    const unsubWinnerDisplay = subscribeToPath('winnerDisplay', (val) => {
      setWinnerDisplay(Boolean(val));
    });

    return () => {
      unsubSession();
      unsubLeaderboard();
      unsubWinners();
      unsubWinnerDisplay();
    };
  }, []);

  const handleRemoveQuestion = (id) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleRemoveTeam = (teamToRemove) => {
    setTeams((currentTeams) => currentTeams.filter((team) => team !== teamToRemove));
    setTeamName((currentTeam) => currentTeam === teamToRemove ? '' : currentTeam);
  };

  const handleMoveQuestion = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const list = [...questions];
    const temp = list[index];
    list[index] = list[target];
    list[target] = temp;
    setQuestions(list);
  };

  const handleGenerateJoinCode = async () => {
    const selectedTeamName = teamName.trim() || manualTeamName.trim();
    if (!selectedTeamName) {
      alert('Please select an imported team or enter a team name manually!');
      return;
    }
    if (!pinEnabled && !questionsEnabled) {
      alert('Please select at least one Defuse Mode (PIN or Questions)!');
      return;
    }
    if (pinEnabled && !pinCode.trim()) {
      alert('Please enter a valid numeric PIN code!');
      return;
    }
    if (questionsEnabled && questions.length === 0) {
      alert('Please add at least one question for Questions Mode!');
      return;
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const durationSec = (parseInt(timerMinutes) || 0) * 60 + (parseInt(timerSeconds) || 0);

    const newSession = {
      // A unique id lets clients distinguish this round from every previous
      // one, even if an old database update reaches them late.
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      joinCode: code,
      status: 'waiting_for_join',
      teamName: selectedTeamName,
      timerDurationSeconds: durationSec,
      timeRemainingSeconds: durationSec,
      diffuseMode: {
        pin: pinEnabled,
        questions: questionsEnabled
      },
      modeOrder,
      maxStrikes: parseInt(maxStrikes) || 0,
      pin: {
        code: pinCode.trim(),
        hint: pinHint.trim()
      },
      questions: questionsEnabled ? questions : [],
      progress: {
        questionsSolved: 0,
        attemptsUsed: 0,
        currentQuestionIndex: 0
      },
      result: 'pending',
      createdAt: Date.now()
    };

    await writeData('currentSession', newSession);
    await writeData('winnerDisplay', false);
    setShowAdminPin(false);
  };

  const handleForceDefuse = async () => {
    if (!session) {
      alert('Configure a round before forcing defuse.');
      return;
    }
    const timeTaken = session.timerDurationSeconds - session.timeRemainingSeconds;
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
  };

  const handleForceDetonate = async () => {
    if (!session) {
      alert('Configure a round before forcing detonation.');
      return;
    }
    const timeTaken = session.timerDurationSeconds - session.timeRemainingSeconds;
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
  };

  const handleResetSession = async () => {
    if (!session || window.confirm('Reset current session? This will allow creating a new round.')) {
      await writeData('currentSession', null);
      navigate('/admin');
    }
  };

  const handlePauseRound = async () => {
    if (!session) {
      alert('Configure a round before pausing it.');
      return;
    }

    await writeData('currentSession', {
      ...session,
      status: session.status === 'paused' ? 'active' : 'paused'
    });
  };

  const handleClearLeaderboard = async () => {
    if (window.confirm('Are you sure you want to CLEAR the entire leaderboard history?')) {
      await writeData('leaderboard', []);
    }
  };

  const handleDeclareWinners = async () => {
    if (leaderboard.length < 3) {
      alert('At least three completed team results are required to declare winners.');
      return;
    }

    if (!window.confirm('Declare the current top three teams as the event winners?')) return;

    const declaredAt = Date.now();
    const updatedLeaderboard = leaderboard.map((row, index) => ({
      ...row,
      winnerRank: index < 3 ? index + 1 : null,
      winnersDeclaredAt: index < 3 ? declaredAt : null
    }));

    await writeData('winners', updatedLeaderboard.slice(0, 3));
    await writeData('winnerDisplay', true);
    await writeData('leaderboard', []);
    await writeData('currentSession', null);
    setTeamName('');
    setManualTeamName('');
    alert('Winners declared. The complete game has been reset for a fresh round.');
    navigate('/admin');
  };

  const formatTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatQuestionScore = (row) => (
    row.totalQuestions > 0 ? `${row.questionsSolved || 0} / ${row.totalQuestions}` : 'PIN ONLY'
  );

  const currentQuestionIndex = session?.progress?.currentQuestionIndex || 0;
  const currentQuestion = session?.questions?.[currentQuestionIndex];
  const isPinChallengeActive = Boolean(
    session?.diffuseMode?.pin &&
    (!session?.diffuseMode?.questions || currentQuestionIndex >= (session?.questions?.length || 0))
  );

  return (
    <div className="admin-container">
      {/* Header Bar */}
      <header className="admin-header">
        <div className="admin-logo">
          <Bomb className="logo-icon text-red" size={32} />
          <div>
            <h1>OVERCLOCKED</h1>
            <p className="subtitle">CONTROL ROOM & PROJECTOR COMMAND CENTER</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        {activeTab !== 'dashboard' && <nav className="admin-nav">
          <Link to="/admin" className={`nav-btn ${activeTab === 'setup' ? 'active' : ''}`}>
            <Play size={18} /> Setup Round
          </Link>
          <Link to="/admin/dashboard" target="_blank" rel="noopener noreferrer" className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}>
            <Tv size={18} /> Live Dashboard
            {session && session.status === 'active' && (
              <span className="live-pulse">ARMED</span>
            )}
          </Link>
          <Link to="/admin/leaderboard" className={`nav-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}>
            <Trophy size={18} /> Leaderboard ({leaderboard.length})
          </Link>
          <Link to="/admin/winners" className={`nav-btn ${activeTab === 'winners' ? 'active' : ''}`}>
            <Trophy size={18} /> Winners
          </Link>
        </nav>}
      </header>

      {!isFirebaseConfigured && (
        <div className="alert-banner warning">
          <AlertTriangle size={20} />
          <div>
            <strong>Firebase Not Connected (Local Fallback Active):</strong> Running in local browser sync mode. To sync across different physical mobile phones over Wi-Fi, add your Firebase keys in <code>.env.local</code>.
          </div>
        </div>
      )}

      {/* TAB 1: SETUP PANEL */}
      {activeTab === 'setup' && (
        <div className="setup-panel-grid">
          {/* Main Setup Config */}
          <div className="glass-card setup-card">
            <h2 className="card-title">
              <Layers size={22} className="text-orange" /> Round Configuration
            </h2>

            <div className="form-group">
              <label>Imported Team</label>
              <select
                className="input-field"
                value={teamName}
                onChange={(e) => {
                  setTeamName(e.target.value);
                  setManualTeamName('');
                }}
                disabled={teams.length === 0}
              >
                <option value="">{teams.length ? 'Select a team' : 'Import teams to begin'}</option>
                {teams.map((team) => <option key={team} value={team}>{team}</option>)}
              </select>
              <label className="manual-team-label" htmlFor="manual-team-name">Or enter a team manually</label>
              <input
                id="manual-team-name"
                type="text"
                className="input-field"
                placeholder="e.g. Cyber Squad 404"
                value={manualTeamName}
                onChange={(e) => {
                  setManualTeamName(e.target.value);
                  setTeamName('');
                }}
              />
              <label className="file-input-label">
                Import teams CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleTeamsImport}
                />
              </label>
              <div className="team-bank-list">
                {teams.length === 0 ? (
                  <div className="empty-state">No teams imported yet.</div>
                ) : (
                  teams.map((team) => (
                    <div key={team} className="team-bank-item">
                      <span>{team}</span>
                      <button
                        type="button"
                        className="icon-btn text-red"
                        onClick={() => handleRemoveTeam(team)}
                        title={`Delete ${team}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {importError && <div className="import-error" role="alert">{importError}</div>}

            <div className="form-row">
              <div className="form-group half">
                <label>Timer Duration (Minutes)</label>
                <input 
                  type="number" 
                  min="0" 
                  max="59"
                  className="input-field" 
                  value={timerMinutes}
                  onChange={(e) => setTimerMinutes(e.target.value)}
                />
              </div>
              <div className="form-group half">
                <label>Timer Duration (Seconds)</label>
                <input 
                  type="number" 
                  min="0" 
                  max="59"
                  className="input-field" 
                  value={timerSeconds}
                  onChange={(e) => setTimerSeconds(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Max Wrong Attempts (Strikes) Allowed</label>
              <select 
                className="input-field"
                value={maxStrikes}
                onChange={(e) => setMaxStrikes(e.target.value)}
              >
                <option value={1}>1 Strike (Hardcore - Immediate detonation on 1 wrong)</option>
                <option value={2}>2 Strikes</option>
                <option value={3}>3 Strikes (Standard)</option>
                <option value={5}>5 Strikes (Forgiving)</option>
                <option value={0}>Unlimited Strikes (Timer limit only)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Defuse Modes Active</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={questionsEnabled} 
                    onChange={(e) => setQuestionsEnabled(e.target.checked)}
                  />
                  <span>Questions Mode</span>
                </label>
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={pinEnabled} 
                    onChange={(e) => setPinEnabled(e.target.checked)}
                  />
                  <span>PIN Keypad Mode</span>
                </label>
              </div>
            </div>

            {questionsEnabled && pinEnabled && (
              <div className="form-group">
                <label>Stage Sequence Order</label>
                <select 
                  className="input-field"
                  value={modeOrder}
                  onChange={(e) => setModeOrder(e.target.value)}
                >
                  <option value="questions_then_pin">1st Questions → 2nd Final PIN Entry (Recommended)</option>
                  <option value="pin_then_questions">1st Keypad PIN → 2nd Questions</option>
                </select>
              </div>
            )}

            {/* PIN Settings */}
            {pinEnabled && (
              <div className="sub-panel border-orange">
                <h3 className="sub-title"><Key size={18} /> PIN Configuration</h3>
                <div className="form-group">
                  <label>Numeric PIN Code</label>
                  <input 
                    type="text" 
                    className="input-field mono-font" 
                    placeholder="e.g. 7355608"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>
                <div className="form-group">
                  <label>PIN Hint Text (Displayed on Mobile screen)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Standard CS:GO defusal code"
                    value={pinHint}
                    onChange={(e) => setPinHint(e.target.value)}
                  />
                </div>
              </div>
            )}

            <button 
              className="btn btn-danger btn-lg width-full margin-top-md"
              onClick={handleGenerateJoinCode}
            >
              <Flame size={24} /> GENERATE JOIN CODE & ARM BOMB
            </button>
            <button
              className="btn btn-outline-gold width-full margin-top-sm"
              onClick={handleDeclareWinners}
              disabled={leaderboard.length < 3}
            >
              <Trophy size={18} /> DECLARE TOP 3 TEAMS AS WINNERS
            </button>
            <button
              className="btn btn-outline-cyan width-full margin-top-sm"
              onClick={() => navigate('/admin/dashboard?view=winners')}
            >
              <Trophy size={18} /> VIEW WINNERS ON DASHBOARD
            </button>

            <div className="sub-panel border-cyan margin-top-md">
              <h3 className="sub-title"><ShieldAlert size={18} /> Admin Host Controls</h3>
              <div className="flex-gap margin-top-xs">
                <button className="btn btn-sm btn-secondary" onClick={handlePauseRound}>
                  <Pause size={16} /> {session?.status === 'paused' ? 'Resume Round' : 'Pause Round'}
                </button>
                <button className="btn btn-sm btn-outline-green" onClick={handleForceDefuse}>
                  <CheckCircle2 size={16} /> Force Defuse
                </button>
                <button className="btn btn-sm btn-outline-red" onClick={handleForceDetonate}>
                  <XCircle size={16} /> Force Detonate
                </button>
                <button className="btn btn-sm btn-secondary" onClick={handleResetSession}>
                  <RotateCcw size={16} /> Reset Round
                </button>
              </div>
            </div>
          </div>

          {/* Questions Builder Card */}
          <div className="glass-card questions-card">
            <div className="flex-between">
              <h2 className="card-title">
                <HelpCircle size={22} className="text-cyan" /> Questions Bank ({questions.length})
              </h2>
              <div className="flex-gap">
                <label className="btn btn-outline-cyan btn-sm file-button">
                  Import CSV
                  <input type="file" accept=".csv,text/csv" onChange={handleQuestionsImport} />
                </label>
                <button
                  type="button"
                  className="btn btn-outline-cyan btn-sm"
                  onClick={handleLoadSampleQuestions}
                  title="Load sample tech festival questions"
                >
                  <Sparkles size={16} /> Load Sample Questions
                </button>
              </div>
            </div>

            {/* Added Questions List */}
            <div className="questions-scroll-list">
              {questions.length === 0 ? (
                <div className="empty-state">No questions added yet. Click below to add.</div>
              ) : (
                questions.map((q, idx) => (
                  <div key={q.id || idx} className="question-item">
                    <div className="q-badge">{idx + 1}</div>
                    <div className="q-content">
                      <div className="q-text">{q.question}</div>
                      <div className="q-meta">
                        <span className="badge badge-outline">{q.type.toUpperCase()}</span>
                        <span className={`q-answer ${q.type === 'text' ? 'text-answer' : ''}`}>
                          {q.type === 'text' ? 'Text Answer' : 'Answer'}: {q.correctAnswer}
                        </span>
                      </div>
                    </div>
                    <div className="q-actions">
                      <button onClick={() => handleMoveQuestion(idx, -1)} disabled={idx === 0} className="icon-btn">
                        <ArrowUp size={14} />
                      </button>
                      <button onClick={() => handleMoveQuestion(idx, 1)} disabled={idx === questions.length - 1} className="icon-btn">
                        <ArrowDown size={14} />
                      </button>
                      <button onClick={() => handleRemoveQuestion(q.id)} className="icon-btn text-red">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: LIVE DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="dashboard-grid">
          {showWinnersOnDashboard ? (
            <div className="leaderboard-panel glass-card winners-panel">
              <div className="winner-celebration" aria-hidden="true">
                {CELEBRATION_PARTICLES.map((particle) => (
                  <span
                    key={particle.id}
                    className="winner-particle"
                    style={{
                      '--particle-left': particle.left,
                      '--particle-delay': particle.delay,
                      '--particle-duration': particle.duration,
                      '--particle-color': particle.color
                    }}
                  />
                ))}
              </div>
              <div className="flex-between margin-bottom-md">
                <div>
                  <h2 className="card-title">
                    <Trophy size={26} className="text-gold" /> EVENT WINNERS
                  </h2>
                  <p className="subtitle">Top three teams from the official leaderboard</p>
                </div>
                <button className="btn btn-outline-cyan" onClick={() => navigate('/admin')}>
                  <Play size={18} /> Back to Setup Round
                </button>
              </div>

              {winners.length < 3 ? (
                <div className="empty-state margin-top-lg">
                  <Trophy size={48} className="text-muted margin-bottom-sm" />
                  <h3>Top 3 Winners Not Available Yet</h3>
                  <p>Complete at least three team rounds, then declare the winners from Setup Round.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="leaderboard-table winners-table">
                    <thead>
                      <tr>
                        <th>PLACE</th>
                        <th>TEAM NAME</th>
                        <th>RESULT</th>
                        <th>QUESTIONS SOLVED</th>
                        <th>ATTEMPTS</th>
                        <th>TIME TAKEN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {winners.slice(0, 3).map((row, idx) => (
                        <tr key={row.id || idx} className="rank-row top-rank">
                          <td className="rank-cell">{row.winnerRank ? `WINNER ${row.winnerRank}` : `#${idx + 1}`}</td>
                          <td className="team-cell">{row.teamName}</td>
                          <td><span className={`result-tag ${row.result}`}>{row.result === 'defused' ? 'DEFUSED' : 'DETONATED'}</span></td>
                          <td>{formatQuestionScore(row)}</td>
                          <td className="text-red-light">{row.attemptsUsed || 0}</td>
                          <td className="mono-font highlight">{formatTime(row.timeTakenSeconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : !session ? (
            <div className="glass-card empty-dashboard">
              <ShieldAlert size={64} className="text-muted margin-bottom-sm" />
              <h2>No Active Game Session</h2>
              <p>Go to the <strong>Setup Round</strong> tab to configure and generate a join code for the next competing team.</p>
            </div>
          ) : (
            <div className="dashboard-content">
              {/* Top Banner: Big Join Code & Status */}
              <div className="glass-card join-code-card">
                <div className="code-box">
                  <span className="code-label">MOBILE PAIRING JOIN CODE</span>
                  <div className="big-join-code">{session.joinCode}</div>
                  <span className="code-hint">Team enters this on phone app at <code>/bomb</code></span>
                </div>

                <div className="session-status-badge">
                  <span className="status-label">STATUS</span>
                  <div className={`status-tag status-${session.status}`}>
                    {session.status === 'waiting_for_join' && 'WAITING FOR PLAYER TO CONNECT'}
                    {session.status === 'active' && '🔴 BOMB ARMED & TICKING'}
                    {session.status === 'defused' && '🟢 DEFUSED SUCCESSFUL'}
                    {session.status === 'detonated' && '💥 BOMB DETONATED'}
                    {session.status === 'paused' && '⏸ ROUND PAUSED'}
                  </div>
                </div>
              </div>

              {/* Main Live Telemetry Grid */}
              <div className="telemetry-grid">
                {/* Big Live Digital Timer */}
                <div className="glass-card telemetry-card timer-telemetry">
                  <div className="card-header">
                    <Clock size={20} className="text-red" /> LIVE SYNCED TIMER
                  </div>
                  <div className={`digital-timer-display ${session.timeRemainingSeconds <= 30 ? 'urgent' : ''}`}>
                    {formatTime(session.timeRemainingSeconds)}
                  </div>
                  <div className="timer-meta">
                    Total Duration: {formatTime(session.timerDurationSeconds)}
                  </div>
                </div>

                {/* Team Info & Progress */}
                <div className="glass-card telemetry-card">
                  <div className="card-header">
                    <Bomb size={20} className="text-orange" /> ACTIVE TEAM METRICS
                  </div>
                  
                  <div className="metric-row">
                    <span className="metric-label">Competing Team:</span>
                    <span className="metric-value highlight">{session.teamName}</span>
                  </div>

                  {session.diffuseMode?.questions && (
                    <div className="metric-row">
                      <span className="metric-label">Questions Solved:</span>
                      <span className="metric-value">
                        {session.progress?.questionsSolved || 0} / {session.questions?.length || 0}
                      </span>
                    </div>
                  )}

                  <div className="metric-row">
                    <span className="metric-label">Wrong Attempts / Strikes:</span>
                    <span className="metric-value text-red">
                      {session.progress?.attemptsUsed || 0} {session.maxStrikes > 0 ? `/ ${session.maxStrikes}` : ''}
                    </span>
                  </div>

                  {/* Masked Target PIN Code for Projector Security */}
                  {session.diffuseMode?.pin && (
                    <div className="metric-row">
                      <span className="metric-label">Target PIN Code:</span>
                      <div className="flex-gap">
                        <span className="metric-value mono-font text-orange">
                          {showAdminPin ? session.pin?.code : '••••••••'}
                        </span>
                        <button 
                          type="button" 
                          className="icon-btn text-muted"
                          onClick={() => setShowAdminPin(!showAdminPin)}
                          title={showAdminPin ? "Hide PIN Code on Projector" : "Reveal PIN Code for Admin"}
                        >
                          {showAdminPin ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {session.status !== 'waiting_for_join' && <div className="glass-card current-challenge-card">
                <div className="card-header">
                  <HelpCircle size={20} className="text-cyan" /> CURRENT CHALLENGE
                </div>

                <div className="challenge-grid">
                  <div className="challenge-panel question-panel">
                    <span className="challenge-label">
                      {session.status === 'waiting_for_join'
                        ? 'UPCOMING CHALLENGE'
                        : isPinChallengeActive
                        ? 'FINAL CHALLENGE'
                        : currentQuestion
                          ? `QUESTION ${currentQuestionIndex + 1} OF ${session.questions.length}`
                          : 'QUESTION STATUS'}
                    </span>
                    <div className="challenge-question">
                      {isPinChallengeActive
                        ? 'ENTER DEFUSAL PIN CODE'
                        : currentQuestion
                        ? currentQuestion.question
                        : session.diffuseMode?.questions
                          ? 'All questions completed'
                          : 'Questions mode is disabled'}
                    </div>
                    {currentQuestion?.type === 'mcq' && currentQuestion.options?.length > 0 && (
                      <div className="challenge-options">
                        {currentQuestion.options.map((option, index) => (
                          <div key={`${option}-${index}`} className="challenge-option">
                            <span className="challenge-option-key">{String.fromCharCode(65 + index)}</span>
                            <span>{option}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {session.diffuseMode?.pin && (
                    <div className="challenge-panel hint-panel">
                      <span className="challenge-label"><Lightbulb size={16} /> PIN HINT</span>
                      <div className="challenge-hint">
                        {session.pin?.hint || 'No PIN hint configured'}
                      </div>
                    </div>
                  )}
                </div>
              </div>}

              <div className="glass-card live-leaderboard-panel">
                <div className="flex-between margin-bottom-sm">
                  <div className="card-header">
                    <Trophy size={20} className="text-gold" /> LIVE LEADERBOARD
                  </div>
                </div>

                {leaderboard.length === 0 ? (
                  <div className="empty-state">No completed rounds yet.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="leaderboard-table">
                      <thead>
                        <tr>
                          <th>RANK</th>
                          <th>TEAM NAME</th>
                          <th>RESULT</th>
                          <th>ATTEMPTS</th>
                          <th>TIME TAKEN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((row, idx) => (
                          <tr key={row.id || idx} className={`rank-row ${idx < 3 ? 'top-rank' : ''}`}>
                            <td className="rank-cell">
                              {row.winnerRank ? `WINNER ${row.winnerRank}` : `#${idx + 1}`}
                            </td>
                            <td className="team-cell">{row.teamName}</td>
                            <td>
                              <span className={`result-tag ${row.result}`}>
                                {row.result === 'defused' ? 'DEFUSED' : 'DETONATED'}
                              </span>
                            </td>
                            <td className="text-red-light">{row.attemptsUsed || 0}</td>
                            <td className="mono-font highlight">{formatTime(row.timeTakenSeconds)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="leaderboard-panel glass-card">
          <div className="flex-between margin-bottom-md">
            <div>
              <h2 className="card-title">
                <Trophy size={26} className="text-gold" /> OFFICIAL EVENT LEADERBOARD
              </h2>
              <p className="subtitle">Persistent standings across all competing teams</p>
            </div>

            <div className="flex-gap">
              <label className="btn btn-outline-cyan btn-sm file-button">
                Import Teams CSV
                <input type="file" accept=".csv,text/csv" onChange={handleTeamsImport} />
              </label>
              <button className="btn btn-cyan" onClick={() => navigate('/admin')}>
                <Plus size={18} /> Start Next Team Round
              </button>
              <button className="btn btn-outline-red btn-sm" onClick={handleClearLeaderboard}>
                <Trash2 size={16} /> Clear History
              </button>
            </div>
          </div>

          {importError && <div className="import-error" role="alert">{importError}</div>}

          {leaderboard.length === 0 ? (
            <div className="empty-state margin-top-lg">
              <Trophy size={48} className="text-muted margin-bottom-sm" />
              <h3>No Round Results Recorded Yet</h3>
              <p>Complete a team round to automatically record scores to the leaderboard.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>RANK</th>
                    <th>TEAM NAME</th>
                    <th>RESULT</th>
                    <th>QUESTIONS SOLVED</th>
                    <th>WRONG ATTEMPTS</th>
                    <th>TIME TAKEN</th>
                    <th>DATE & TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, idx) => (
                    <tr key={row.id || idx} className={`rank-row ${idx === 0 ? 'top-rank' : ''}`}>
                      <td className="rank-cell">
                        {row.winnerRank ? `WINNER ${row.winnerRank}` : `#${idx + 1}`}
                      </td>
                      <td className="team-cell">{row.teamName}</td>
                      <td>
                        <span className={`result-tag ${row.result}`}>
                          {row.result === 'defused' ? 'DEFUSED' : 'DETONATED'}
                        </span>
                      </td>
                      <td>{formatQuestionScore(row)}</td>
                      <td className="text-red-light">{row.attemptsUsed}</td>
                      <td className="mono-font highlight">{formatTime(row.timeTakenSeconds)}</td>
                      <td className="text-muted text-sm">
                        {row.timestamp ? new Date(row.timestamp).toLocaleTimeString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: WINNERS */}
      {activeTab === 'winners' && (
        <div className="leaderboard-panel glass-card winners-panel">
          <div className="winner-celebration" aria-hidden="true">
            {CELEBRATION_PARTICLES.map((particle) => (
              <span
                key={particle.id}
                className="winner-particle"
                style={{
                  '--particle-left': particle.left,
                  '--particle-delay': particle.delay,
                  '--particle-duration': particle.duration,
                  '--particle-color': particle.color
                }}
              />
            ))}
          </div>
          <div className="flex-between margin-bottom-md">
            <div>
              <h2 className="card-title">
                <Trophy size={26} className="text-gold" /> EVENT WINNERS
              </h2>
              <p className="subtitle">Top three teams from the official leaderboard</p>
            </div>
            <button className="btn btn-outline-cyan" onClick={() => navigate('/admin')}>
              <Play size={18} /> Back to Setup Round
            </button>
          </div>

          {winners.length < 3 ? (
            <div className="empty-state margin-top-lg">
              <Trophy size={48} className="text-muted margin-bottom-sm" />
              <h3>Top 3 Winners Not Available Yet</h3>
              <p>Complete at least three team rounds, then declare the winners from Setup Round.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="leaderboard-table winners-table">
                <thead>
                  <tr>
                    <th>PLACE</th>
                    <th>TEAM NAME</th>
                    <th>RESULT</th>
                    <th>QUESTIONS SOLVED</th>
                    <th>ATTEMPTS</th>
                    <th>TIME TAKEN</th>
                  </tr>
                </thead>
                <tbody>
                  {winners.slice(0, 3).map((row, idx) => (
                    <tr key={row.id || idx} className="rank-row top-rank">
                      <td className="rank-cell">{row.winnerRank ? `WINNER ${row.winnerRank}` : `#${idx + 1}`}</td>
                      <td className="team-cell">{row.teamName}</td>
                      <td><span className={`result-tag ${row.result}`}>{row.result === 'defused' ? 'DEFUSED' : 'DETONATED'}</span></td>
                      <td>{formatQuestionScore(row)}</td>
                      <td className="text-red-light">{row.attemptsUsed || 0}</td>
                      <td className="mono-font highlight">{formatTime(row.timeTakenSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
