import { useState } from 'react'
import { supabase } from './supabaseClient.js'

const SITE_URL = 'https://littlecosmos.app'

const wrap = {
  position: 'fixed', inset: 0,
  background: '#0c0a12',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  fontFamily: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
  color: '#e8e0d0',
}

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, padding: '36px 32px',
  width: 340, maxWidth: '90vw',
  backdropFilter: 'blur(12px)',
}

const inp = {
  width: '100%', padding: '12px 14px', minHeight: 44,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, color: '#e8e0d0',
  fontSize: 15, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
  marginBottom: 12,
}

const btn = {
  width: '100%', padding: '11px 0',
  background: 'linear-gradient(135deg, #c9a96e, #b8944f)',
  border: 'none', borderRadius: 8,
  color: '#1a1520', fontSize: 15,
  fontWeight: 600, fontFamily: 'inherit',
  cursor: 'pointer', marginTop: 4,
}

const link = {
  background: 'none', border: 'none',
  color: '#c9a96e', fontSize: 13,
  fontFamily: 'inherit', cursor: 'pointer',
  padding: 0, textDecoration: 'underline',
  opacity: 0.8,
}

export default function AuthScreen({ initialMode = 'login', onBack }) {
  const [mode, setMode] = useState(initialMode) // login | signup | forgot | verify
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resendStatus, setResendStatus] = useState('') // '' | 'sending' | 'sent' | error message

  const clearState = () => { setError(''); setMessage(''); setPassword(''); setConfirmPassword(''); setResendStatus(''); setShowPassword(false) }

  const pwWrap = { position: 'relative', width: '100%' }
  const eyeBtn = {
    position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: '#e8e0d0', opacity: 0.5,
    cursor: 'pointer', fontSize: 18, padding: '8px 10px', lineHeight: 1,
    marginBottom: 12,
  }
  const pwInp = { ...inp, paddingRight: 38 }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (authError) setError(authError.message === 'Invalid login credentials' ? 'Email or password not recognized. Try again or reset your password.' : authError.message)
    } catch {
      setLoading(false)
      setError('Unable to reach the server. Check your connection and try again.')
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')
    if (!displayName.trim()) { setError('Please enter your name'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 10) { setError('Password must be at least 10 characters'); return }
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() },
          emailRedirectTo: SITE_URL,
        },
      })
      setLoading(false)
      if (authError) { setError(authError.message); return }
      setMode('verify')
      setMessage(`We sent a verification link to ${email}. You can sign in now to start exploring — verify later to unlock sharing features.`)
    } catch (err) {
      setLoading(false)
      setError('Unable to reach the server. Check your connection and try again.')
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL })
      setLoading(false)
      if (authError) { setError(authError.message); return }
      setMessage('Check your email for a password reset link.')
    } catch {
      setLoading(false)
      setError('Unable to reach the server. Check your connection and try again.')
    }
  }

  const switchMode = (m) => { clearState(); setMode(m) }

  return (
    <div style={wrap} role="main">
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      {onBack && (
        <button onClick={onBack} aria-label="Back to landing page" style={{
          position: 'absolute', top: 20, left: 24,
          background: 'none', border: 'none', color: '#c9a96e',
          fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', opacity: 0.7,
        }}>
          ← Back
        </button>
      )}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: 2, opacity: 0.9 }}>Little Cosmos</div>
        <div style={{ fontSize: 13, opacity: 0.4, marginTop: 4 }}>your worlds, your stories</div>
      </div>

      <div key={mode} style={{ ...card, animation: 'fadeIn .3s ease' }}>
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, textAlign: 'center' }}>Sign In</div>
            <input style={inp} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="email" inputMode="email" />
            <div style={pwWrap}>
              <input style={pwInp} type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
              <button type="button" style={eyeBtn} onClick={() => setShowPassword(v => !v)} tabIndex={-1} aria-label="Toggle password visibility">{showPassword ? '\u{1F441}\u200D\u{1F5E8}' : '\u{1F441}'}</button>
            </div>
            {error && <div role="alert" style={{ color: '#e57373', fontSize: 13, marginBottom: 8 }}>{error}</div>}
            <button style={{ ...btn, opacity: loading ? 0.6 : 1 }} disabled={loading} type="submit">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button type="button" style={link} onClick={() => switchMode('forgot')}>Forgot password?</button>
              <button type="button" style={link} onClick={() => switchMode('signup')}>Create account</button>
            </div>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, textAlign: 'center' }}>Create Account</div>
            <input style={inp} type="text" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} required autoFocus autoComplete="name" />
            <input style={inp} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
            <div style={pwWrap}>
              <input style={pwInp} type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
              <button type="button" style={eyeBtn} onClick={() => setShowPassword(v => !v)} tabIndex={-1} aria-label="Toggle password visibility">{showPassword ? '\u{1F441}\u200D\u{1F5E8}' : '\u{1F441}'}</button>
            </div>
            <div style={{ fontSize: 11, color: '#e8e0d0', opacity: 0.35, marginTop: -8, marginBottom: 10, paddingLeft: 2 }}>At least 10 characters</div>
            <div style={pwWrap}>
              <input style={pwInp} type={showPassword ? 'text' : 'password'} placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
              <button type="button" style={eyeBtn} onClick={() => setShowPassword(v => !v)} tabIndex={-1} aria-label="Toggle password visibility">{showPassword ? '\u{1F441}\u200D\u{1F5E8}' : '\u{1F441}'}</button>
            </div>
            {error && <div role="alert" style={{ color: '#e57373', fontSize: 13, marginBottom: 8 }}>{error}</div>}
            <button style={{ ...btn, opacity: loading ? 0.6 : 1 }} disabled={loading} type="submit">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button type="button" style={link} onClick={() => switchMode('login')}>Already have an account?</button>
            </div>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, textAlign: 'center' }}>Reset Password</div>
            <input style={inp} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="email" inputMode="email" />
            {error && <div role="alert" style={{ color: '#e57373', fontSize: 13, marginBottom: 8 }}>{error}</div>}
            {message && <div role="status" style={{ color: '#a5d6a7', fontSize: 13, marginBottom: 8 }}>{message}</div>}
            <button style={{ ...btn, opacity: loading ? 0.6 : 1 }} disabled={loading} type="submit">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button type="button" style={link} onClick={() => switchMode('login')}>Back to sign in</button>
            </div>
          </form>
        )}

        {mode === 'verify' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Verify Your Email</div>
            <div style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6, marginBottom: 8 }}>{message}</div>
            {email && <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 20 }}>Sent to <span style={{ color: '#c9a96e' }}>{email}</span></div>}
            <button
              type="button"
              style={{ ...btn, background: 'rgba(255,255,255,0.06)', color: '#e8e0d0', fontWeight: 400, fontSize: 13, marginBottom: 12, opacity: resendStatus === 'sending' ? 0.5 : 0.8 }}
              disabled={resendStatus === 'sending' || resendStatus === 'sent'}
              onClick={async () => {
                setResendStatus('sending')
                try {
                  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: SITE_URL } })
                  if (error) { setResendStatus(error.message); setTimeout(() => setResendStatus(''), 4000) }
                  else { setResendStatus('sent'); setTimeout(() => setResendStatus(''), 4000) }
                } catch { setResendStatus('Something went wrong'); setTimeout(() => setResendStatus(''), 4000) }
              }}
            >
              {resendStatus === 'sending' ? 'Sending...' : resendStatus === 'sent' ? 'Sent!' : 'Resend verification email'}
            </button>
            {resendStatus && resendStatus !== 'sending' && resendStatus !== 'sent' && (
              <div style={{ color: '#e57373', fontSize: 12, marginBottom: 8 }}>{resendStatus}</div>
            )}
            <button type="button" style={link} onClick={() => switchMode('login')}>Back to sign in</button>
          </div>
        )}
      </div>
    </div>
  )
}
