import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { submitQuizResult, fetchSongPreviews } from '../utils/api.js'
import Button from '../components/ui/Button.jsx'
import songQuestions from '../data/songQuestions.js'
import '../styles/guesssong.css'

const LIVES_MAX = 3
const TIMER_SECONDS = { easy: 15, medium: 12, hard: 8 }
const XP_PER_CORRECT = { easy: 100, medium: 200, hard: 300 }
const QUESTIONS_PER_ROUND = 10
const INTRO_DURATION = 1500
const LISTEN_DURATION = 2000
const FEEDBACK_DELAY = 1800
const TOTAL_OPTIONS = 4

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildRound(diff) {
  const pool = songQuestions.filter((q) => q.difficulty === diff)
  const questions = shuffle(pool).slice(0, QUESTIONS_PER_ROUND)
  return questions.map((q) => {
    const distractors = shuffle(
      pool.filter((p) => p.id !== q.id).map((p) => p.title)
    ).slice(0, TOTAL_OPTIONS - 1)
    return { ...q, options: shuffle([q.title, ...distractors]) }
  })
}

export default function GuessSong() {
  const navigate = useNavigate()
  const { isAuthenticated } = useApp()
  const { show } = useToast()

  const [screen, setScreen] = useState('start')
  const [difficulty, setDifficulty] = useState('easy')
  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selected, setSelected] = useState(null)
  const [isCorrect, setIsCorrect] = useState(null)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [lives, setLives] = useState(LIVES_MAX)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [previews, setPreviews] = useState({})
  const [previewMissing, setPreviewMissing] = useState(false)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)

  const timerRef = useRef(null)
  const feedbackRef = useRef(null)
  const introRef = useRef(null)
  const listenRef = useRef(null)
  const audioRef = useRef(null)

  const question = questions[currentIdx]
  const totalQuestions = questions.length
  const previewUrl = question ? previews[question.deezerId] : null

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (feedbackRef.current) { clearTimeout(feedbackRef.current); feedbackRef.current = null }
    if (introRef.current) { clearTimeout(introRef.current); introRef.current = null }
    if (listenRef.current) { clearTimeout(listenRef.current); listenRef.current = null }
  }, [])

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      } catch {}
    }
    setIsAudioPlaying(false)
  }, [])

  useEffect(() => {
    return () => {
      clearTimers()
      stopAudio()
    }
  }, [clearTimers, stopAudio])

  // Intro → listening
  useEffect(() => {
    if (screen !== 'intro') return
    introRef.current = setTimeout(() => {
      setPreviewMissing(!previewUrl)
      setScreen('listening')
    }, INTRO_DURATION)
    return () => { if (introRef.current) clearTimeout(introRef.current) }
  }, [screen, previewUrl])

  // Listening: play the 3-second preview, then move to the question
  useEffect(() => {
    if (screen !== 'listening' || !question) return

    const audio = audioRef.current
    if (!audio || !previewUrl) {
      setAutoplayBlocked(true)
      return
    }
    setAutoplayBlocked(false)
    setPreviewMissing(false)
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    audio.src = previewUrl
    audio.load()

    const startPlayback = async () => {
      try {
        await audio.play()
        setIsAudioPlaying(true)
        listenRef.current = setTimeout(() => {
          stopAudio()
          setSelected(null)
          setIsCorrect(null)
          setTimeLeft(TIMER_SECONDS[difficulty])
          setScreen('question')
        }, LISTEN_DURATION)
      } catch {
        setAutoplayBlocked(true)
      }
    }
    startPlayback()

    const onAudioEnd = () => {
      if (screen === 'listening') {
        setIsAudioPlaying(false)
        setSelected(null)
        setIsCorrect(null)
        setTimeLeft(TIMER_SECONDS[difficulty])
        setScreen('question')
      }
    }
    audio.addEventListener('ended', onAudioEnd)
    return () => {
      audio.removeEventListener('ended', onAudioEnd)
      if (listenRef.current) { clearTimeout(listenRef.current); listenRef.current = null }
      stopAudio()
    }
  }, [screen, currentIdx, question, previewUrl, difficulty, stopAudio])

  const handleTapToListen = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !previewUrl || selected !== null) return
    try {
      setAutoplayBlocked(false)
      await audio.play()
      setIsAudioPlaying(true)
      if (listenRef.current) clearTimeout(listenRef.current)
      listenRef.current = setTimeout(() => {
        stopAudio()
        setSelected(null)
        setIsCorrect(null)
        setTimeLeft(TIMER_SECONDS[difficulty])
        setScreen('question')
      }, LISTEN_DURATION)
    } catch {}
  }, [previewUrl, selected, difficulty, stopAudio])

  // Question timer
  useEffect(() => {
    if (screen !== 'question' || selected !== null || timeLeft <= 0) return
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          setSelected('timeout')
          setIsCorrect(false)
          setLives((l) => l - 1)
          setStreak(0)
          setScreen('feedback')
          feedbackRef.current = setTimeout(() => {
            advance(false)
          }, FEEDBACK_DELAY)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [screen, currentIdx, selected, timeLeft])

  const handleFinish = useCallback(async () => {
    setScreen('results')
    if (!isAuthenticated) return
    setSubmitting(true)
    try {
      await submitQuizResult({
        score,
        difficulty,
        correct: correctCount,
        total: totalQuestions,
        streak: bestStreak,
        game_type: 'guess-song',
      })
    } catch {
    } finally {
      setSubmitting(false)
    }
  }, [score, difficulty, correctCount, totalQuestions, bestStreak, isAuthenticated])

  const advance = useCallback((wasCorrect) => {
    clearTimers()
    stopAudio()
    setSelected(null)
    setIsCorrect(null)
    setPreviewMissing(false)
    setAutoplayBlocked(false)
    setTimeLeft(0)
    if (!wasCorrect && lives <= 1) {
      handleFinish()
      return
    }
    if (currentIdx + 1 >= totalQuestions) {
      handleFinish()
      return
    }
    setCurrentIdx((i) => i + 1)
    setScreen('intro')
  }, [currentIdx, totalQuestions, lives, stopAudio, handleFinish, clearTimers])

  const handleStart = useCallback(async (diff) => {
    setDifficulty(diff)
    const round = buildRound(diff)
    if (round.length === 0) {
      show('No questions available for this difficulty.', 'error')
      return
    }
    setQuestions(round)
    setCurrentIdx(0)
    setScore(0)
    setCorrectCount(0)
    setLives(LIVES_MAX)
    setStreak(0)
    setBestStreak(0)
    setSelected(null)
    setIsCorrect(null)
    setPreviewMissing(false)
    setAutoplayBlocked(false)
    setPreviews({})
    setScreen('intro')

    const ids = [...new Set(round.map((q) => q.deezerId))]
    try {
      const data = await fetchSongPreviews(ids)
      setPreviews(data.previews || {})
    } catch (err) {
      show('Could not load song previews. Check your connection and try again.', 'error')
      setScreen('start')
    }
  }, [show])

  const handleAnswer = useCallback((optIdx) => {
    if (selected !== null || screen !== 'question') return
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    stopAudio()
    setSelected(optIdx)
    const correct = optIdx === question.options.indexOf(question.title)
    setIsCorrect(correct)
    if (correct) {
      const timeBonus = Math.floor(timeLeft * 10)
      const streakBonus = streak * 25
      const base = XP_PER_CORRECT[difficulty] || 100
      setScore((s) => s + base + timeBonus + streakBonus)
      setCorrectCount((c) => c + 1)
      setStreak((s) => s + 1)
      setBestStreak((bs) => Math.max(bs, streak + 1))
    } else {
      setLives((l) => l - 1)
      setStreak(0)
    }
    setScreen('feedback')
    feedbackRef.current = setTimeout(() => {
      advance(correct)
    }, FEEDBACK_DELAY)
  }, [selected, screen, question, timeLeft, streak, difficulty, advance, stopAudio])

  const difficultyLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
  const difficultyColor = { easy: 'var(--c-success)', medium: 'var(--c-warning)', hard: 'var(--c-danger)' }

  if (screen === 'start') {
    return (
      <div className="page guesssong-page">
        <div className="guesssong-start">
          <div className="guesssong-start__hero">
            <span className="guesssong-start__icon">🎵</span>
            <h1 className="guesssong-start__title">Guess the Song</h1>
            <p className="guesssong-start__sub">Listen to the clip and identify the BTS song!</p>
          </div>
          <div className="guesssong-start__diffs">
            {['easy', 'medium', 'hard'].map((d) => (
              <button key={d} className="guesssong-diff" onClick={() => handleStart(d)}>
                <span className="guesssong-diff__icon" style={{ color: difficultyColor[d] }}>
                  {d === 'easy' ? '⭐' : d === 'medium' ? '⭐⭐' : '⭐⭐⭐'}
                </span>
                <span className="guesssong-diff__name">{difficultyLabel[d]}</span>
                <span className="guesssong-diff__desc">
                  {d === 'easy' ? 'Popular title tracks' : d === 'medium' ? 'Deep cuts & B-sides' : 'Solo songs & rare tracks'}
                </span>
                <span className="guesssong-diff__timer">{TIMER_SECONDS[d]}s per question</span>
              </button>
            ))}
          </div>
          <div className="guesssong-start__info">
            <p>10 questions · 3 lives · 3-second audio previews</p>
            <p>Score bonuses for speed and streaks!</p>
          </div>
        </div>
        <audio ref={audioRef} preload="none" />
      </div>
    )
  }

  if (screen === 'results') {
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
    return (
      <div className="page guesssong-page">
        <div className="guesssong-results">
          <div className="guesssong-results__hero">
            <span className="guesssong-results__icon">
              {lives > 0 ? '🎉' : '💔'}
            </span>
            <h1 className="guesssong-results__title">
              {lives > 0 ? 'Great Job!' : 'Game Over!'}
            </h1>
            <p className="guesssong-results__sub">
              {lives > 0
                ? `You know your BTS songs!`
                : `You answered ${currentIdx} out of ${totalQuestions} questions.`}
            </p>
          </div>
          <div className="guesssong-results__stats">
            <div className="guesssong-stat">
              <span className="guesssong-stat__value" style={{ color: 'var(--c-success)' }}>{correctCount}/{totalQuestions}</span>
              <span className="guesssong-stat__label">Correct</span>
            </div>
            <div className="guesssong-stat">
              <span className="guesssong-stat__value" style={{ color: 'var(--c-purple)' }}>{score}</span>
              <span className="guesssong-stat__label">Score</span>
            </div>
            <div className="guesssong-stat">
              <span className="guesssong-stat__value" style={{ color: 'var(--c-success)' }}>{bestStreak}</span>
              <span className="guesssong-stat__label">Best Streak</span>
            </div>
            <div className="guesssong-stat">
              <span className="guesssong-stat__value" style={{ color: 'var(--c-info)' }}>{accuracy}%</span>
              <span className="guesssong-stat__label">Accuracy</span>
            </div>
            <div className="guesssong-stat">
              <span className="guesssong-stat__value" style={{ color: 'var(--c-warning)' }}>+{score}</span>
              <span className="guesssong-stat__label">XP Earned</span>
            </div>
          </div>
          {!isAuthenticated && (
            <div className="guesssong-results__guest">
              <p>Sign in to save your score and track your XP!</p>
            </div>
          )}
          <div className="guesssong-results__actions">
            <Button variant="primary" onClick={() => handleStart(difficulty)}>
              Play Again
            </Button>
            <Button variant="secondary" onClick={() => navigate('/games')}>
              Game Centre
            </Button>
          </div>
        </div>
        <audio ref={audioRef} preload="none" />
      </div>
    )
  }

  // Intro and listening screens share the same layout shell
  if (screen === 'intro' || screen === 'listening') {
    return (
      <div className="page guesssong-page">
        <div className="guesssong-game">
          <div className="guesssong-game__hud">
            <div className="guesssong-hud__left">
              <span className="guesssong-hud__lives">
                {Array.from({ length: LIVES_MAX }, (_, i) => (
                  <span key={i} className={`guesssong-heart ${i < lives ? 'guesssong-heart--on' : 'guesssong-heart--off'}`}>
                    {i < lives ? '❤️' : '🖤'}
                  </span>
                ))}
              </span>
              <span className="guesssong-hud__streak">
                {streak > 1 && <><span className="guesssong-fire">🔥</span> {streak}x</>}
              </span>
            </div>
            <div className="guesssong-hud__center">
              <span className="guesssong-hud__progress">
                {currentIdx + 1} / {totalQuestions}
              </span>
            </div>
            <div className="guesssong-hud__right">
              <span className="guesssong-hud__score">{score} pts</span>
            </div>
          </div>

          {screen === 'intro' && (
            <div className="guesssong-intro">
              <span className="guesssong-intro__badge">{difficultyLabel[difficulty]}</span>
              <h2 className="guesssong-intro__title">Get Ready...</h2>
              <p className="guesssong-intro__sub">A {LISTEN_DURATION / 1000}-second clip is coming</p>
              <div className="guesssong-intro__loading">
                <span className="guesssong-intro__dot" />
                <span className="guesssong-intro__dot" />
                <span className="guesssong-intro__dot" />
              </div>
            </div>
          )}

          {screen === 'listening' && (
            <div className="guesssong-listening">
              <div className="guesssong-listening__wave">
                {Array.from({ length: 24 }, (_, i) => (
                  <span
                    key={i}
                    className={`guesssong-listening__bar ${isAudioPlaying ? 'guesssong-listening__bar--on' : ''}`}
                    style={{ '--bar-i': i }}
                  />
                ))}
              </div>
              <h2 className="guesssong-listening__title">
                {isAudioPlaying ? 'Listening...' : 'Tap to Listen'}
              </h2>
              <p className="guesssong-listening__sub">
                {previewMissing
                  ? 'Preview unavailable — skipping to the question.'
                  : autoplayBlocked || !isAudioPlaying
                    ? 'Tap the button to play the clip'
                    : 'Identify the song from the clip!'}
              </p>
              {(autoplayBlocked || previewMissing) && selected === null && (
                <button
                  className="guesssong-tap-btn"
                  onClick={() => {
                    if (previewMissing) {
                      setSelected(null)
                      setIsCorrect(null)
                      setTimeLeft(TIMER_SECONDS[difficulty])
                      setScreen('question')
                      return
                    }
                    handleTapToListen()
                  }}
                >
                  <span className="guesssong-tap-btn__icon">▶</span>
                  <span className="guesssong-tap-btn__text">
                    {previewMissing ? 'Skip Preview' : 'Play Clip'}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
        <audio ref={audioRef} preload="none" />
      </div>
    )
  }

  // Question + feedback share the same shell
  return (
    <div className="page guesssong-page">
      <div className="guesssong-game">
        <div className="guesssong-game__hud">
          <div className="guesssong-hud__left">
            <span className="guesssong-hud__lives">
              {Array.from({ length: LIVES_MAX }, (_, i) => (
                <span key={i} className={`guesssong-heart ${i < lives ? 'guesssong-heart--on' : 'guesssong-heart--off'}`}>
                  {i < lives ? '❤️' : '🖤'}
                </span>
              ))}
            </span>
            <span className="guesssong-hud__streak">
              {streak > 1 && <><span className="guesssong-fire">🔥</span> {streak}x</>}
            </span>
          </div>
          <div className="guesssong-hud__center">
            <span className="guesssong-hud__progress">
              {currentIdx + 1} / {totalQuestions}
            </span>
          </div>
          <div className="guesssong-hud__right">
            <span className="guesssong-hud__score">{score} pts</span>
          </div>
        </div>

        {screen === 'question' && (
          <div className="guesssong-timer-bar">
            <div
              className="guesssong-timer-bar__fill"
              style={{
                width: `${(timeLeft / TIMER_SECONDS[difficulty]) * 100}%`,
                background: timeLeft <= 5 ? 'var(--c-danger)' : 'var(--c-purple)',
              }}
            />
          </div>
        )}

        {question && (
          <div className="guesssong-question">
            <div className="guesssong-question__meta">
              <span className="guesssong-question__category">Guess the Song</span>
              <span className="guesssong-question__difficulty" style={{ color: difficultyColor[difficulty] }}>
                {difficultyLabel[difficulty]}
              </span>
              {screen === 'question' && (
                <span className="guesssong-question__timer">{timeLeft}s</span>
              )}
            </div>

            <div className="guesssong-options">
              {question.options.map((opt, i) => {
                let cls = 'guesssong-option'
                let optionState = null
                if (screen === 'feedback' || selected !== null) {
                  if (opt === question.title) {
                    cls += ' guesssong-option--correct'
                    optionState = 'correct'
                  } else if (selected === i) {
                    cls += ' guesssong-option--wrong'
                    optionState = 'wrong'
                  }
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => handleAnswer(i)}
                    disabled={screen !== 'question' || selected !== null}
                  >
                    <span className="guesssong-option__letter">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="guesssong-option__text">{opt}</span>
                    {optionState === 'correct' && (
                      <span className="guesssong-option__icon">✓</span>
                    )}
                    {optionState === 'wrong' && (
                      <span className="guesssong-option__icon">✗</span>
                    )}
                  </button>
                )
              })}
            </div>

            {(screen === 'feedback' || selected !== null) && question.hint && (
              <div className={`guesssong-fact ${isCorrect ? 'guesssong-fact--correct' : 'guesssong-fact--wrong'}`}>
                <span className="guesssong-fact__icon">💡</span>
                <p className="guesssong-fact__text">{question.hint}</p>
              </div>
            )}
          </div>
        )}
        <audio ref={audioRef} preload="none" />
      </div>
    </div>
  )
}