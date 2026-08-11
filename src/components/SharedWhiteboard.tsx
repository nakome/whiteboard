'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getSharedBoard } from '@/lib/whiteboard/boards-api'
import type { SharedBoard as SharedBoardData } from '@/lib/whiteboard/types'
import { createMarkdownToHtml } from '@/lib/whiteboard/markdown'
import { registerWhiteboardComponents } from '@/lib/whiteboard/componentes/index.js'
import { initWhiteboard } from '@/lib/whiteboard/engine.js'
import '@/lib/whiteboard/whiteboard.css'

type EngineApi = {
  destroy: () => void
}

type Props = {
  token: string
}

export default function SharedWhiteboard({ token }: Props) {
  const boardRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<EngineApi | null>(null)
  const [board, setBoard] = useState<SharedBoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const markdownToHtml = useMemo(() => createMarkdownToHtml(), [])

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as 'light' | 'dark' | null) || 'light'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        await registerWhiteboardComponents()
        const shared = await getSharedBoard(token)
        if (cancelled) return
        if (!shared) {
          setError('Pizarra no encontrada o el enlace ya no es válido')
          return
        }
        setBoard(shared)
      } catch (err) {
        console.error(err)
        if (!cancelled) setError('No se pudo cargar la pizarra compartida')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!board || !boardRef.current || loading) return

    engineRef.current?.destroy()
    boardRef.current.innerHTML = ''

    const api = initWhiteboard({
      container: boardRef.current,
      initialContent: board.content || { cards: [], arrows: [] },
      onSave: undefined,
      markdownToHtml,
      readOnly: true,
    }) as EngineApi

    engineRef.current = api

    return () => {
      api.destroy()
      engineRef.current = null
    }
  }, [board, loading, markdownToHtml])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }

  if (loading) {
    return <div className="wb-loading">Cargando pizarra…</div>
  }

  if (error || !board) {
    return (
      <div className="wb-share-error">
        <h1>Enlace no disponible</h1>
        <p>{error || 'Pizarra no encontrada'}</p>
      </div>
    )
  }

  return (
    <div className="wb-app-shell wb-share-shell">
      <div ref={boardRef} id="whiteboard" className="wb-root" />

      <button id="theme-toggle" type="button" onClick={toggleTheme} title="Cambiar tema">
        {theme === 'light' ? '🌞' : '🌚'}
      </button>

      <div className="wb-status">
        <span>{board.title || 'Pizarra'}</span>
        <span className="wb-readonly-pill">Solo lectura</span>
      </div>
    </div>
  )
}
