export type BoardContent = {
  cards: Array<{
    left: string
    top: string
    width: string
    height: string
    title: string
    content: string
  }>
  arrows: Array<{
    fromIndex: number
    toIndex: number
  }>
}

export type Board = {
  id: string
  user_id: string
  title: string
  content: BoardContent
  share_token: string | null
  shared_at: string | null
  created_at: string
  updated_at: string
}

export type SharedBoard = {
  id: string
  title: string
  content: BoardContent
  updated_at: string
}

export const EMPTY_BOARD_CONTENT: BoardContent = {
  cards: [],
  arrows: [],
}
