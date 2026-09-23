import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { getGameProgress } from '../utils/api.js'
import GameCard from '../components/game/GameCard.jsx'
import '../styles/gamecentre.css'

export default function GameCentre() {
  const { isAuthenticated } = useApp()
  const [progress, setProgress] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) return
    let active = true
    getGameProgress()
      .then((res) => {
        if (active && res.progress) setProgress(res.progress)
      })
      .catch(() => {})
    return () => { active = false }
  }, [isAuthenticated])

  return (
    <div className="page gamecentre">
      <div className="page-head">
        <div>
          <h1 className="page-title">Game Centre</h1>
          <p className="page-sub">Play, learn, and earn XP!</p>
        </div>
      </div>

      {progress && progress.games_played > 0 && (
        <div className="gamecentre__stats">
          <div className="stat-card">
            <span className="stat-card__value">{progress.xp}</span>
            <span className="stat-card__label">Total XP</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{progress.best_score}</span>
            <span className="stat-card__label">Best Score</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{progress.games_played}</span>
            <span className="stat-card__label">Games Played</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{progress.best_streak}</span>
            <span className="stat-card__label">Best Streak</span>
          </div>
        </div>
      )}

      {!isAuthenticated && (
        <div className="gamecentre__guest">
          <p>Sign in to save your progress and earn XP!</p>
        </div>
      )}

      <div className="gamecentre__grid">
        <GameCard
          title="Guess the Song"
          description="Listen to the clip and identify BTS songs from the 2026 catalogue!"
          icon="🎵"
          to="/games/guess-song"
          badge="PLAY"
        />
        <GameCard
          title="BTS Quiz"
          description="Trivia across every era — from debut to ARIRANG (2026)."
          icon="💜"
          to="/games/quiz"
          badge="PLAY"
        />
        <GameCard
          title="Memory Game"
          description="Match the BTS member pairs in this classic card game!"
          icon="🧠"
          to="/games/memory"
          badge="PLAY"
        />
        <GameCard
          title="Guess the Member"
          description="Can you identify the BTS members from their photos?"
          icon="👤"
          to="/games/guess-member"
          badge="PLAY"
        />
      </div>
    </div>
  )
}
