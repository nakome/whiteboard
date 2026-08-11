import WbBaseComponent from './WbBaseComponent.js';
import { escapeHtml } from './utils.js';
import { isPuterReady, loadPuter, puterChat } from '../../puter';

const DEFAULT_PAYLOAD = {
    prompt: '',
    tone: 'inspirador',
    language: 'es',
    author: '',
    quote: ''
};

export default class WbAiQuote extends WbBaseComponent {
    static get observedAttributes() {
        return ['data-payload'];
    }

    constructor() {
        super();
        this._loading = false;
        this._error = '';
    }

    parsePayload() {
        const raw = this.getAttribute('data-payload') || '';
        if (!raw) {
            return { ...DEFAULT_PAYLOAD };
        }

        try {
            const parsed = JSON.parse(decodeURIComponent(raw));
            return {
                prompt: String(parsed.prompt || ''),
                tone: String(parsed.tone || 'inspirador'),
                language: String(parsed.language || 'es'),
                author: String(parsed.author || ''),
                quote: String(parsed.quote || '')
            };
        } catch {
            return { ...DEFAULT_PAYLOAD };
        }
    }

    updatePayload(payload) {
        const normalized = {
            prompt: String(payload.prompt || '').trim(),
            tone: String(payload.tone || 'inspirador').trim() || 'inspirador',
            language: String(payload.language || 'es').trim() || 'es',
            author: String(payload.author || '').trim(),
            quote: String(payload.quote || '').trim()
        };

        const encoded = encodeURIComponent(JSON.stringify(normalized));
        this.setAttribute('data-payload', encoded);
    }

    puterAvailable() {
        return isPuterReady();
    }

    extractResponseText(response) {
        return String(response || '');
    }

    parseQuoteResult(text, payload) {
        const raw = String(text || '').trim();
        const stripFence = (value) => value
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        const firstLineAsQuote = (value) => {
            const line = String(value || '')
                .split('\n')
                .map((part) => part.trim())
                .find(Boolean) || '';

            return {
                quote: line.replace(/^"|"$/g, '').trim(),
                author: String(payload.author || '').trim() || 'IA'
            };
        };

        try {
            const cleaned = stripFence(raw);
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            const candidate = firstBrace >= 0 && lastBrace > firstBrace
                ? cleaned.slice(firstBrace, lastBrace + 1)
                : cleaned;

            const parsed = JSON.parse(candidate);
            const quote = String(parsed?.quote || parsed?.text || '').replace(/\s+/g, ' ').trim();
            const author = String(parsed?.author || payload.author || 'IA').trim();

            if (!quote) {
                return firstLineAsQuote(cleaned);
            }

            return { quote, author };
        } catch {
            return firstLineAsQuote(raw);
        }
    }

    emitQuoteUpdate(payload) {
        const safe = (value) => String(value || '')
            .replaceAll('\\', '\\\\')
            .replaceAll("'", "\\'")
            .replace(/\s+/g, ' ')
            .trim();

        const attrs = [];
        if (payload.prompt) attrs.push(`prompt='${safe(payload.prompt)}'`);
        if (payload.tone) attrs.push(`tone='${safe(payload.tone)}'`);
        if (payload.language) attrs.push(`lang='${safe(payload.language)}'`);
        if (payload.author) attrs.push(`author='${safe(payload.author)}'`);
        if (payload.quote) attrs.push(`quote='${safe(payload.quote)}'`);

        const markdown = `[SmartQuote ${attrs.join(' ')}]`;
        this.dispatchEvent(new CustomEvent('wb-ai-quote-update', {
            bubbles: true,
            composed: true,
            detail: { markdown }
        }));
    }

    async generateQuote() {
        if (this._loading) {
            return;
        }

        const payload = this.parsePayload();
        if (!payload.prompt) {
            this._error = 'Configura el prompt del shortcode para generar la cita.';
            this.render();
            return;
        }

        this._loading = true;
        this._error = '';
        this.render();

        try {
            await loadPuter();
            if (!this.puterAvailable()) {
                this._error = 'Puter AI no está disponible en este navegador.';
                this._loading = false;
                this.render();
                return;
            }

            const instruction = [
                'Responde unicamente con JSON valido.',
                'Esquema exacto: {"quote":"string","author":"string"}',
                'No anadas markdown ni texto extra.',
                `Idioma: ${payload.language || 'es'}`,
                `Tono: ${payload.tone || 'inspirador'}`,
                payload.author ? `Usa este autor cuando aplique: ${payload.author}` : 'Si no hay autor conocido, usa un autor breve tipo "IA".',
                `Contexto para la cita: ${payload.prompt}`
            ].join('\n');

            const text = await puterChat(instruction);
            const parsed = this.parseQuoteResult(text, payload);
            const nextPayload = {
                ...payload,
                quote: parsed.quote,
                author: parsed.author
            };

            this._loading = false;
            this._error = '';
            this.updatePayload(nextPayload);
            this.emitQuoteUpdate(nextPayload);
        } catch (error) {
            this._loading = false;
            this._error = 'No se pudo generar la cita con IA. Intentalo de nuevo.';
            this.render();
            console.error(error);
        }
    }

    render() {
        const payload = this.parsePayload();
        const promptText = payload.prompt || this._source || '';
        const quote = String(payload.quote || '').trim();
        const author = String(payload.author || '').trim() || 'IA';
        const hasQuote = Boolean(quote);

        this.innerHTML =
            `<section class="wb-ai-quote">` +
            `<header class="wb-ai-quote-head">🤖 Smart Quote</header>` +
            `<p class="wb-ai-quote-prompt">${escapeHtml(promptText)}</p>` +
            `<blockquote class="wb-ai-quote-text">${hasQuote ? escapeHtml(quote) : 'Pulsa el boton para generar una cita con IA.'}</blockquote>` +
            `<footer class="wb-ai-quote-author">${hasQuote ? `- ${escapeHtml(author)}` : ''}</footer>` +
            `<div class="wb-ai-quote-actions">` +
            `<button type="button" class="wb-ai-quote-btn" data-ai-quote-generate ${this._loading ? 'disabled' : ''}>${this._loading ? 'Generando…' : hasQuote ? 'Regenerar cita' : 'Generar cita'}</button>` +
            `</div>` +
            `${this._error ? `<p class="wb-ai-quote-error">${escapeHtml(this._error)}</p>` : ''}` +
            `</section>`;

        const button = this.querySelector('[data-ai-quote-generate]');
        button?.addEventListener('click', () => {
            this.generateQuote();
        });
    }
}