import WbBaseComponent from './WbBaseComponent.js';
import { escapeHtml } from './utils.js';

const normalizeType = (value) => {
    const type = String(value || 'changed').toLowerCase();
    if (['added', 'fixed', 'changed', 'removed', 'security'].includes(type)) {
        return type;
    }
    return 'changed';
};

export default class WbChangelog extends WbBaseComponent {
    static get observedAttributes() {
        return ['data-changelog'];
    }

    parsePayload() {
        const raw = this.getAttribute('data-changelog') || '';
        if (!raw) {
            return { title: 'Changelog', items: [] };
        }

        try {
            const parsed = JSON.parse(decodeURIComponent(raw));
            return {
                title: String(parsed.title || 'Changelog'),
                items: Array.isArray(parsed.items) ? parsed.items : []
            };
        } catch {
            return { title: 'Changelog', items: [] };
        }
    }

    render() {
        const payload = this.parsePayload();

        if (!payload.items.length) {
            this.innerHTML = `<section class="wb-changelog"><header class="wb-changelog-header">${escapeHtml(payload.title)}</header><p class="wb-changelog-empty">No entries yet.</p></section>`;
            return;
        }

        const itemsHtml = payload.items
            .map((item) => {
                const version = escapeHtml(String(item.version || 'v0.0.0'));
                const date = escapeHtml(String(item.date || ''));
                const change = String(item.change || '');
                const type = normalizeType(item.type);
                return `<li class="wb-changelog-item"><span class="wb-changelog-tag type-${type}">${type}</span><div class="wb-changelog-main"><div class="wb-changelog-top"><strong>${version}</strong>${date ? `<time>${date}</time>` : ''}</div><div class="wb-changelog-text">${change}</div></div></li>`;
            })
            .join('');

        this.innerHTML = `<section class="wb-changelog"><header class="wb-changelog-header">${escapeHtml(payload.title)}</header><ul class="wb-changelog-list">${itemsHtml}</ul></section>`;
    }
}
