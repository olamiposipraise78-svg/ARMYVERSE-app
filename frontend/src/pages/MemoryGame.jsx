import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { submitQuizResult } from '../utils/api.js'
import Button from '../components/ui/Button.jsx'
import { BTS_MEMBERS } from '../data/btsCatalogue.js'
import '../styles/memory.css'

const MEMBER_CARDS = BTS_MEMBERS.map((m) => ({ id: m.key, src: m.photoUrl, label: m.name }))

const GRID_SIZES = {
  easy: 4,
  medium: 6,
  hard: 7,
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function createCards(pairCount) {
  const selected = shuffle([...MEMBER_CARDS]).slice(0, pairCount)
  const pairs = selected.flatMap((member) => [
    { ...member, pairId: member.id },
    { ...member, pairId: member.id },
  ])
  return shuffle(pairs).map((card, i) => ({
    ...card,
    uniqueId: `${card.pairId}-${i}`,
    flipped: false,
    matched: false,
  }))
}

export default function MemoryGame() {
  const navigate = useNavigate()
  const { isAuthenticated } = useApp()
  const { show } = useToast()

  const [screen, setScreen] = useState('start')
  const [difficulty, setDifficulty] = useState('easy')
  const [cards, setCards] = useState([])
  const [flippedIds, setFlippedIds] = useState([])
  const [matchedIds, setMatchedIds] = useState(new Set())
  const [moves, setMoves] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [score, setScore] = useState(0)
  const [bestTime, setBestTime] = useState(null)
  const [isLocked, setIsLocked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const timerRef = useRef(null)
  const matchCheckRef = useRef(null)

  const pairCount = GRID_SIZES[difficulty] || 4
  const totalPairs = pairCount
  const matchedPairs = matchedIds.size
  const allMatched = matchedPairs === totalPairs && totalPairs > 0

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (matchCheckRef.current) clearTimeout(matchCheckRef.current)
    }
  }, [])

  useEffect(() => {
    if (screen !== 'playing' || allMatched) return
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => t + 1)
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [screen, allMatched])

  useEffect(() => {
    if (allMatched && screen === 'playing') {
      if (timerRef.current) clearInterval(timerRef.current)
      const finalTime = timeLeft
      const baseScore = 1000
      const movePenalty = Math.max(0, (moves - totalPairs) * 20)
      const timePenalty = finalTime * 5
      const finalScore = Math.max(0, baseScore - movePenalty - timePenalty)
      setScore(finalScore)
      setBestTime(finalTime)
      setScreen('results')
    }
  }, [allMatched, screen, moves, totalPairs, timeLeft])

  const handleStart = useCallback((diff) => {
    setDifficulty(diff)
    setCards(createCards(GRID_SIZES[diff]))
    setFlippedIds([])
    setMatchedIds(new Set())
    setMoves(0)
    setTimeLeft(0)
    setScore(0)
    setBestTime(null)
    setIsLocked(false)
    setScreen('playing')
  }, [])

  const handleCardClick = useCallback((uniqueId) => {
    if (isLocked) return
    if (flippedIds.length >= 2) return

    const card = cards.find((c) => c.uniqueId === uniqueId)
    if (!card || card.matched || flippedIds.includes(uniqueId)) return

    const newFlipped = [...flippedIds, uniqueId]
    setFlippedIds(newFlipped)

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1)
      setIsLocked(true)

      const [first, second] = newFlipped
      const card1 = cards.find((c) => c.uniqueId === first)
      const card2 = cards.find((c) => c.uniqueId === second)

      if (card1.pairId === card2.pairId) {
        matchCheckRef.current = setTimeout(() => {
          setMatchedIds((prev) => new Set([...prev, card1.pairId]))
          setFlippedIds([])
          setIsLocked(false)
        }, 500)
      } else {
        matchCheckRef.current = setTimeout(() => {
          setFlippedIds([])
          setIsLocked(false)
        }, 800)
      }
    }
  }, [cards, flippedIds, isLocked])

  const handleFinish = useCallback(async () => {
    if (!isAuthenticated) return
    setSubmitting(true)
    try {
      const correct = matchedPairs
      const total = totalPairs
      await submitQuizResult({
        score,
        difficulty,
        correct,
        total,
        streak: 0,
        game_type: 'memory',
      })
    } catch {
      // Progress save failed silently
    } finally {
      setSubmitting(false)
    }
  }, [score, difficulty, matchedPairs, totalPairs, isAuthenticated])

  const difficultyLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
  const difficultyColor = { easy: 'var(--c-success)', medium: 'var(--c-warning)', hard: 'var(--c-danger)' }
  const gridCols = { easy: 4, medium: 4, hard: 4 }

  if (screen === 'start') {
    return (
      <div className="page memory-page">
        <div className="memory-start">
          <div className="memory-start__hero">
            <span className="memory-start__icon">🧠</span>
            <h1 className="memory-start__title">Memory Game</h1>
            <p className="memory-start__sub">Match the BTS member pairs!</p>
          </div>
          <div className="memory-start__diffs">
            {['easy', 'medium', 'hard'].map((d) => (
              <button key={d} className="memory-diff" onClick={() => handleStart(d)}>
                <span className="memory-diff__icon" style={{ color: difficultyColor[d] }}>
                  {d === 'easy' ? '⭐' : d === 'medium' ? '⭐⭐' : '⭐⭐⭐'}
                </span>
                <span className="memory-diff__name">{difficultyLabel[d]}</span>
                <span className="memory-diff__desc">
                  {d === 'easy' ? '4x4 grid (4 pairs)' : d === 'medium' ? '4x3 grid (6 pairs)' : '4x4 grid (7 pairs)'}
                </span>
              </button>
            ))}
          </div>
          <div className="memory-start__info">
            <p>Flip cards to find matching member pairs</p>
            <p>Same member = Match! Different members = No match</p>
            <p>Fewer moves and faster time = higher score!</p>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'results') {
    const accuracy = totalPairs > 0 ? Math.round((matchedPairs / totalPairs) * 100) : 0
    return (
      <div className="page memory-page">
        <div className="memory-results">
          <div className="memory-results__hero">
            <span className="memory-results__icon">
              {allMatched ? '🎉' : '💪'}
            </span>
            <h1 className="memory-results__title">
              {allMatched ? 'All Matched!' : 'Great Effort!'}
            </h1>
            <p className="memory-results__sub">
              {allMatched
                ? `You matched all ${totalPairs} member pairs!`
                : `You matched ${matchedPairs} out of ${totalPairs} member pairs.`}
            </p>
          </div>
          <div className="memory-results__stats">
            <div className="memory-stat">
              <span className="memory-stat__value" style={{ color: 'var(--c-success)' }}>{matchedPairs}/{totalPairs}</span>
              <span className="memory-stat__label">Matched</span>
            </div>
            <div className="memory-stat">
              <span className="memory-stat__value" style={{ color: 'var(--c-purple)' }}>{score}</span>
              <span className="memory-stat__label">Score</span>
            </div>
            <div className="memory-stat">
              <span className="memory-stat__value" style={{ color: 'var(--c-info)' }}>{moves}</span>
              <span className="memory-stat__label">Moves</span>
            </div>
            <div className="memory-stat">
              <span className="memory-stat__value" style={{ color: 'var(--c-warning)' }}>{timeLeft}s</span>
              <span className="memory-stat__label">Time</span>
            </div>
          </div>
          {!isAuthenticated && (
            <div className="memory-results__guest">
              <p>Sign in to save your score and track your XP!</p>
            </div>
          )}
          <div className="memory-results__actions">
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

  const cols = gridCols[difficulty] || 4

  return (
    <div className="page memory-page">
      <div className="memory-game">
        <div className="memory-game__hud">
          <div className="memory-hud__left">
            <span className="memory-hud__moves">
              🎯 {moves} moves
            </span>
          </div>
          <div className="memory-hud__center">
            <span className="memory-hud__progress">
              {matchedPairs} / {totalPairs} pairs
            </span>
          </div>
          <div className="memory-hud__right">
            <span className="memory-hud__time">⏱️ {timeLeft}s</span>
          </div>
        </div>

        <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {cards.map((card) => {
            const isFlipped = flippedIds.includes(card.uniqueId) || card.matched
            const isMatched = card.matched
            let cls = 'memory-card'
            if (isFlipped) cls += ' memory-card--flipped'
            if (isMatched) cls += ' memory-card--matched'

            return (
              <button
                key={card.uniqueId}
                className={cls}
                onClick={() => handleCardClick(card.uniqueId)}
                disabled={isMatched || flippedIds.includes(card.uniqueId)}
              >
                <div className="memory-card__inner">
                  <div className="memory-card__front">
                    <span className="memory-card__question">?</span>
                  </div>
                  <div className="memory-card__back">
                    <img src={card.src} alt={card.label} className="memory-card__img" />
                    <span className="memory-card__label">{card.label}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
