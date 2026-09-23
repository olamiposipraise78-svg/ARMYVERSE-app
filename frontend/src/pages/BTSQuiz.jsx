import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { getQuizQuestions, submitQuizResult } from '../utils/api.js'
import Button from '../components/ui/Button.jsx'
import Icon from '../components/ui/Icon.jsx'
import '../styles/quiz.css'

const LIVES_MAX = 3
const TIMER_SECONDS = { easy: 20, medium: 15, hard: 10 }
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

export default function BTSQuiz() {
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
    try {
      const res = await getQuizQuestions(diff)
      const q = shuffle(res.questions || []).slice(0, QUESTIONS_PER_ROUND)
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
    } catch {
      show('Failed to load questions. Please try again.', 'error')
    }
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
      <div className="page quiz-page">
        <div className="quiz-start">
          <div className="quiz-start__hero">
            <span className="quiz-start__icon">🧠</span>
            <h1 className="quiz-start__title">BTS Quiz</h1>
            <p className="quiz-start__sub">Test your BTS knowledge!</p>
          </div>
          <div className="quiz-start__diffs">
            {['easy', 'medium', 'hard'].map((d) => (
              <button key={d} className="quiz-diff" onClick={() => handleStart(d)}>
                <span className="quiz-diff__icon" style={{ color: difficultyColor[d] }}>
                  {d === 'easy' ? '⭐' : d === 'medium' ? '⭐⭐' : '⭐⭐⭐'}
                </span>
                <span className="quiz-diff__name">{difficultyLabel[d]}</span>
                <span className="quiz-diff__desc">
                  {d === 'easy' ? 'Basic BTS facts' : d === 'medium' ? 'Intermediate knowledge' : 'Expert-level trivia'}
                </span>
                <span className="quiz-diff__timer">{TIMER_SECONDS[d]}s per question</span>
              </button>
            ))}
          </div>
          <div className="quiz-start__info">
            <p>10 questions · 3 lives · Timer per question</p>
            <p>Score bonuses for speed and streaks!</p>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'results') {
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
    const xpEarned = score
    return (
      <div className="page quiz-page">
        <div className="quiz-results">
          <div className="quiz-results__hero">
            <span className="quiz-results__icon">
              {lives > 0 ? '🎉' : '💔'}
            </span>
            <h1 className="quiz-results__title">
              {lives > 0 ? 'Quiz Complete!' : 'Game Over!'}
            </h1>
            <p className="quiz-results__sub">
              {lives > 0
                ? `Amazing work, ARMY! You got through all ${totalQuestions} questions!`
                : `You answered ${currentIdx} out of ${totalQuestions} questions.`}
            </p>
          </div>
          <div className="quiz-results__stats">
            <div className="quiz-stat">
              <span className="quiz-stat__value" style={{ color: 'var(--c-success)' }}>{correctCount}/{totalQuestions}</span>
              <span className="quiz-stat__label">Correct</span>
            </div>
            <div className="quiz-stat">
              <span className="quiz-stat__value" style={{ color: 'var(--c-purple)' }}>{score}</span>
              <span className="quiz-stat__label">Score</span>
            </div>
            <div className="quiz-stat">
              <span className="quiz-stat__value" style={{ color: 'var(--c-success)' }}>{bestStreak}</span>
              <span className="quiz-stat__label">Best Streak</span>
            </div>
            <div className="quiz-stat">
              <span className="quiz-stat__value" style={{ color: 'var(--c-info)' }}>{accuracy}%</span>
              <span className="quiz-stat__label">Accuracy</span>
            </div>
            <div className="quiz-stat">
              <span className="quiz-stat__value" style={{ color: 'var(--c-warning)' }}>+{xpEarned}</span>
              <span className="quiz-stat__label">XP Earned</span>
            </div>
          </div>
          {!isAuthenticated && (
            <div className="quiz-results__guest">
              <p>Sign in to save your score and track your XP!</p>
            </div>
          )}
          <div className="quiz-results__actions">
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
    <div className="page quiz-page">
      <div className="quiz-game">
        <div className="quiz-game__hud">
          <div className="quiz-hud__left">
            <span className="quiz-hud__lives">
              {Array.from({ length: LIVES_MAX }, (_, i) => (
                <span key={i} className={`quiz-heart ${i < lives ? 'quiz-heart--on' : 'quiz-heart--off'}`}>
                  {i < lives ? '❤️' : '🖤'}
                </span>
              ))}
            </span>
            <span className="quiz-hud__streak">
              {streak > 1 && <><span className="quiz-fire">🔥</span> {streak}x</>}
            </span>
          </div>
          <div className="quiz-hud__center">
            <span className="quiz-hud__progress">
              {currentIdx + 1} / {totalQuestions}
            </span>
          </div>
          <div className="quiz-hud__right">
            <span className="quiz-hud__score">{score} pts</span>
          </div>
        </div>

        <div className="quiz-timer-bar">
          <div
            className="quiz-timer-bar__fill"
            style={{
              width: `${(timeLeft / TIMER_SECONDS[difficulty]) * 100}%`,
              background: timeLeft <= 5 ? 'var(--c-danger)' : 'var(--c-purple)',
            }}
          />
        </div>

        {question && (
          <div className="quiz-question">
            <div className="quiz-question__meta">
              <span className="quiz-question__category">{question.category}</span>
              <span className="quiz-question__difficulty" style={{ color: difficultyColor[difficulty] }}>
                {difficultyLabel[difficulty]}
              </span>
              <span className="quiz-question__timer">{timeLeft}s</span>
            </div>
            <h2 className="quiz-question__text">{question.question}</h2>
            <div className="quiz-options">
              {question.options.map((opt, i) => {
                let cls = 'quiz-option'
                if (selected !== null) {
                  if (i === question.correctIndex) cls += ' quiz-option--correct'
                  else if (i === selected) cls += ' quiz-option--wrong'
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => handleAnswer(i)}
                    disabled={selected !== null}
                  >
                    <span className="quiz-option__letter">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="quiz-option__text">{opt}</span>
                    {selected !== null && i === question.correctIndex && (
                      <span className="quiz-option__icon">✓</span>
                    )}
                    {selected !== null && i === selected && i !== question.correctIndex && (
                      <span className="quiz-option__icon">✗</span>
                    )}
                  </button>
                )
              })}
            </div>
            {selected !== null && question.funFact && (
              <div className={`quiz-fact ${isCorrect ? 'quiz-fact--correct' : 'quiz-fact--wrong'}`}>
                <span className="quiz-fact__icon">💡</span>
                <p className="quiz-fact__text">{question.funFact}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
