'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  filename: string
  initialValue: string
  onSave: (content: string) => Promise<void>
  onClose: () => void
  onOpenInBrowser?: (content: string) => Promise<void>
}

export default function FileTextEditor({
  filename,
  initialValue,
  onSave,
  onClose,
  onOpenInBrowser,
}: Props) {
  const [value, setValue] = useState(initialValue)
  const [savedValue, setSavedValue] = useState(initialValue)
  const [search, setSearch] = useState('')
  const [replace, setReplace] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  const dirty = value !== savedValue
  const lineCount = useMemo(() => Math.max(1, value.split('\n').length), [value])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  function syncScroll() {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  function replaceAll() {
    if (!search) return
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const next = value.replace(new RegExp(escaped, 'g'), replace)
    if (next !== value) setValue(next)
  }

  async function handleSave(): Promise<boolean> {
    if (saving) return false
    setSaving(true)
    setStatus('Guardando...')
    try {
      await onSave(value)
      setSavedValue(value)
      setStatus('Guardado ✓')
      return true
    } catch (err) {
      console.error(err)
      setStatus('❌ Error al guardar')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleOpenInBrowser() {
    if (!onOpenInBrowser) return
    if (dirty) {
      const ok = await handleSave()
      if (!ok) return
    }
    try {
      await onOpenInBrowser(value)
      setStatus('Abierto en el navegador')
    } catch (err) {
      console.error(err)
      setStatus('❌ No se pudo abrir en el navegador')
    }
  }

  function requestClose() {
    if (dirty) {
      setConfirmDiscard(true)
      return
    }
    onClose()
  }

  return (
    <div className="fm-editor-overlay" onClick={requestClose}>
      <div className="fm-editor-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="fm-editor-header">
          <h3 className="fm-editor-title">✏️ {filename}</h3>
          <span className={`fm-editor-indicator${dirty ? ' is-dirty' : ' is-clean'}`}>
            {dirty ? '● Cambios sin guardar' : saving ? 'Guardando…' : status.includes('Error') ? status : 'Sin cambios'}
          </span>
          <button type="button" className="fm-editor-close" onClick={requestClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="fm-editor-search-bar">
          <input
            type="text"
            className="fm-editor-search-input"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') replaceAll()
            }}
          />
          <input
            type="text"
            className="fm-editor-search-input"
            placeholder="Reemplazar..."
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') replaceAll()
            }}
          />
          <button type="button" className="fm-editor-search-btn" onClick={replaceAll}>
            Reemplazar todo
          </button>
        </div>

        <div className="fm-editor-wrapper">
          <div className="fm-editor-line-numbers" ref={lineNumbersRef} aria-hidden="true">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className="fm-editor-line-number">
                {i + 1}
              </div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className="fm-editor-textarea"
            value={value}
            spellCheck={false}
            onChange={(e) => setValue(e.target.value)}
            onScroll={syncScroll}
          />
        </div>

        <div className="fm-editor-toolbar">
          <button type="button" className="fm-editor-save-btn" disabled={saving || !dirty} onClick={() => void handleSave()}>
            💾 Guardar
          </button>
          {onOpenInBrowser ? (
            <button type="button" className="fm-editor-cancel-btn" disabled={saving} onClick={() => void handleOpenInBrowser()}>
              🌐 Ver en navegador
            </button>
          ) : null}
          <button type="button" className="fm-editor-cancel-btn" onClick={requestClose}>
            Cerrar
          </button>
          {status ? <span className="fm-editor-status">{status}</span> : null}
        </div>

        {confirmDiscard ? (
          <div className="fm-dialog-overlay" onClick={() => setConfirmDiscard(false)}>
            <div className="fm-dialog" onClick={(e) => e.stopPropagation()}>
              <h3 className="fm-dialog-title">Descartar cambios</h3>
              <p className="fm-dialog-message">Hay cambios sin guardar. ¿Descartar?</p>
              <div className="fm-dialog-actions">
                <button type="button" onClick={() => setConfirmDiscard(false)}>
                  Cancelar
                </button>
                <button type="button" className="is-danger" onClick={onClose}>
                  Descartar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
