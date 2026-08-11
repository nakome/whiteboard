'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  label?: string
}

export default function GoogleSignInButton({ label = 'Continuar con Google' }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const origin = window.location.origin
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
    // On success the browser redirects away
  }

  return (
    <div className="auth-oauth">
      <button type="button" className="auth-oauth-btn" disabled={loading} onClick={() => void onClick()}>
        <span className="auth-oauth-icon" aria-hidden="true">
          G
        </span>
        {loading ? 'Redirigiendo…' : label}
      </button>
      {error ? <p className="auth-error">{error}</p> : null}
    </div>
  )
}
