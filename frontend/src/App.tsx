import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import { Radio, SlidersHorizontal, Info } from 'lucide-react'
import PredictPage from './pages/PredictPage'
import WhatIfPage from './pages/WhatIfPage'
import AboutPage from './pages/AboutPage'
import { ParticleWave } from './components/ui/particle-wave'

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
    document.body.classList.remove('menu-open')
  }, [location.pathname])

  // Setup animations and menu listeners
  useEffect(() => {
    // 1. Add is-in class on animationend
    const onAnimationEnd = (e: AnimationEvent) => {
      const target = e.target as HTMLElement
      if (target && target.classList.contains('appear')) {
        target.classList.add('is-in')
      }
    }
    document.addEventListener('animationend', onAnimationEnd)

    // 2. JS Fallback: after two rAFs, if no animations running, add is-in
    let raf1: number, raf2: number
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const appears = document.querySelectorAll<HTMLElement>('.appear')
        appears.forEach(el => {
          const anims = el.getAnimations ? el.getAnimations() : []
          const hasActive = anims.some(a => a.playState === 'running' || a.playState === 'finished')
          if (!hasActive) {
            el.classList.add('is-in')
          }
        })
      })
    })

    // 3. Close menu on Escape
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        document.body.classList.remove('menu-open')
      }
    }
    window.addEventListener('keydown', onKeyDown)

    // 4. Close menu if resized >= 901px
    const onResize = () => {
      if (window.innerWidth >= 901) {
        setMenuOpen(false)
        document.body.classList.remove('menu-open')
      }
    }
    window.addEventListener('resize', onResize)

    return () => {
      document.removeEventListener('animationend', onAnimationEnd)
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const toggleMenu = () => {
    setMenuOpen(prev => {
      const next = !prev
      if (next) {
        document.body.classList.add('menu-open')
      } else {
        document.body.classList.remove('menu-open')
      }
      return next
    })
  }

  return (
    <>
      {/* Background Ambience Layers */}
      <ParticleWave />
      <div className="grain" aria-hidden="true" />
      <div className="hero-photo" aria-hidden="true" />

      <div className="page">
        {/* Mobile Menu Backdrop */}
        <div
          className="menu-backdrop"
          onClick={() => {
            setMenuOpen(false)
            document.body.classList.remove('menu-open')
          }}
          aria-hidden="true"
        />

        {/* Header — 3-Column Grid */}
        <header className="header">
          {/* Left: Logo */}
          <Link
            to="/"
            className="logo appear appear--scale"
            style={{ '--d': '0.08s' } as React.CSSProperties}
            aria-label="5G Slice Advisor"
          >
            <svg className="logo-mark" viewBox="0 0 24 24" fill="currentColor">
              <g transform="rotate(-30 12 12)">
                <circle cx="7.3" cy="3.2" r="1.45" />
                <rect x="5.5" y="4.7" width="3.6" height="14.6" rx="1.8" />
                <rect x="14.9" y="4.7" width="3.6" height="14.6" rx="1.8" />
                <circle cx="16.7" cy="20.8" r="1.45" />
              </g>
            </svg>
            <span>
              5G Slice<span className="logo-suffix">.advisor</span>
            </span>
          </Link>

          {/* Center: Nav Pills */}
          <nav id="site-nav" aria-label="Primary">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-pill appear appear--scale ${isActive ? 'active' : ''}`}
              style={{ '--d': '0.16s' } as React.CSSProperties}
            >
              <Radio size={14} />
              <span>Predictor</span>
            </NavLink>
            <NavLink
              to="/what-if"
              className={({ isActive }) => `nav-pill appear appear--soft ${isActive ? 'active' : ''}`}
              style={{ '--d': '0.28s' } as React.CSSProperties}
            >
              <SlidersHorizontal size={14} />
              <span>What-If</span>
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) => `nav-pill appear appear--soft ${isActive ? 'active' : ''}`}
              style={{ '--d': '0.52s' } as React.CSSProperties}
            >
              <Info size={14} />
              <span>Architecture</span>
            </NavLink>
          </nav>

          {/* Right: Burger */}
          <div className="header-right">
            <button
              className="burger-btn appear appear--scale"
              style={{ '--d': '0.34s' } as React.CSSProperties}
              onClick={toggleMenu}
              aria-controls="site-nav"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              <span className="burger-bar" />
              <span className="burger-bar" />
              <span className="burger-bar" />
            </button>
          </div>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<PredictPage />} />
            <Route path="/what-if" element={<WhatIfPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>
      </div>
    </>
  )
}

export default App
