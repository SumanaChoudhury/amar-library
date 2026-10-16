import { useState } from 'react'
import { supabase } from '../lib/supabase'

function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setIsError(false)
    setLoading(true)

    const trimmedEmail = email.trim()

    if (!trimmedEmail || !password) {
      setMessage('Please enter both email and password.')
      setIsError(true)
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters long.')
      setIsError(true)
      setLoading(false)
      return
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        })

        if (error) throw error
        setMessage('Signed in successfully! Welcome back.')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        })

        if (error) throw error

        if (data.session) {
          setMessage('Account created! Welcome to your bookshelf.')
        } else {
          setMessage(
            'Account registered! Please check your email inbox to confirm your account, then sign in.'
          )
        }
      }
    } catch (error) {
      setIsError(true)
      console.error('Auth error:', error)
      setMessage(
        error.message?.includes('Invalid login credentials')
          ? 'Incorrect email or password. Please try again or create an account.'
          : error.message || 'Authentication failed. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <section className="auth-card" aria-label="Sign in or register">
        <div className="auth-header-decor">
          <span className="auth-flower" aria-hidden="true">❧</span>
          <span className="eyebrow">YOUR LITTLE CORNER</span>
        </div>

        <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>

        <p className="auth-subtitle">
          {isLogin
            ? 'Sign in to return to your personal bookshelf and reading memories.'
            : 'New here? Register to save books, track reading progress, and build your shelves.'}
        </p>

        {/* Tab switch between Sign In and Register */}
        <div className="auth-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(true)
              setMessage('')
              setIsError(false)
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(false)
              setMessage('')
              setIsError(false)
            }}
          >
            First Time? Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="auth-email">
            <span>Email address *</span>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reader@bookshelf.com"
              autoComplete="email"
              required
            />
          </label>

          <label htmlFor="auth-password">
            <span>Password *</span>
            <div className="password-input-wrap">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading
              ? 'Please wait...'
              : isLogin
                ? 'Open Bookshelf →'
                : 'Create My Bookshelf →'}
          </button>
        </form>

        {message && (
          <div
            className={`auth-feedback ${isError ? 'error' : 'success'}`}
            role="status"
          >
            {message}
          </div>
        )}

        <div className="auth-footer-note">
          <button
            type="button"
            className="auth-switch"
            onClick={() => {
              setIsLogin(!isLogin)
              setMessage('')
              setIsError(false)
            }}
          >
            {isLogin
              ? 'First time here? Register your account'
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default Auth
