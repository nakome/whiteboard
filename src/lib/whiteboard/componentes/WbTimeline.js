import WbBaseComponent from './WbBaseComponent.js';
import { escapeHtml } from './utils.js';

const normalizeState = (value) => {
    const state = String(value || 'planned').toLowerCase();
    if (['planned', 'in_progress', 'done', 'blocked'].includes(state)) {
        return state;
    }
    return 'planned';
};

export default class WbTimeline extends WbBaseComponent {
    static get observedAttributes() {
        return ['data-items'];
    }

    parsePayload() {
        const raw = this.getAttribute('data-items') || '';
        if (!raw) {
            return { title: 'Timeline', items: [] };
        }

        try {
            const parsed = JSON.parse(decodeURIComponent(raw));
            return {
                title: String(parsed.title || 'Timeline'),
                items: Array.isArray(parsed.items) ? parsed.items : []
            };
        } catch {
            return { title: 'Timeline', items: [] };
        }
    }

    render() {
        const payload = this.parsePayload();

        if (!payload.items.length) {
            this.innerHTML = `<section class="wb-timeline"><header class="wb-timeline-header">${escapeHtml(payload.title)}</header><p class="wb-timeline-empty">Sin hitos para mostrar.</p></section>`;
            return;
        }

        const itemsHtml = payload.items
            .map((item) => {
                const date = escapeHtml(String(item.date || ''));
                const title = escapeHtml(String(item.title || 'Hito'));
                const description = String(item.description || '');
                const state = normalizeState(item.state);
                const stateLabel = escapeHtml(state.replace('_', ' '));
                return `<li class="wb-timeline-item state-${state}"><div class="wb-timeline-dot"></div><div class="wb-timeline-content"><div class="wb-timeline-top"><time class="wb-timeline-date">${date}</time><strong class="wb-timeline-title">${title}</strong><span class="wb-timeline-state">${stateLabel}</span></div>${description ? `<div class="wb-timeline-description">${description}</div>` : ''}</div></li>`;
            })
            .join('');

        this.innerHTML = `<section class="wb-timeline"><header class="wb-timeline-header">${escapeHtml(payload.title)}</header><ol class="wb-timeline-list">${itemsHtml}</ol></section>`;
    }
}
