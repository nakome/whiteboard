import type { Board, BoardContent, SharedBoard } from '@/lib/whiteboard/types'
import { EMPTY_BOARD_CONTENT } from '@/lib/whiteboard/types'
import { createClient } from '@/lib/supabase/client'

function buildShareUrl(token: string): string {
  if (typeof window === 'undefined') {
    return `/share/${token}`
  }
  return `${window.location.origin}/share/${token}`
}

export async function listBoards(): Promise<Board[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data || []) as Board[]
}

export async function ensureDefaultBoard(userId: string): Promise<Board> {
  const existing = await listBoards()
  if (existing.length > 0) {
    return existing[0]
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('boards')
    .insert({
      user_id: userId,
      title: 'Mi pizarra',
      content: EMPTY_BOARD_CONTENT,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Board
}

export async function createBoard(userId: string, title = 'Nueva pizarra'): Promise<Board> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('boards')
    .insert({
      user_id: userId,
      title,
      content: EMPTY_BOARD_CONTENT,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Board
}

export async function renameBoard(boardId: string, title: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('boards')
    .update({ title })
    .eq('id', boardId)

  if (error) throw error
}

export async function deleteBoard(boardId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('boards').delete().eq('id', boardId)
  if (error) throw error
}

export async function saveBoardContent(boardId: string, content: BoardContent): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('boards')
    .update({ content })
    .eq('id', boardId)

  if (error) throw error
}

export async function enableShare(boardId: string): Promise<{ board: Board; shareUrl: string }> {
  const supabase = createClient()
  const token = crypto.randomUUID().replace(/-/g, '')
  const { data, error } = await supabase
    .from('boards')
    .update({
      share_token: token,
      shared_at: new Date().toISOString(),
    })
    .eq('id', boardId)
    .select('*')
    .single()

  if (error) throw error
  const board = data as Board
  return {
    board,
    shareUrl: buildShareUrl(String(board.share_token)),
  }
}

export async function disableShare(boardId: string): Promise<Board> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('boards')
    .update({
      share_token: null,
      shared_at: null,
    })
    .eq('id', boardId)
    .select('*')
    .single()

  if (error) throw error
  return data as Board
}

export async function getSharedBoard(token: string): Promise<SharedBoard | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_board_by_share_token', {
    p_token: token,
  })

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null

  const content =
    typeof row.content === 'string'
      ? (JSON.parse(row.content) as BoardContent)
      : (row.content as BoardContent)

  return {
    id: String(row.id),
    title: String(row.title || 'Pizarra'),
    content: content || EMPTY_BOARD_CONTENT,
    updated_at: String(row.updated_at || ''),
  }
}
