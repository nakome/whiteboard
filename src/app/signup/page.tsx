'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GoogleSignInButton from '@/components/GoogleSignInButton'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const supabase = createClient()
    const origin = window.location.origin
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (data.session) {
      router.replace('/app')
      router.refresh()
      return
    }

    setMessage('Revisa tu email para confirmar la cuenta (si la confirmación está activa).')
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Crear cuenta</h1>
        <p>Regístrate con Google o con email y contraseña.</p>
        <GoogleSignInButton label="Registrarse con Google" />
        <div className="auth-divider" role="separator">
          <span>o con email</span>
        </div>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="auth-error">{error}</p> : null}
        {message ? <p className="auth-ok">{message}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? 'Creando…' : 'Registrarme'}
        </button>
        <p className="auth-footer">
          ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
        </p>
      </form>
    </main>
  )
}
