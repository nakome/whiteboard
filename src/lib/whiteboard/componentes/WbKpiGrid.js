import WbBaseComponent from './WbBaseComponent.js';
import { escapeHtml } from './utils.js';

const normalizeTone = (value) => {
    const tone = String(value || 'neutral').toLowerCase();
    if (['success', 'danger', 'warning', 'info', 'neutral'].includes(tone)) {
        return tone;
    }
    return 'neutral';
};

export default class WbKpiGrid extends WbBaseComponent {
    static get observedAttributes() {
        return ['data-kpi'];
    }

    parsePayload() {
        const raw = this.getAttribute('data-kpi') || '';
        if (!raw) {
            return { cards: [] };
        }

        try {
            const parsed = JSON.parse(decodeURIComponent(raw));
            return {
                cards: Array.isArray(parsed.cards) ? parsed.cards : []
            };
        } catch {
            return { cards: [] };
        }
    }

    render() {
        const payload = this.parsePayload();
        const cards = payload.cards;

        if (!cards.length) {
            this.innerHTML = '<section class="wb-kpi-grid"><p class="wb-kpi-empty">No KPI data available.</p></section>';
            return;
        }

        const cardsHtml = cards
            .map((card) => {
                const title = escapeHtml(String(card.title || 'KPI'));
                const value = escapeHtml(String(card.value || '-'));
                const trend = escapeHtml(String(card.trend || ''));
                const tone = normalizeTone(card.tone);
                return `<article class="wb-kpi-card tone-${tone}"><span class="wb-kpi-title">${title}</span><strong class="wb-kpi-value">${value}</strong>${trend ? `<small class="wb-kpi-trend">${trend}</small>` : ''}</article>`;
            })
            .join('');

        this.innerHTML = `<section class="wb-kpi-grid">${cardsHtml}</section>`;
    }
}
