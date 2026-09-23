import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { submitQuizResult } from '../utils/api.js'
import Button from '../components/ui/Button.jsx'
import Icon from '../components/ui/Icon.jsx'
import memberQuestions from '../data/memberQuestions.js'
import { BTS_MEMBERS } from '../data/btsCatalogue.js'
import '../styles/guessmember.css'

const MEMBER_PHOTOS = Object.fromEntries(BTS_MEMBERS.map((m) => [m.key, m.photoUrl]))

const LIVES_MAX = 3
const TIMER_SECONDS = { easy: 15, medium: 12, hard: 8 }
const XP_PER_CORRECT = { easy: 100, medium: 200, hard: 300 }
const QUESTIONS_PER_ROUND = 10
const FEEDBACK_DELAY = 1800

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function GuessMember() {
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

  const timerRef = useRef(null)
  const feedbackRef = useRef(null)

  const question = questions[currentIdx]
  const totalQuestions = questions.length

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (feedbackRef.current) { clearTimeout(feedbackRef.current); feedbackRef.current = null }
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  useEffect(() => {
    if (screen !== 'playing' || selected !== null || timeLeft <= 0) return
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          setSelected('timeout')
          setIsCorrect(false)
          setLives((l) => l - 1)
          setStreak(0)
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
        game_type: 'guess-member',
      })
    } catch {
      // Progress save failed silently
    } finally {
      setSubmitting(false)
    }
  }, [score, difficulty, correctCount, totalQuestions, bestStreak, isAuthenticated])

  const advance = useCallback((wasCorrect) => {
    setSelected(null)
    setIsCorrect(null)
    if (!wasCorrect && lives <= 1) {
      handleFinish()
      return
    }
    if (currentIdx + 1 >= totalQuestions) {
      handleFinish()
      return
    }
    setCurrentIdx((i) => i + 1)
    setTimeLeft(TIMER_SECONDS[difficulty])
  }, [currentIdx, totalQuestions, difficulty, lives, handleFinish])

  const handleStart = useCallback(async (diff) => {
    setDifficulty(diff)
    const filtered = memberQuestions.filter((q) => q.difficulty === diff)
    const q = shuffle(filtered).slice(0, QUESTIONS_PER_ROUND)
    if (q.length === 0) {
      show('No questions available for this difficulty.', 'error')
      return
    }
    setQuestions(q)
    setCurrentIdx(0)
    setScore(0)
    setCorrectCount(0)
    setLives(LIVES_MAX)
    setStreak(0)
    setBestStreak(0)
    setSelected(null)
    setIsCorrect(null)
    setTimeLeft(TIMER_SECONDS[diff])
    setScreen('playing')
  }, [show])

  const handleAnswer = useCallback((optIdx) => {
    if (selected !== null || screen !== 'playing') return
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setSelected(optIdx)
    const correct = optIdx === question.correctIndex
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
    feedbackRef.current = setTimeout(() => {
      advance(correct)
    }, FEEDBACK_DELAY)
  }, [selected, screen, question, timeLeft, streak, difficulty, advance])

  const difficultyLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
  const difficultyColor = { easy: 'var(--c-success)', medium: 'var(--c-warning)', hard: 'var(--c-danger)' }

  if (screen === 'start') {
    return (
      <div className="page guessmember-page">
        <div className="guessmember-start">
          <div className="guessmember-start__hero">
            <span className="guessmember-start__icon">👤</span>
            <h1 className="guessmember-start__title">Guess the Member</h1>
            <p className="guessmember-start__sub">Can you identify the BTS members?</p>
          </div>
          <div className="guessmember-start__diffs">
            {['easy', 'medium', 'hard'].map((d) => (
              <button key={d} className="guessmember-diff" onClick={() => handleStart(d)}>
                <span className="guessmember-diff__icon" style={{ color: difficultyColor[d] }}>
                  {d === 'easy' ? '⭐' : d === 'medium' ? '⭐⭐' : '⭐⭐⭐'}
                </span>
                <span className="guessmember-diff__name">{difficultyLabel[d]}</span>
                <span className="guessmember-diff__desc">
                  {d === 'easy' ? 'Basic member facts' : d === 'medium' ? 'Solo work & trivia' : 'Expert-level details'}
                </span>
                <span className="guessmember-diff__timer">{TIMER_SECONDS[d]}s per question</span>
              </button>
            ))}
          </div>
          <div className="guessmember-start__info">
            <p>10 questions · 3 lives · Timer per question</p>
            <p>Score bonuses for speed and streaks!</p>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'results') {
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
    return (
      <div className="page guessmember-page">
        <div className="guessmember-results">
          <div className="guessmember-results__hero">
            <span className="guessmember-results__icon">
              {lives > 0 ? '🎉' : '💔'}
            </span>
            <h1 className="guessmember-results__title">
              {lives > 0 ? 'Amazing!' : 'Game Over!'}
            </h1>
            <p className="guessmember-results__sub">
              {lives > 0
                ? `You really know your BTS members!`
                : `You answered ${currentIdx} out of ${totalQuestions} questions.`}
            </p>
          </div>
          <div className="guessmember-results__stats">
            <div className="guessmember-stat">
              <span className="guessmember-stat__value" style={{ color: 'var(--c-success)' }}>{correctCount}/{totalQuestions}</span>
              <span className="guessmember-stat__label">Correct</span>
            </div>
            <div className="guessmember-stat">
              <span className="guessmember-stat__value" style={{ color: 'var(--c-purple)' }}>{score}</span>
              <span className="guessmember-stat__label">Score</span>
            </div>
            <div className="guessmember-stat">
              <span className="guessmember-stat__value" style={{ color: 'var(--c-success)' }}>{bestStreak}</span>
              <span className="guessmember-stat__label">Best Streak</span>
            </div>
            <div className="guessmember-stat">
              <span className="guessmember-stat__value" style={{ color: 'var(--c-info)' }}>{accuracy}%</span>
              <span className="guessmember-stat__label">Accuracy</span>
            </div>
            <div className="guessmember-stat">
              <span className="guessmember-stat__value" style={{ color: 'var(--c-warning)' }}>+{score}</span>
              <span className="guessmember-stat__label">XP Earned</span>
            </div>
          </div>
          {!isAuthenticated && (
            <div className="guessmember-results__guest">
              <p>Sign in to save your score and track your XP!</p>
            </div>
          )}
          <div className="guessmember-results__actions">
            <Button variant="primary" onClick={() => handleStart(difficulty)}>
              Play Again
            </Button>
            <Button variant="secondary" onClick={() => navigate('/games')}>
              Game Centre
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page guessmember-page">
      <div className="guessmember-game">
        <div className="guessmember-game__hud">
          <div className="guessmember-hud__left">
            <span className="guessmember-hud__lives">
              {Array.from({ length: LIVES_MAX }, (_, i) => (
                <span key={i} className={`guessmember-heart ${i < lives ? 'guessmember-heart--on' : 'guessmember-heart--off'}`}>
                  {i < lives ? '❤️' : '🖤'}
                </span>
              ))}
            </span>
            <span className="guessmember-hud__streak">
              {streak > 1 && <><span className="guessmember-fire">🔥</span> {streak}x</>}
            </span>
          </div>
          <div className="guessmember-hud__center">
            <span className="guessmember-hud__progress">
              {currentIdx + 1} / {totalQuestions}
            </span>
          </div>
          <div className="guessmember-hud__right">
            <span className="guessmember-hud__score">{score} pts</span>
          </div>
        </div>

        <div className="guessmember-timer-bar">
          <div
            className="guessmember-timer-bar__fill"
            style={{
              width: `${(timeLeft / TIMER_SECONDS[difficulty]) * 100}%`,
              background: timeLeft <= 5 ? 'var(--c-danger)' : 'var(--c-purple)',
            }}
          />
        </div>

        {question && (
          <div className="guessmember-question">
            <div className="guessmember-question__meta">
              <span className="guessmember-question__category">Who is this?</span>
              <span className="guessmember-question__difficulty" style={{ color: difficultyColor[difficulty] }}>
                {difficultyLabel[difficulty]}
              </span>
              <span className="guessmember-question__timer">{timeLeft}s</span>
            </div>
            <div className="guessmember-clue">
              <img
                src={MEMBER_PHOTOS[question.member] || `/images/bts/${question.member}.svg`}
                alt="Who is this member?"
                className="guessmember-clue__img"
              />
              <p className="guessmember-clue__text">{question.clue}</p>
            </div>
            <div className="guessmember-options">
              {question.options.map((opt, i) => {
                let cls = 'guessmember-option'
                if (selected !== null) {
                  if (i === question.correctIndex) cls += ' guessmember-option--correct'
                  else if (i === selected) cls += ' guessmember-option--wrong'
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => handleAnswer(i)}
                    disabled={selected !== null}
                  >
                    <span className="guessmember-option__letter">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="guessmember-option__text">{opt}</span>
                    {selected !== null && i === question.correctIndex && (
                      <span className="guessmember-option__icon">✓</span>
                    )}
                    {selected !== null && i === selected && i !== question.correctIndex && (
                      <span className="guessmember-option__icon">✗</span>
                    )}
                  </button>
                )
              })}
            </div>
            {selected !== null && (
              <div className={`guessmember-reveal ${isCorrect ? 'guessmember-reveal--correct' : 'guessmember-reveal--wrong'}`}>
                <img
                  src={MEMBER_PHOTOS[question.member] || `/images/bts/${question.member}.svg`}
                  alt={question.options[question.correctIndex]}
                  className="guessmember-reveal__img"
                />
                <div className="guessmember-reveal__info">
                  <span className="guessmember-reveal__icon">{isCorrect ? '✅' : '❌'}</span>
                  <p className="guessmember-reveal__name">{question.options[question.correctIndex]}</p>
                  {question.fact && <p className="guessmember-reveal__fact">{question.fact}</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
