import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Auth({ onOtpVerified }) {
  const [authMode, setAuthMode] = useState('login') // 'login' | 'register' | 'forgot'
  const [forgotStep, setForgotStep] = useState('request') // 'request' | 'verify' | 'new_password'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // OTP & New Password state
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)

  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => {
      setCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  // Standard Login & Registration
  async function handleAuthSubmit(event) {
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
      if (authMode === 'login') {
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
          ? 'Incorrect email or password. Please try again or reset your password.'
          : error.message || 'Authentication failed. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  // Forgot Password: Step 1 - Send OTP code to email
  async function handleSendOtp(event) {
    event.preventDefault()
    setMessage('')
    setIsError(false)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setMessage('Please enter your email address to receive an OTP code.')
      setIsError(true)
      return
    }

    setLoading(true)
    try {
      // Send password recovery email containing OTP token/code
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin,
      })

      if (error) throw error

      setCooldown(60)
      setForgotStep('verify')
      setMessage(`Verification code sent to ${trimmedEmail}! Check your inbox and spam folder.`)
    } catch (error) {
      setIsError(true)
      console.error('Send OTP error:', error)
      if (error.message?.toLowerCase().includes('rate limit')) {
        setCooldown(60)
        setMessage(
          'Email rate limit reached (Supabase limits recovery emails to prevent spam). If you already received a code earlier in your inbox or spam folder, click "Already have an OTP code? Enter Code" below to log in! Otherwise, please wait 60 seconds.'
        )
      } else {
        setMessage(error.message || 'Unable to send OTP. Please check your email and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Forgot Password: Step 2 - Verify OTP code & log in
  async function handleVerifyOtp(event) {
    event.preventDefault()
    setMessage('')
    setIsError(false)

    const trimmedEmail = email.trim()
    const trimmedOtp = otp.trim()

    if (!trimmedOtp) {
      setMessage('Please enter the verification code (OTP) sent to your email.')
      setIsError(true)
      return
    }

    setLoading(true)
    try {
      // Attempt verification with 'recovery' type
      let { error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedOtp,
        type: 'recovery',
      })

      if (error) {
        // Fallback to 'email' type if template uses magic OTP
        const fallback = await supabase.auth.verifyOtp({
          email: trimmedEmail,
          token: trimmedOtp,
          type: 'email',
        })
        if (!fallback.error) {
          error = null
        }
      }

      if (error) throw error

      // Notify parent to display new password setup
      if (onOtpVerified) {
        onOtpVerified()
      }

      setForgotStep('new_password')
      setMessage('Code verified! You are now logged in. Please create your new password.')
    } catch (error) {
      setIsError(true)
      console.error('Verify OTP error:', error)
      setMessage(
        error.message?.includes('Token has expired or is invalid')
          ? 'Invalid or expired OTP code. Please request a new code and try again.'
          : error.message || 'Could not verify code. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  // Forgot Password: Step 3 - Set New Password
  async function handleSetNewPassword(event) {
    event.preventDefault()
    setMessage('')
    setIsError(false)

    if (newPassword.length < 6) {
      setMessage('New password must be at least 6 characters long.')
      setIsError(true)
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match. Please re-enter your new password.')
      setIsError(true)
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      setMessage('Password updated successfully! Welcome to your library.')
    } catch (error) {
      setIsError(true)
      console.error('Update password error:', error)
      setMessage(error.message || 'Could not update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <section className="auth-card" aria-label="Authentication">
        <div className="auth-header-decor">
          <span className="auth-flower" aria-hidden="true">❧</span>
          <span className="eyebrow">
            {authMode === 'forgot' ? 'ACCOUNT RECOVERY' : 'AMAR LIBRARY'}
          </span>
        </div>

        {/* Dynamic Titles */}
        {authMode === 'forgot' ? (
          <>
            <h2>
              {forgotStep === 'request'
                ? 'Forgot password?'
                : forgotStep === 'verify'
                  ? 'Enter OTP Code'
                  : 'Create New Password'}
            </h2>
            <p className="auth-subtitle">
              {forgotStep === 'request'
                ? 'Enter your account email to receive a One-Time Password (OTP) to log in and set a new password.'
                : forgotStep === 'verify'
                  ? `Enter the code sent to ${email}. You will be logged in and can create a new password.`
                  : 'Choose a secure new password for your Amar Library account.'}
            </p>
          </>
        ) : (
          <>
            <h2>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="auth-subtitle">
              {authMode === 'login'
                ? 'Sign in to return to your personal bookshelf and reading memories.'
                : 'New here? Register to save books, track reading progress, and build your shelves.'}
            </p>

            {/* Mode switch between Sign In and Register */}
            <div className="auth-mode-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'login'}
                className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('login')
                  setMessage('')
                  setIsError(false)
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'register'}
                className={`auth-tab ${authMode === 'register' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('register')
                  setMessage('')
                  setIsError(false)
                }}
              >
                First Time? Register
              </button>
            </div>
          </>
        )}

        {/* FORGOT PASSWORD FORM: Step 1 (Request OTP) */}
        {authMode === 'forgot' && forgotStep === 'request' && (
          <form onSubmit={handleSendOtp} className="auth-form">
            <label htmlFor="auth-forgot-email">
              <span>Account email address *</span>
              <input
                id="auth-forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reader@bookshelf.com"
                autoComplete="email"
                required
                autoFocus
              />
            </label>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading || cooldown > 0}
            >
              {loading
                ? 'Sending OTP code...'
                : cooldown > 0
                  ? `Wait ${cooldown}s to resend code`
                  : 'Send OTP Code →'}
            </button>

            <button
              type="button"
              className="auth-link-secondary"
              style={{ fontWeight: 600, color: 'var(--forest)' }}
              onClick={() => {
                setForgotStep('verify')
                setMessage('')
                setIsError(false)
              }}
            >
              Already have an OTP code? Enter Code →
            </button>

            <button
              type="button"
              className="auth-link-secondary"
              onClick={() => {
                setAuthMode('login')
                setMessage('')
                setIsError(false)
              }}
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD FORM: Step 2 (Verify OTP) */}
        {authMode === 'forgot' && forgotStep === 'verify' && (
          <form onSubmit={handleVerifyOtp} className="auth-form">
            <label htmlFor="auth-otp">
              <span>Enter 6-digit OTP Code *</span>
              <input
                id="auth-otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="otp-input-field"
                maxLength={8}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
              />
            </label>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Verifying code...' : 'Verify OTP & Log In →'}
            </button>

            <div className="auth-row-actions">
              <button
                type="button"
                className="auth-link-secondary"
                onClick={handleSendOtp}
                disabled={loading || cooldown > 0}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP Code'}
              </button>
              <button
                type="button"
                className="auth-link-secondary"
                onClick={() => {
                  setForgotStep('request')
                  setOtp('')
                  setMessage('')
                }}
              >
                Change Email
              </button>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD FORM: Step 3 (Set New Password) */}
        {authMode === 'forgot' && forgotStep === 'new_password' && (
          <form onSubmit={handleSetNewPassword} className="auth-form">
            <label htmlFor="auth-new-password">
              <span>New password (min 6 characters) *</span>
              <div className="password-input-wrap">
                <input
                  id="auth-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <label htmlFor="auth-confirm-password">
              <span>Confirm new password *</span>
              <input
                id="auth-confirm-password"
                type={showNewPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Saving password...' : 'Save New Password & Enter Library →'}
            </button>
          </form>
        )}

        {/* STANDARD SIGN IN / REGISTER FORM */}
        {authMode !== 'forgot' && (
          <form onSubmit={handleAuthSubmit} className="auth-form">
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
              <div className="label-with-action">
                <span>Password *</span>
                {authMode === 'login' && (
                  <button
                    type="button"
                    className="forgot-password-link"
                    onClick={() => {
                      setAuthMode('forgot')
                      setForgotStep('request')
                      setMessage('')
                      setIsError(false)
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="password-input-wrap">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading
                ? 'Please wait...'
                : authMode === 'login'
                  ? 'Open Bookshelf →'
                  : 'Create My Bookshelf →'}
            </button>
          </form>
        )}

        {/* Status / Feedback message */}
        {message && (
          <div
            className={`auth-feedback ${isError ? 'error' : 'success'}`}
            role="status"
          >
            {message}
          </div>
        )}

        {/* Footer switcher note */}
        {authMode !== 'forgot' && (
          <div className="auth-footer-note">
            <button
              type="button"
              className="auth-switch"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login')
                setMessage('')
                setIsError(false)
              }}
            >
              {authMode === 'login'
                ? 'First time here? Register your account'
                : 'Already have an account? Sign in'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

export default Auth
