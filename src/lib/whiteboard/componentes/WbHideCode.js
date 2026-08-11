import WbBaseComponent from './WbBaseComponent.js';
import { escapeHtml } from './utils.js';

const DEFAULT_PAYLOAD = {
    title: 'Code',
    lang: 'txt',
    code: ''
};

export default class WbHideCode extends WbBaseComponent {
    static get observedAttributes() {
        return ['data-payload'];
    }

    constructor() {
        super();
        this._collapsed = null;
        this._listenerAttached = false;
    }

    parsePayload() {
        const raw = this.getAttribute('data-payload') || '';
        if (!raw) {
            return { ...DEFAULT_PAYLOAD };
        }

        try {
            const parsed = JSON.parse(decodeURIComponent(raw));
            return {
                title: String(parsed.title || 'Code'),
                lang: String(parsed.lang || 'txt').toLowerCase(),
                code: String(parsed.code || ''),
                open: parsed.open === true || parsed.open === 'true'
            };
        } catch {
            return { ...DEFAULT_PAYLOAD };
        }
    }

    setupListeners() {
        if (this._listenerAttached) return;

        const toggle = this.querySelector('[data-code-toggle]');
        const body = this.querySelector('[data-code-body]');
        
        if (!toggle || !body) return;

        toggle.addEventListener('click', () => {
            const payload = this.parsePayload();
            this._collapsed = !this._collapsed;
            const lang = escapeHtml(payload.lang || 'txt');
            toggle.innerHTML = `${this._collapsed ? '▶' : '▼'} ${payload.title} <span class="wb-code-lang">${lang}</span>`;
            toggle.setAttribute('aria-expanded', this._collapsed ? 'false' : 'true');
            body.classList.toggle('is-collapsed', this._collapsed);

            // Emitir evento para que whiteboard.js persista los cambios
            this.dispatchEvent(new CustomEvent('wb-code-update', {
                bubbles: true,
                detail: { collapsed: this._collapsed }
            }));
        });

        this._listenerAttached = true;
    }

    connectedCallback() {
        super.connectedCallback();
        this.setupListeners();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        // Reset flag para re-attach listeners si el payload cambió
        if (name === 'data-payload' && oldValue !== newValue) {
            this._listenerAttached = false;
        }
        super.attributeChangedCallback();
    }

    render() {
        const payload = this.parsePayload();
        if (this._collapsed === null) {
            this._collapsed = !payload.open;
        }

        const title = escapeHtml(payload.title);
        const lang = escapeHtml(payload.lang || 'txt');
        const code = escapeHtml(payload.code);
        const collapsed = this._collapsed;

        this.innerHTML =
            `<div class="wb-code">` +
            `<button type="button" class="wb-code-toggle" data-code-toggle aria-expanded="${collapsed ? 'false' : 'true'}">${collapsed ? '▶' : '▼'} ${title} <span class="wb-code-lang">${lang}</span></button>` +
            `<div class="wb-code-body${collapsed ? ' is-collapsed' : ''}" data-code-body>` +
            `<pre><code class="language-${lang}">${code}</code></pre>` +
            `</div>` +
            `</div>`;

        // Re-attach listeners después de actualizar el HTML
        this._listenerAttached = false;
        this.setupListeners();
    }
}