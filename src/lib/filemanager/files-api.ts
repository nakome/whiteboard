import { createClient } from '@/lib/supabase/client'
import { BUCKET, FOLDER_MARKER, type FileEntry, type ListFolderResult } from '@/lib/filemanager/types'

function sanitizeSegment(name: string): string {
  const raw = String(name || '').trim().replace(/[\\/]+/g, '')
  // Allow the folder marker ".keep"; strip other leading-dot / traversal tricks
  if (raw === FOLDER_MARKER) return FOLDER_MARKER
  return raw.replace(/\.\./g, '').replace(/^\.+/, '')
}

function sanitizeRelativePath(path: string): string {
  return String(path || '')
    .split('/')
    .map(sanitizeSegment)
    .filter(Boolean)
    .join('/')
}

export function joinUserPath(userId: string, relativePath = '', filename = ''): string {
  // filename may be a nested relative path (e.g. "folder/.keep"); sanitize as path segments
  const filePart = filename.includes('/')
    ? sanitizeRelativePath(filename)
    : sanitizeSegment(filename)
  const parts = [userId, sanitizeRelativePath(relativePath), filePart].filter(Boolean)
  return parts.join('/')
}

function guessMime(name: string): string {
  const lower = name.toLowerCase()
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lower)) {
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.gif')) return 'image/gif'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.svg')) return 'image/svg+xml;charset=UTF-8'
    return 'image/jpeg'
  }
  if (/\.(mp4|webm|ogg)$/.test(lower)) return 'video/mp4'
  if (/\.(mp3|wav|ogg)$/.test(lower)) return 'audio/mpeg'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.json')) return 'application/json;charset=UTF-8'
  if (/\.(txt|md|css|js|ts|tsx|jsx|html|php|xml|yml|yaml|csv|log|env)$/.test(lower)) {
    return 'text/plain;charset=UTF-8'
  }
  return 'application/octet-stream'
}

function textBlob(content: string, filename: string): Blob {
  return new Blob([content], { type: guessMime(filename) })
}

function isFolderItem(item: { id?: string | null; metadata?: unknown }): boolean {
  // Supabase folders have id === null
  return item.id === null
}

export async function listFolder(userId: string, relativePath = ''): Promise<ListFolderResult> {
  const supabase = createClient()
  const prefix = joinUserPath(userId, relativePath)
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 500,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  })

  if (error) throw error

  const files: FileEntry[] = (data || [])
    .filter((item) => {
      const name = item.name || ''
      // Hide folder markers and legacy mistaken "name.keep" files from a prior bug
      if (name === FOLDER_MARKER || name.endsWith('.keep')) return false
      return true
    })
    .map((item) => {
      const folder = isFolderItem(item)
      const meta = (item.metadata || {}) as { size?: number; mimetype?: string }
      const name = item.name
      const path = relativePath ? `${sanitizeRelativePath(relativePath)}/${name}` : name
      return {
        name,
        type: folder ? 'folder' : meta.mimetype || guessMime(name),
        size: folder ? 0 : Number(meta.size || 0),
        path,
        updatedAt: item.updated_at || item.created_at || null,
      }
    })
    .sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1
      if (a.type !== 'folder' && b.type === 'folder') return 1
      return a.name.localeCompare(b.name, 'es')
    })

  return { files, currentPath: sanitizeRelativePath(relativePath) }
}

export async function createFolder(userId: string, relativePath: string, folderName: string): Promise<void> {
  const clean = sanitizeSegment(folderName)
  if (!clean) throw new Error('Nombre de carpeta inválido')
  const supabase = createClient()
  // Build path explicitly so "/" is not stripped by sanitizeSegment
  const base = joinUserPath(userId, relativePath)
  const objectPath = `${base}/${clean}/${FOLDER_MARKER}`
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, new Blob(['']), {
    contentType: 'text/plain',
    upsert: false,
  })
  if (error) throw error
}

export async function createEmptyFile(
  userId: string,
  relativePath: string,
  filename: string,
  content = ''
): Promise<void> {
  const clean = sanitizeSegment(filename)
  if (!clean) throw new Error('Nombre de archivo inválido')
  const supabase = createClient()
  const objectPath = joinUserPath(userId, relativePath, clean)
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, textBlob(content, clean), {
    contentType: guessMime(clean),
    upsert: false,
  })
  if (error) throw error
}

export async function uploadFile(
  userId: string,
  relativePath: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<void> {
  const clean = sanitizeSegment(file.name)
  if (!clean) throw new Error('Nombre de archivo inválido')
  const supabase = createClient()
  const objectPath = joinUserPath(userId, relativePath, clean)

  // supabase-js upload doesn't expose xhr progress; approximate start/end
  onProgress?.(10)
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, file, {
    contentType: file.type || guessMime(clean),
    upsert: true,
  })
  onProgress?.(100)
  if (error) throw error
}

export async function uploadFiles(
  userId: string,
  relativePath: string,
  files: File[],
  onProgress?: (pct: number, label: string) => void
): Promise<void> {
  const total = files.length || 1
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]
    onProgress?.(Math.round((i / total) * 100), file.name)
    await uploadFile(userId, relativePath, file)
    onProgress?.(Math.round(((i + 1) / total) * 100), file.name)
  }
}

