import { marked } from 'marked'
import { createMarkdownRenderer } from './shortcodes.js'

export function createMarkdownToHtml() {
  const render = createMarkdownRenderer(marked)
  return (txt: string) => render(txt)
}
