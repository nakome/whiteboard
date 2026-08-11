'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createBoard,
  deleteBoard,
  disableShare,
  enableShare,
  ensureDefaultBoard,
  listBoards,
  renameBoard,
  saveBoardContent,
} from '@/lib/whiteboard/boards-api'
import type { Board, BoardContent } from '@/lib/whiteboard/types'
import { createMarkdownToHtml } from '@/lib/whiteboard/markdown'
import { templates as shortcodeTemplates } from '@/lib/whiteboard/shortcodeTemplates'
import { registerWhiteboardComponents } from '@/lib/whiteboard/componentes/index.js'
import { initWhiteboard } from '@/lib/whiteboard/engine.js'
import { isPuterReady, loadPuter, puterChat, puterTxt2Img } from '@/lib/puter'
import FileManagerModal from '@/components/FileManagerModal'
import '@/lib/whiteboard/whiteboard.css'

type EngineApi = {
  getContent: () => BoardContent
  setContent: (content: BoardContent) => void
  destroy: () => void
  createCardFromTemplate: (opts: {
    title?: string
    content?: string
    x?: number
    y?: number
    width?: number
    height?: number
  }) => void
  clear: () => void
}

type Props = {
  userId: string
  userEmail: string
}

export default function WhiteboardApp({ userId, userEmail }: Props) {
  const router = useRouter()
  const boardRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<EngineApi | null>(null)
  const activeBoardIdRef = useRef<string | null>(null)

  const [boards, setBoards] = useState<Board[]>([])
  const [activeBoard, setActiveBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [boardsOpen, setBoardsOpen] = useState(false)
  const [shortcodesOpen, setShortcodesOpen] = useState(false)
  const [shortcodeQuery, setShortcodeQuery] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [puterReady, setPuterReady] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [creatingBoard, setCreatingBoard] = useState(false)
  const [newBoardTitle, setNewBoardTitle] = useState('Nueva pizarra')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [fmOpen, setFmOpen] = useState(false)
  const [shareBusyId, setShareBusyId] = useState<string | null>(null)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)

  const markdownToHtml = useMemo(() => createMarkdownToHtml(), [])

  const filteredTemplates = useMemo(() => {
    const q = shortcodeQuery.trim().toLowerCase()
    if (!q) return shortcodeTemplates
    return shortcodeTemplates.filter((t: { text?: string; title?: string; content?: string }) => {
      return [t.text, t.title, t.content].some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [shortcodeQuery])

  const persist = useCallback(async (content: BoardContent) => {
    const id = activeBoardIdRef.current
    if (!id) return
    setSaving(true)
    try {
      await saveBoardContent(id, content)
      setBoards((prev) =>
        prev.map((b) =>
          b.id === id ? { ...b, content, updated_at: new Date().toISOString() } : b
        )
      )
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar el tablero')
    } finally {
      setSaving(false)
    }
  }, [])

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
        const board = await ensureDefaultBoard(userId)
        const all = await listBoards()
        if (cancelled) return
        setBoards(all)
        setActiveBoard(board)
        activeBoardIdRef.current = board.id
      } catch (err) {
        console.error(err)
        if (!cancelled) setError('No se pudieron cargar los tableros')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (!activeBoard || !boardRef.current || loading) return

    engineRef.current?.destroy()
    boardRef.current.innerHTML = ''

    const api = initWhiteboard({
      container: boardRef.current,
      initialContent: activeBoard.content || { cards: [], arrows: [] },
      onSave: (content: BoardContent) => {
        void persist(content)
      },
      markdownToHtml,
    }) as EngineApi

    engineRef.current = api

    return () => {
      api.destroy()
      engineRef.current = null
    }
  }, [activeBoard?.id, loading, markdownToHtml, persist])

  useEffect(() => {
    let cancelled = false
    void loadPuter()
      .then(() => {
        if (!cancelled) setPuterReady(true)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setPuterReady(false)
      })

    const timer = window.setInterval(() => {
      if (isPuterReady()) {
        setPuterReady(true)
        window.clearInterval(timer)
      }
    }, 400)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }

  async function onLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  async function switchBoard(board: Board) {
    setActiveBoard(board)
    activeBoardIdRef.current = board.id
    setBoardsOpen(false)
  }

  function startRename(board: Board) {
    setConfirmDeleteId(null)
    setCreatingBoard(false)
    setRenamingId(board.id)
    setRenameValue(board.title)
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  async function submitRename(board: Board) {
    const title = renameValue.trim()
    if (!title) {
      setError('El título no puede estar vacío')
      return
    }
    if (title === board.title) {
      cancelRename()
      return
    }
    try {
      await renameBoard(board.id, title)
      const all = await listBoards()
      setBoards(all)
      if (activeBoard?.id === board.id) {
        setActiveBoard({ ...board, title })
      }
      cancelRename()
    } catch (err) {
      console.error(err)
      setError('No se pudo renombrar')
    }
  }

  async function submitCreateBoard() {
    const title = newBoardTitle.trim() || 'Nueva pizarra'
    try {
      const board = await createBoard(userId, title)
      const all = await listBoards()
      setBoards(all)
      setCreatingBoard(false)
      setNewBoardTitle('Nueva pizarra')
      await switchBoard(board)
    } catch (err) {
      console.error(err)
      setError('No se pudo crear el tablero')
    }
  }

  async function onDeleteBoard(board: Board) {
    if (boards.length <= 1) {
      setError('Debes conservar al menos un tablero')
      return
    }
    if (confirmDeleteId !== board.id) {
      setRenamingId(null)
      setCreatingBoard(false)
      setConfirmDeleteId(board.id)
      return
    }
    try {
      await deleteBoard(board.id)
      const all = await listBoards()
      setBoards(all)
      setConfirmDeleteId(null)
      if (activeBoard?.id === board.id) {
        await switchBoard(all[0])
      }
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar')
    }
  }

  function shareUrlFor(board: Board): string | null {
    if (!board.share_token) return null
    return `${window.location.origin}/share/${board.share_token}`
  }

  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      window.prompt('Copia este enlace:', text)
      return false
    }
  }

  async function onShareBoard(board: Board) {
    setShareBusyId(board.id)
    setShareFeedback(null)
    setError(null)
    try {
      const existing = shareUrlFor(board)
      if (existing) {
        const ok = await copyText(existing)
        setShareFeedback(ok ? `Enlace copiado: ${existing}` : `Enlace: ${existing}`)
        return
      }

      const { board: updated, shareUrl } = await enableShare(board.id)
      setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
      if (activeBoard?.id === updated.id) {
        setActiveBoard(updated)
      }
      const ok = await copyText(shareUrl)
      setShareFeedback(ok ? `Enlace copiado: ${shareUrl}` : `Enlace: ${shareUrl}`)
    } catch (err) {
      console.error(err)
      setError('No se pudo compartir la pizarra')
    } finally {
      setShareBusyId(null)
    }
  }

  async function onUnshareBoard(board: Board) {
    setShareBusyId(board.id)
    setShareFeedback(null)
    setError(null)
    try {
      const updated = await disableShare(board.id)
      setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
      if (activeBoard?.id === updated.id) {
        setActiveBoard(updated)
      }
      setShareFeedback('Compartir desactivado')
    } catch (err) {
      console.error(err)
      setError('No se pudo dejar de compartir')
    } finally {
      setShareBusyId(null)
    }
  }

  function insertShortcode(template: { title?: string; content?: string }) {
    engineRef.current?.createCardFromTemplate({
      x: 120,
      y: 120,
      width: 340,
      height: 180,
      title: template.title || 'Shortcode',
      content: template.content || '',
    })
    setShortcodesOpen(false)
  }

  async function runAI(mode: 'ask' | 'generate' | 'image') {
    const prompt = aiPrompt.trim()
    if (!prompt) return

    setAiBusy(true)
    setError(null)
    try {
      if (mode === 'ask') {
        const instruction = [
          'Responde en español usando markdown claro y breve.',
          'No devuelvas JSON, solo la respuesta en texto markdown.',
          `Pregunta: ${prompt}`,
        ].join('\n')
        const answer = await puterChat(instruction)
        engineRef.current?.createCardFromTemplate({
          x: 160,
          y: 120,
          width: 420,
          height: 280,
          title: 'Respuesta IA',
          content: `### Pregunta\n${prompt}\n\n---\n\n${answer}`,
        })
      } else if (mode === 'generate') {
        const instruction = [
          'Genera únicamente JSON válido para un whiteboard.',
          'Esquema exacto:',
          '{"cards":[{"title":"string","content":"markdown","x":120,"y":90,"width":260,"height":160}],"arrows":[{"from":0,"to":1}]}',
          'No incluyas texto adicional, ni markdown, ni explicación.',
          `Tema: ${prompt}`,
        ].join('\n')
        const raw = await puterChat(instruction)
        const parsed = JSON.parse(extractJson(raw))
        const content = normalizeAIBoard(parsed)
        engineRef.current?.setContent(content)
        await persist(content)
      } else {
        const imageSrc = await puterTxt2Img(prompt)
        engineRef.current?.createCardFromTemplate({
          x: 140,
          y: 100,
          width: 360,
          height: 320,
          title: 'Imagen IA',
          content: `![${prompt.replace(/[\[\]]/g, '')}](${imageSrc})\n\n_${prompt}_`,
        })
      }
      setAiOpen(false)
      setAiPrompt('')
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Error al usar Puter AI'
      setError(message.includes('popup') || message.includes('auth')
        ? 'Inicia sesión en Puter (permite el popup) para usar la IA'
        : 'Error al usar Puter AI')
    } finally {
      setAiBusy(false)
    }
  }

  if (loading) {
    return <div className="wb-loading">Cargando pizarra…</div>
  }

  return (
    <div className="wb-app-shell">
      <div ref={boardRef} id="whiteboard" className="wb-root" />

      <button
        id="filemanager-open"
        className="filemanager-toggle fm-open-btn"
        title="Gestor de archivos"
        type="button"
        onClick={() => setFmOpen(true)}
      >
        📁
      </button>
      <button
        id="shortcodes-open"
        className="shortcodes-toggle"
        title="Insertar shortcodes"
        type="button"
        onClick={() => setShortcodesOpen(true)}
      >
        ✨
      </button>
      <button
        id="ai-generate-open"
        className="filemanager-toggle whiteboard-ai-toggle"
        title={puterReady ? 'Asistente IA (Puter)' : 'Cargando Puter…'}
        type="button"
        aria-busy={!puterReady}
        onClick={() => {
          if (!puterReady) {
            setError('Puter aún se está cargando…')
            void loadPuter()
              .then(() => setPuterReady(true))
              .catch(() => setError('No se pudo cargar Puter.js'))
            return
          }
          setAiOpen(true)
        }}
      >
        🤖
      </button>
      <button
        id="boards-open"
        className="filemanager-toggle boards-toggle"
        title="Gestionar pizarras"
        type="button"
        onClick={() => setBoardsOpen(true)}
      >
        📋
      </button>
      <button id="theme-toggle" type="button" onClick={toggleTheme}>
        {theme === 'light' ? '🌞' : '🌚'}
      </button>

      <FileManagerModal open={fmOpen} userId={userId} onClose={() => setFmOpen(false)} />

      <div className="wb-status">
        <span>{activeBoard?.title || 'Pizarra'}</span>
        <span>{saving ? 'Guardando…' : 'Sincronizado'}</span>
        <span>{userEmail}</span>
        <button type="button" onClick={() => void onLogout()}>
          Salir
        </button>
      </div>

      {error ? (
        <div className="wb-toast-error" onClick={() => setError(null)}>
          {error}
        </div>
      ) : null}

      {boardsOpen ? (
        <div className="wb-modal" onClick={() => setBoardsOpen(false)}>
          <div className="wb-modal-panel" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>Tus pizarras</h2>
              <button type="button" onClick={() => setBoardsOpen(false)}>
                ×
              </button>
            </header>
            <div className="wb-modal-body">
              {shareFeedback ? (
                <p className="wb-share-feedback" role="status">
                  {shareFeedback}
                </p>
              ) : null}
              {creatingBoard ? (
                <div className="wb-inline-form">
                  <input
                    className="wb-search"
                    value={newBoardTitle}
                    onChange={(e) => setNewBoardTitle(e.target.value)}
                    placeholder="Título del tablero"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitCreateBoard()
                      if (e.key === 'Escape') setCreatingBoard(false)
                    }}
                  />
                  <div className="wb-board-actions">
                    <button type="button" className="wb-primary" onClick={() => void submitCreateBoard()}>
                      Crear
                    </button>
                    <button type="button" onClick={() => setCreatingBoard(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="wb-primary"
                  onClick={() => {
                    setConfirmDeleteId(null)
                    setRenamingId(null)
                    setCreatingBoard(true)
                    setNewBoardTitle('Nueva pizarra')
                  }}
                >
                  + Nueva pizarra
                </button>
              )}
              <ul className="wb-board-list">
                {boards.map((board) => (
                  <li key={board.id} className={board.id === activeBoard?.id ? 'is-active' : ''}>
                    {renamingId === board.id ? (
                      <div className="wb-inline-form">
                        <input
                          className="wb-search"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void submitRename(board)
                            if (e.key === 'Escape') cancelRename()
                          }}
                        />
                        <div className="wb-board-actions">
                          <button type="button" className="wb-primary" onClick={() => void submitRename(board)}>
                            Guardar
                          </button>
                          <button type="button" onClick={cancelRename}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="wb-board-open"
                          onClick={() => void switchBoard(board)}
                        >
                          {board.title}
                        </button>
                        <div className="wb-board-actions">
                          <button type="button" onClick={() => startRename(board)}>
                            Renombrar
                          </button>
                          <button
                            type="button"
                            disabled={shareBusyId === board.id}
                            onClick={() => void onShareBoard(board)}
                          >
                            {board.share_token ? 'Copiar enlace' : 'Compartir'}
                          </button>
                          {board.share_token ? (
                            <button
                              type="button"
                              disabled={shareBusyId === board.id}
                              onClick={() => void onUnshareBoard(board)}
                            >
                              Dejar de compartir
                            </button>
                          ) : null}
                          <button type="button" onClick={() => void onDeleteBoard(board)}>
                            {confirmDeleteId === board.id ? 'Confirmar borrar' : 'Borrar'}
                          </button>
                          {confirmDeleteId === board.id ? (
                            <button type="button" onClick={() => setConfirmDeleteId(null)}>
                              Cancelar
                            </button>
                          ) : null}
                        </div>
                        {board.share_token ? (
                          <p className="wb-share-badge">Compartida (solo lectura)</p>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {shortcodesOpen ? (
        <div className="shortcodes-modal" onClick={() => setShortcodesOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✨ Insertar Shortcode</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShortcodesOpen(false)}
                aria-label="Cerrar"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                value={shortcodeQuery}
                onChange={(e) => setShortcodeQuery(e.target.value)}
                placeholder="Buscar shortcode..."
                className="shortcodes-search"
                autoFocus
              />
              <div className="shortcodes-list">
                {filteredTemplates.map((template: { text?: string; title?: string; content?: string }, idx: number) => (
                  <button
                    key={`${template.text}-${idx}`}
                    type="button"
                    className="shortcode-item"
                    onClick={() => insertShortcode(template)}
                  >
                    <div className="shortcode-name">{template.text || template.title}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShortcodesOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {aiOpen ? (
        <div className="wb-modal" onClick={() => !aiBusy && setAiOpen(false)}>
          <div className="wb-modal-panel" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>🤖 Asistente IA (Puter)</h2>
              <button type="button" disabled={aiBusy} onClick={() => setAiOpen(false)}>
                ×
              </button>
            </header>
            <div className="wb-modal-body">
              <p className="wb-ai-hint">
                Usa Puter.js sin API keys. Si te pide login, acepta el popup de Puter.
              </p>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ejemplo: Lista de tareas para lanzar un proyecto, o describe una imagen…"
                rows={6}
                disabled={aiBusy}
              />
              <div className="wb-ai-actions">
                <button type="button" disabled={aiBusy} onClick={() => void runAI('ask')}>
                  Preguntar
                </button>
                <button type="button" disabled={aiBusy} onClick={() => void runAI('image')}>
                  Generar imagen
                </button>
                <button
                  type="button"
                  className="wb-primary"
                  disabled={aiBusy}
                  onClick={() => void runAI('generate')}
                >
                  {aiBusy ? 'Generando…' : 'Generar tablero'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function extractJson(text: string): string {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first >= 0 && last > first) return cleaned.slice(first, last + 1)
  return cleaned
}

function normalizeAIBoard(raw: {
  cards?: Array<{ x?: number; y?: number; width?: number; height?: number; title?: string; content?: string }>
  arrows?: Array<{ from?: number; fromIndex?: number; to?: number; toIndex?: number }>
}): BoardContent {
  const cards = (raw.cards || []).map((card, index) => {
    const x = Number.isFinite(Number(card?.x)) ? Number(card.x) : 80 + ((index % 4) * 260)
    const y = Number.isFinite(Number(card?.y)) ? Number(card.y) : 80 + (Math.floor(index / 4) * 180)
    const width = Number.isFinite(Number(card?.width)) ? Number(card.width) : 240
    const height = Number.isFinite(Number(card?.height)) ? Number(card.height) : 160
    return {
      left: `${x}px`,
      top: `${y}px`,
      width: `${Math.max(140, width)}px`,
      height: `${Math.max(100, height)}px`,
      title: String(card?.title || `Nodo ${index + 1}`),
      content: String(card?.content || ''),
    }
  })

  const arrows = (raw.arrows || [])
    .map((arrow) => ({
      fromIndex: Number(arrow?.from ?? arrow?.fromIndex),
      toIndex: Number(arrow?.to ?? arrow?.toIndex),
    }))
    .filter(
      (arrow) =>
        Number.isInteger(arrow.fromIndex) &&
        Number.isInteger(arrow.toIndex) &&
        arrow.fromIndex >= 0 &&
        arrow.toIndex >= 0 &&
        arrow.fromIndex < cards.length &&
        arrow.toIndex < cards.length &&
        arrow.fromIndex !== arrow.toIndex
    )

  if (!cards.length) throw new Error('Sin tarjetas')
  return { cards, arrows }
}
