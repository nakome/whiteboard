export type FileEntry = {
  name: string
  type: 'folder' | string
  size: number
  path: string
  updatedAt?: string | null
}

export type ListFolderResult = {
  files: FileEntry[]
  currentPath: string
}

export const BUCKET = 'user-files'
export const FOLDER_MARKER = '.keep'