export async function renameEntry(
  userId: string,
  relativePath: string,
  oldName: string,
  newName: string,
  isFolder: boolean
): Promise<void> {
  const fromName = sanitizeSegment(oldName)
  const toName = sanitizeSegment(newName)
  if (!fromName || !toName) throw new Error('Nombre inválido')
  if (fromName === toName) return

  const supabase = createClient()

  if (!isFolder) {
    const from = joinUserPath(userId, relativePath, fromName)
    const to = joinUserPath(userId, relativePath, toName)
    const { error } = await supabase.storage.from(BUCKET).move(from, to)
    if (error) throw error
    return
  }

  // Rename folder: move all objects under the prefix
  const fromPrefix = joinUserPath(userId, relativePath, fromName)
  const toPrefix = joinUserPath(userId, relativePath, toName)
  const paths = await listObjectPathsRecursive(fromPrefix)
  if (!paths.length) {
    // empty folder marker only
    await createFolder(userId, relativePath, toName)
    await removeEntry(userId, relativePath, fromName, true)
    return
  }

  for (const path of paths) {
    const next = toPrefix + path.slice(fromPrefix.length)
    const { error } = await supabase.storage.from(BUCKET).move(path, next)
    if (error) throw error
  }
}

export async function removeEntry(
  userId: string,
  relativePath: string,
  name: string,
  isFolder: boolean
): Promise<void> {
  const clean = sanitizeSegment(name)
  if (!clean) throw new Error('Nombre inválido')
  const supabase = createClient()

  if (!isFolder) {
    const path = joinUserPath(userId, relativePath, clean)
    const { error } = await supabase.storage.from(BUCKET).remove([path])
    if (error) throw error
    return
  }

  const prefix = joinUserPath(userId, relativePath, clean)
  const paths = await listObjectPathsRecursive(prefix)
  if (!paths.length) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}

async function listObjectPathsRecursive(prefix: string): Promise<string[]> {
  const supabase = createClient()
  const result: string[] = []

  async function walk(dir: string) {
    const { data, error } = await supabase.storage.from(BUCKET).list(dir, {
      limit: 1000,
      offset: 0,
    })
    if (error) throw error
    for (const item of data || []) {
      const child = `${dir}/${item.name}`
      if (isFolderItem(item)) {
        await walk(child)
      } else {
        result.push(child)
      }
    }
  }

  await walk(prefix)
  return result
}

export async function getSignedUrl(userId: string, relativePath: string, filename: string, expiresIn = 3600): Promise<string> {
  const supabase = createClient()
  const path = joinUserPath(userId, relativePath, filename)
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export async function downloadBlob(userId: string, relativePath: string, filename: string): Promise<Blob> {
  const supabase = createClient()
  const path = joinUserPath(userId, relativePath, filename)
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  return data
}

export function formatSize(bytes: number): string {
  const size = Number(bytes || 0)
  if (size === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const idx = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)))
  const value = Math.round((size / 1024 ** idx) * 100) / 100
  return `${value} ${units[idx]}`
}

export function fileIcon(type: string): string {
  const mime = String(type || '')
  if (mime === 'folder') return '📁'
  if (mime.includes('image')) return '🖼️'
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('text') || mime.includes('json')) return '📝'
  if (mime.includes('video')) return '🎬'
  if (mime.includes('audio')) return '🎵'
  if (mime.includes('zip') || mime.includes('compressed')) return '📦'
  return '📄'
}

export function isPreviewable(type: string): boolean {
  const mime = String(type || '')
  return mime.includes('image') || mime.includes('video') || mime.includes('audio') || mime.includes('pdf')
}

export function isTextEditableFile(type: string, filename: string): boolean {
  return (
    String(type || '').includes('text') ||
    String(type || '').includes('json') ||
    /\.(txt|json|css|js|ts|tsx|jsx|html|php|md|svg|xml|yml|yaml|env|csv|log)$/i.test(filename || '')
  )
}

export async function saveTextFile(
  userId: string,
  relativePath: string,
  filename: string,
  content: string
): Promise<void> {
  const clean = sanitizeSegment(filename)
  if (!clean) throw new Error('Nombre de archivo inválido')
  const supabase = createClient()
  const objectPath = joinUserPath(userId, relativePath, clean)
  const body = textBlob(content, clean)
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, body, {
    contentType: guessMime(clean),
    upsert: true,
    cacheControl: '0',
  })
  if (error) throw error
}

/** Open current Storage content in a new tab (authenticated download → blob URL). */
export async function openTextInBrowser(
  userId: string,
  relativePath: string,
  filename: string
): Promise<void> {
  const blob = await downloadBlob(userId, relativePath, filename)
  const text = await blob.text()
  const typed = textBlob(text, filename)
  const url = URL.createObjectURL(typed)
  const opened = window.open(url, '_blank', 'noopener')
  if (!opened) {
    URL.revokeObjectURL(url)
    throw new Error('El navegador bloqueó la ventana emergente')
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
