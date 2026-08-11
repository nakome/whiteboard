import WbBaseComponent from './WbBaseComponent.js';
import { escapeHtml } from './utils.js';

const QUADRANTS = [
    { key: 'quick_wins', label: 'Quick wins' },
    { key: 'major_projects', label: 'Major projects' },
    { key: 'fill_ins', label: 'Fill-ins' },
    { key: 'thankless_tasks', label: 'Thankless tasks' }
];

const normalizeQuadrant = (value) => {
    const key = String(value || 'quick_wins').toLowerCase();
    const match = QUADRANTS.find((item) => item.key === key);
    return match ? match.key : 'quick_wins';
};

export default class WbImpactMatrix extends WbBaseComponent {
    static get observedAttributes() {
        return ['data-matrix'];
    }

    parsePayload() {
        const raw = this.getAttribute('data-matrix') || '';
        if (!raw) {
            return { title: 'Impact vs Effort', items: [] };
        }

        try {
            const parsed = JSON.parse(decodeURIComponent(raw));
            return {
                title: String(parsed.title || 'Impact vs Effort'),
                items: Array.isArray(parsed.items) ? parsed.items : []
            };
        } catch {
            return { title: 'Impact vs Effort', items: [] };
        }
    }

    render() {
        const payload = this.parsePayload();

        const matrixHtml = QUADRANTS
            .map((quadrant) => {
                const items = payload.items
                    .filter((item) => normalizeQuadrant(item.quadrant) === quadrant.key)
                    .map((item) => `<li>${String(item.text || '')}</li>`)
                    .join('');
                return `<article class="wb-matrix-cell quadrant-${quadrant.key}"><h4>${escapeHtml(quadrant.label)}</h4><ul>${items || '<li class="is-empty">No items</li>'}</ul></article>`;
            })
            .join('');

        this.innerHTML = `<section class="wb-impact-matrix"><header class="wb-matrix-header">${escapeHtml(payload.title)}</header><div class="wb-matrix-grid">${matrixHtml}</div><footer class="wb-matrix-legend"><span>Low effort -> High effort</span><span>Low impact -> High impact</span></footer></section>`;
    }
}
