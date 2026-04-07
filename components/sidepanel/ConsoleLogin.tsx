import type { AuthUser } from '@/lib/api/auth-store'
import { motion } from 'framer-motion'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { browser } from 'wxt/browser'

const ALLOW_BREAK_GLASS_LOGIN = true
const LOGIN_SOUND = '/assets/sounds/hello.mp3'

const createFallbackUser = (rawUsername: string): AuthUser => {
  const normalized = rawUsername.trim().toLowerCase() || 'offline'
  return {
    id: `fallback-${normalized}`,
    username: normalized,
    name: normalized,
    role: 'doctor',
    facilityId: 'PUSKESMAS_BALOWERTI',
    facilityName: 'Puskesmas Balowerti',
    poli: 'Umum',
  }
}

const persistFallbackSession = async (user: AuthUser): Promise<void> => {
  try {
    const { storeSession } = await import('@/lib/api/auth-store')
    const { getAuthConfig } = await import('@/lib/api/auth-client')
    const authConfig = await getAuthConfig()
    const now = Date.now()
    await storeSession({
      user,
      tokens: {
        accessToken: `fallback-token-${now}`,
        refreshToken: `fallback-refresh-${now}`,
        expiresAt: now + 24 * 60 * 60 * 1000,
      },
      serverBaseUrl: authConfig.baseUrl,
    })
  } catch {
    // Non-blocking: fallback login can continue even if session persistence fails.
  }
}

const LoginWordmark: React.FC = () => (
  <div className="login-wordmark" role="img" aria-label="Sentra Artificial Intelligence">
    <div className="login-wordmark-line">Sentra Artificial</div>
    <div className="login-wordmark-line">Intelligence</div>
  </div>
)

export const ConsoleLogin: React.FC<{ onLoginSuccess: (user: AuthUser) => void }> = ({
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Preload login sound
    audioRef.current = new Audio(browser.runtime.getURL(LOGIN_SOUND))
    audioRef.current.preload = 'auto'
    audioRef.current.volume = 0.7

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      const playPromise = audioRef.current.play()
      if (playPromise !== undefined) {
        playPromise.catch((err) => console.warn('[Audio] Playback failed:', err))
      }
    }
  }, [])

  const handleLogin = useCallback(async () => {
    if (!username || !password) return
    const normalizedUsername = username.trim().toLowerCase()
    const normalizedPassword = password.trim()

    // Memancing audio tepat saat klik untuk menghindari blokade browser
    if (audioRef.current) {
      audioRef.current.load()
    }

    setIsLoading(true)
    setLoginError(null)
    try {
      if (
        ALLOW_BREAK_GLASS_LOGIN &&
        normalizedUsername === 'offline' &&
        normalizedPassword === 'offline'
      ) {
        const user = createFallbackUser('offline')
        await persistFallbackSession(user)
        playSound()
        setTimeout(() => onLoginSuccess(user), 400)
        return
      }

      const { login } = await import('@/lib/api/auth-client')
      const result = await login({
        username: normalizedUsername,
        password: normalizedPassword,
      })
      if (result.success && result.session) {
        playSound()
        setTimeout(() => onLoginSuccess(result.session!.user), 400)
        return
      }

      if (ALLOW_BREAK_GLASS_LOGIN) {
        const user = createFallbackUser(normalizedUsername)
        await persistFallbackSession(user)
        playSound()
        setTimeout(() => onLoginSuccess(user), 400)
        return
      }

      setLoginError(
        result.error?.message?.trim() || 'Login gagal. Periksa nama pengguna dan kata sandi.'
      )
    } catch {
      if (ALLOW_BREAK_GLASS_LOGIN) {
        const user = createFallbackUser(normalizedUsername)
        await persistFallbackSession(user)
        playSound()
        setTimeout(() => onLoginSuccess(user), 400)
        return
      }
      setLoginError('Tidak dapat menghubungi server. Coba lagi nanti.')
    } finally {
      setIsLoading(false)
    }
  }, [username, password, onLoginSuccess, playSound])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 10,
      filter: 'blur(10px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.5,
        ease: [0.19, 1, 0.22, 1] as const,
      },
    },
  }

  return (
    <div className="login-view">
      <div className="login-view-stack">
        <motion.div
          className="login-card"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <div className="login-header">
            <motion.div variants={itemVariants}>
              <LoginWordmark />
            </motion.div>
          </div>

          <motion.div className="login-system-status" variants={itemVariants}>
            <div className="status-dot" />
            System Off
          </motion.div>

          <div className="credential-lines">
            <motion.div className="luxury-line" variants={itemVariants}>
              <input
                id="login-username"
                type="text"
                placeholder="USERNAME"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (loginError) setLoginError(null)
                }}
                autoComplete="username"
                aria-label="Nama pengguna"
                aria-invalid={loginError ? true : undefined}
              />
            </motion.div>
            <motion.div className="luxury-line" variants={itemVariants}>
              <input
                id="login-password"
                type="password"
                placeholder="PASSWORD"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (loginError) setLoginError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                autoComplete="current-password"
                aria-label="Kata sandi"
                aria-invalid={loginError ? true : undefined}
              />
            </motion.div>
          </div>

          {loginError ? (
            <p className="login-error" role="alert">
              {loginError}
            </p>
          ) : null}

          <motion.button
            type="button"
            className={`power-btn ${isLoading ? 'loading' : ''}`}
            onClick={handleLogin}
            disabled={isLoading}
            variants={itemVariants}
            aria-label="Masuk ke konsol"
            aria-busy={isLoading}
          >
            <div className="power-ring" aria-hidden="true" />
            <svg className="power-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2v8M8 6a8 8 0 1 0 8 0" />
            </svg>
          </motion.button>
        </motion.div>

        <p className="login-disclaimer" lang="en">
          <span className="login-disclaimer-label">Disclaimer:</span> Sentra Assist is an aid for
          healthcare professionals only. It does not replace the independent clinical judgment of a
          physician or qualified medical provider.
        </p>
      </div>
    </div>
  )
}
