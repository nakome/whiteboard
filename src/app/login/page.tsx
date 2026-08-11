'use client'

import { FormEvent, Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GoogleSignInButton from '@/components/GoogleSignInButton'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'auth' ? 'No se pudo completar el login. Inténtalo de nuevo.' : null
  )
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    router.replace('/app')
    router.refresh()
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <h1>Pizarra</h1>
      <p>Inicia sesión para acceder a tus tableros.</p>
      <GoogleSignInButton />
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
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error ? <p className="auth-error">{error}</p> : null}
      <button type="submit" disabled={loading}>
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="auth-footer">
        ¿No tienes cuenta? <Link href="/signup">Regístrate</Link>
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <Suspense fallback={<div className="auth-card">Cargando…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
