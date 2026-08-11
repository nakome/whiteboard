'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createEmptyFile,
  createFolder,
  downloadBlob,
  fileIcon,
  formatSize,
  getSignedUrl,
  isTextEditableFile,
  listFolder,
  openTextInBrowser,
  removeEntry,
  renameEntry,
  saveTextFile,
  uploadFiles,
} from '@/lib/filemanager/files-api'
import type { FileEntry } from '@/lib/filemanager/types'
import FileTextEditor from '@/components/FileTextEditor'
import '@/lib/filemanager/filemanager.css'

type Props = {
  open: boolean
  userId: string
  onClose: () => void
}

type DialogState =
  | null
  | { mode: 'folder' | 'file' | 'rename'; value: string; target?: FileEntry }
  | { mode: 'delete'; target: FileEntry }

type ContextMenuState = {
  x: number
  y: number
  entry: FileEntry
} | null

type ToastState = { message: string; kind: 'success' | 'error' } | null

export default function FileManagerModal({ open, userId, onClose }: Props) {
  const [path, setPath] = useState('')
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({})
  const [dialog, setDialog] = useState<DialogState>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [uploadLabel, setUploadLabel] = useState('')
  const [editor, setEditor] = useState<{ filename: string; content: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind })
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listFolder(userId, path)
      setFiles(result.files)
      setPath(result.currentPath)

      const thumbs: Record<string, string> = {}
      await Promise.all(
        result.files
          .filter((f) => f.type !== 'folder' && String(f.type).includes('image'))
          .slice(0, 40)
          .map(async (f) => {
            try {
              thumbs[f.name] = await getSignedUrl(userId, result.currentPath, f.name, 600)
            } catch {
              /* ignore thumb errors */
            }
          })
      )
      setThumbUrls(thumbs)
    } catch (err) {
      console.error(err)
      showToast(err instanceof Error ? err.message : 'No se pudo listar', 'error')
    } finally {
      setLoading(false)
    }
  }, [path, showToast, userId])

  useEffect(() => {
    if (!open) return
    void refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dialog) setDialog(null)
        else if (contextMenu) setContextMenu(null)
        else onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, dialog, contextMenu, onClose])

  useEffect(() => {
    if (!open) return
    const onPaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || [])
      const image = items.find((item) => item.type.startsWith('image/'))
      if (!image) return
      e.preventDefault()
      const blob = image.getAsFile()
      if (!blob) return
      const file = new File([blob], `screenshot_${Date.now()}.png`, { type: blob.type || 'image/png' })
      try {
        setUploadPct(0)
        await uploadFiles(userId, path, [file], (pct, label) => {
          setUploadPct(pct)
          setUploadLabel(label)
        })
        setUploadPct(null)
        showToast('Captura subida', 'success')
        await refresh()
      } catch (err) {
        console.error(err)
        setUploadPct(null)
        showToast('No se pudo pegar la imagen', 'error')
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [open, path, refresh, showToast, userId])

  if (!open) return null

  async function handleUpload(fileList: FileList | File[] | null) {
    const filesArr = fileList ? Array.from(fileList) : []
    if (!filesArr.length) return
    try {
      setUploadPct(0)
      await uploadFiles(userId, path, filesArr, (pct, label) => {
        setUploadPct(pct)
        setUploadLabel(label)
      })
      setUploadPct(null)
      showToast(filesArr.length === 1 ? 'Archivo subido' : `${filesArr.length} archivos subidos`)
      await refresh()
    } catch (err) {
      console.error(err)
      setUploadPct(null)
      showToast(err instanceof Error ? err.message : 'Error al subir', 'error')
    }
  }

  async function openEntry(entry: FileEntry) {
    if (entry.type === 'folder') {
      setPath(path ? `${path}/${entry.name}` : entry.name)
      return
    }

    if (isTextEditableFile(entry.type, entry.name)) {
      try {
        const blob = await downloadBlob(userId, path, entry.name)
        const content = await blob.text()
        setEditor({ filename: entry.name, content })
      } catch (err) {
        console.error(err)
        showToast('No se pudo abrir el archivo', 'error')
      }
      return
    }

    try {
      const url = await getSignedUrl(userId, path, entry.name)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      console.error(err)
      showToast('No se pudo abrir el archivo', 'error')
    }
  }

  async function submitDialog() {
    if (!dialog) return
    try {
      switch (dialog.mode) {
        case 'folder': {
          const name = dialog.value.trim()
          if (!name) return
          await createFolder(userId, path, name)
          showToast('Carpeta creada')
          break
        }
        case 'file': {
          const name = dialog.value.trim()
          if (!name) return
          await createEmptyFile(userId, path, name)
          showToast('Archivo creado')
          break
        }
        case 'rename': {
          if (!dialog.target) return
          const name = dialog.value.trim()
          if (!name || name === dialog.target.name) {
            setDialog(null)
            return
          }
          await renameEntry(userId, path, dialog.target.name, name, dialog.target.type === 'folder')
          showToast('Elemento renombrado')
          break
        }
        case 'delete': {
          await removeEntry(userId, path, dialog.target.name, dialog.target.type === 'folder')
          showToast('Elemento eliminado')
          break
        }
        default: {
          const _exhaustive: never = dialog
          return _exhaustive
        }
      }
      setDialog(null)
      await refresh()
    } catch (err) {
      console.error(err)
      showToast(err instanceof Error ? err.message : 'Operación fallida', 'error')
    }
  }

  async function copySignedUrl(entry: FileEntry) {
    try {
      const url = await getSignedUrl(userId, path, entry.name)
      await navigator.clipboard.writeText(url)
      showToast('URL copiada')
    } catch (err) {
      console.error(err)
      showToast('No se pudo copiar la URL', 'error')
    }
  }

  async function downloadEntry(entry: FileEntry) {
    try {
      const blob = await downloadBlob(userId, path, entry.name)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = entry.name
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      showToast('No se pudo descargar', 'error')
    }
  }

  const crumbs = path ? path.split('/').filter(Boolean) : []

  return (
    <div className="fm-modal" role="presentation">
      <div className="fm-overlay" onClick={onClose} />
      <div className="fm-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Gestor de archivos">
        <div className="fm-header">
          <h2>📁 Gestor de Archivos</h2>
          <button type="button" className="fm-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="fm-toolbar">
          <button type="button" onClick={() => setDialog({ mode: 'folder', value: '' })}>
            📁 Carpeta
          </button>
          <button type="button" onClick={() => setDialog({ mode: 'file', value: '' })}>
            🗒️ Crear
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            📤 Subir
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              void handleUpload(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        <div className="fm-breadcrumbs">
          <button
            type="button"
            onClick={() => {
              setPath('')
            }}
          >
            🏠 Inicio
          </button>
          {crumbs.map((part, idx) => {
            const target = crumbs.slice(0, idx + 1).join('/')
            return (
              <span key={target}>
                {' / '}
                <button type="button" onClick={() => setPath(target)}>
                  {part}
                </button>
              </span>
            )
          })}
        </div>

        {uploadPct !== null ? (
          <div className="fm-upload-progress">
            <div className="fm-progress-head">
              <span>Subiendo {uploadLabel || '…'}</span>
              <span>{uploadPct}%</span>
            </div>
            <div className="fm-progress-track">
              <div className="fm-progress-bar" style={{ width: `${uploadPct}%` }} />
            </div>
          </div>
        ) : null}

        <div
          className={`fm-drop-zone${dragOver ? ' drag-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            void handleUpload(e.dataTransfer.files)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            // hint only; paste works via Ctrl+V
            showToast('Pulsa Ctrl+V para pegar una captura', 'success')
          }}
        >
          <p className="fm-drop-icon">🗂️</p>
          <p>
            <strong>Arrastra archivos aquí</strong>
          </p>
          <p>o haz click derecho y pega para subir capturas</p>
        </div>

        {loading ? <div className="fm-empty">Cargando…</div> : null}

        {!loading && files.length === 0 ? <div className="fm-empty">📂 No hay archivos</div> : null}

        {!loading && files.length > 0 ? (
          <div className="fm-grid">
            {files.map((entry) => {
              const isFolder = entry.type === 'folder'
              const thumb = thumbUrls[entry.name]
              return (
                <button
                  key={`${entry.path}-${entry.name}`}
                  type="button"
                  className="fm-item"
                  onClick={() => void openEntry(entry)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ x: e.clientX, y: e.clientY, entry })
                  }}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={entry.name} />
                  ) : (
                    <div className="fm-icon">{fileIcon(entry.type)}</div>
                  )}
                  <div className="fm-name" title={entry.name}>
                    {entry.name}
                  </div>
                  <div className="fm-size">{isFolder ? 'Carpeta' : formatSize(entry.size)}</div>
                </button>
              )
            })}
          </div>
        ) : null}

        {toast ? (
          <div className={`fm-toast ${toast.kind === 'error' ? 'is-error' : 'is-success'}`}>{toast.message}</div>
        ) : null}

        {contextMenu ? (
          <div
            className="fm-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseLeave={() => setContextMenu(null)}
          >
            <button
              type="button"
              onClick={() => {
                void openEntry(contextMenu.entry)
                setContextMenu(null)
              }}
            >
              Abrir
            </button>
            {contextMenu.entry.type !== 'folder' ? (
              <>
                {isTextEditableFile(contextMenu.entry.type, contextMenu.entry.name) ? (
                  <button
                    type="button"
                    onClick={() => {
                      void openTextInBrowser(userId, path, contextMenu.entry.name)
                        .then(() => showToast('Abierto en el navegador'))
                        .catch((err) => {
                          console.error(err)
                          showToast('No se pudo abrir en el navegador', 'error')
                        })
                      setContextMenu(null)
                    }}
                  >
                    Ver en navegador
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void downloadEntry(contextMenu.entry)
                    setContextMenu(null)
                  }}
                >
                  Descargar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void copySignedUrl(contextMenu.entry)
                    setContextMenu(null)
                  }}
                >
                  Copiar URL
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setDialog({ mode: 'rename', value: contextMenu.entry.name, target: contextMenu.entry })
                setContextMenu(null)
              }}
            >
              Renombrar
            </button>
            <button
              type="button"
              className="fm-context-danger"
              onClick={() => {
                setDialog({ mode: 'delete', target: contextMenu.entry })
                setContextMenu(null)
              }}
            >
              Eliminar
            </button>
          </div>
        ) : null}

        {dialog ? (
          <div className="fm-dialog-overlay" onClick={() => setDialog(null)}>
            <div className="fm-dialog" onClick={(e) => e.stopPropagation()}>
              {dialog.mode === 'delete' ? (
                <>
                  <h3 className="fm-dialog-title">Eliminar</h3>
                  <p className="fm-dialog-message">
                    ¿Eliminar <strong>{dialog.target.name}</strong>? Esta acción no se puede deshacer.
                  </p>
                  <div className="fm-dialog-actions">
                    <button type="button" onClick={() => setDialog(null)}>
                      Cancelar
                    </button>
                    <button type="button" className="is-danger" onClick={() => void submitDialog()}>
                      Eliminar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="fm-dialog-title">
                    {dialog.mode === 'folder'
                      ? 'Crear carpeta'
                      : dialog.mode === 'file'
                        ? 'Crear archivo'
                        : 'Renombrar'}
                  </h3>
                  <p className="fm-dialog-message">
                    {dialog.mode === 'folder'
                      ? 'Nombre de la carpeta'
                      : dialog.mode === 'file'
                        ? 'Nombre del archivo (ej: nota.txt)'
                        : 'Nuevo nombre'}
                  </p>
                  <input
                    className="fm-dialog-input"
                    value={dialog.value}
                    autoFocus
                    onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitDialog()
                    }}
                  />
                  <div className="fm-dialog-actions">
                    <button type="button" onClick={() => setDialog(null)}>
                      Cancelar
                    </button>
                    <button type="button" className="is-primary" onClick={() => void submitDialog()}>
                      {dialog.mode === 'rename' ? 'Renombrar' : 'Crear'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {editor ? (
          <FileTextEditor
            filename={editor.filename}
            initialValue={editor.content}
            onSave={async (content) => {
              await saveTextFile(userId, path, editor.filename, content)
              showToast('Archivo guardado')
            }}
            onOpenInBrowser={async (content) => {
              // Persist first so Storage matches what we show
              await saveTextFile(userId, path, editor.filename, content)
              const typed = new Blob([content], { type: 'text/plain;charset=UTF-8' })
              const url = URL.createObjectURL(typed)
              const opened = window.open(url, '_blank', 'noopener')
              if (!opened) {
                URL.revokeObjectURL(url)
                throw new Error('El navegador bloqueó la ventana emergente')
              }
              window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
            }}
            onClose={() => setEditor(null)}
          />
        ) : null}
      </div>
    </div>
  )
}
