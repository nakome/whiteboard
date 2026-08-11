const PUTER_SRC = 'https://js.puter.com/v2/'

export type PuterAI = {
  chat: (prompt: string, options?: Record<string, unknown>) => Promise<unknown>
  txt2img: (
    prompt: string,
    optionsOrTestMode?: boolean | Record<string, unknown>
  ) => Promise<HTMLImageElement | string>
}

export type PuterAuth = {
  signIn: (options?: { attempt_temp_user_creation?: boolean }) => Promise<unknown>
  signOut: () => void
  isSignedIn: () => boolean
  getUser: () => Promise<{ username?: string } | null>
}

export type PuterGlobal = {
  ai?: PuterAI
  auth?: PuterAuth
  quiet?: boolean
}

declare global {
  interface Window {
    puter?: PuterGlobal
  }
}

let loadPromise: Promise<PuterGlobal> | null = null

function getPuter(): PuterGlobal | null {
  if (typeof window === 'undefined') return null
  return window.puter ?? null
}

export function isPuterReady(): boolean {
  const puter = getPuter()
  return !!(puter?.ai && typeof puter.ai.chat === 'function')
}

export function loadPuter(): Promise<PuterGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Puter solo funciona en el navegador'))
  }

  const existing = getPuter()
  if (existing?.ai?.chat) {
    existing.quiet = true
    return Promise.resolve(existing)
  }

  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const finish = () => {
      const puter = getPuter()
      if (puter?.ai?.chat) {
        puter.quiet = true
        resolve(puter)
        return true
      }
      return false
    }

    if (finish()) return

    let script =
      document.querySelector<HTMLScriptElement>(`script[data-puter-sdk="v2"]`) ||
      document.querySelector<HTMLScriptElement>(`script[src*="js.puter.com"]`)
    if (!script) {
      script = document.createElement('script')
      script.src = PUTER_SRC
      script.async = true
      script.dataset.puterSdk = 'v2'
      document.head.appendChild(script)
    }

    const onLoad = () => {
      const started = Date.now()
      const poll = window.setInterval(() => {
        if (finish()) {
          window.clearInterval(poll)
          return
        }
        if (Date.now() - started > 15000) {
          window.clearInterval(poll)
          loadPromise = null
          reject(new Error('Puter no respondió a tiempo'))
        }
      }, 100)
    }

    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener(
      'error',
      () => {
        loadPromise = null
        reject(new Error('No se pudo cargar puter.js'))
      },
      { once: true }
    )

    // Script ya estaba en el DOM y pudo haber cargado antes de enganchar listeners
    if ((script as HTMLScriptElement & { readyState?: string }).readyState === 'complete') {
      onLoad()
    }
  })

  return loadPromise
}

export async function ensurePuterAuth(): Promise<PuterGlobal> {
  const puter = await loadPuter()
  if (puter.auth?.isSignedIn?.()) return puter
  if (typeof puter.auth?.signIn === 'function') {
    await puter.auth.signIn()
  }
  return puter
}

export function extractPuterText(response: unknown): string {
  if (typeof response === 'string') return response
  const r = response as {
    message?: string | { content?: string | Array<{ text?: string }> }
    content?: string | Array<{ text?: string } | string>
    text?: string
    choices?: Array<{ message?: { content?: string } }>
  }
  if (typeof r?.message === 'string') return r.message
  if (typeof r?.message?.content === 'string') return r.message.content
  if (Array.isArray(r?.message?.content)) {
    return r.message.content.map((p) => p?.text || '').filter(Boolean).join('\n')
  }
  if (typeof r?.content === 'string') return r.content
  if (Array.isArray(r?.content)) {
    return r.content
      .map((p) => (typeof p === 'string' ? p : p?.text || ''))
      .filter(Boolean)
      .join('\n')
  }
  if (typeof r?.text === 'string') return r.text
  if (typeof r?.choices?.[0]?.message?.content === 'string') {
    return r.choices[0].message.content
  }
  return JSON.stringify(response ?? '')
}

export async function puterChat(
  prompt: string,
  options?: Record<string, unknown>
): Promise<string> {
  const puter = await ensurePuterAuth()
  if (!puter.ai?.chat) throw new Error('puter.ai.chat no disponible')
  const response = await puter.ai.chat(prompt, options)
  return extractPuterText(response)
}

export async function puterTxt2Img(prompt: string): Promise<string> {
  const puter = await ensurePuterAuth()
  if (!puter.ai?.txt2img) throw new Error('puter.ai.txt2img no disponible')
  const result = await puter.ai.txt2img(prompt, { quality: 'low' })
  if (typeof result === 'string') return result
  if (result && typeof result === 'object' && 'src' in result && typeof result.src === 'string') {
    return result.src
  }
  throw new Error('txt2img no devolvió una imagen válida')
}
