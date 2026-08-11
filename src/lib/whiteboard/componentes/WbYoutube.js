import WbBaseComponent from './WbBaseComponent.js';
import { escapeHtml, toSafeNumber } from './utils.js';

export default class WbYoutube extends WbBaseComponent {
    static get observedAttributes() {
        return ['id', 'title', 'width', 'height'];
    }

    render() {
        const rawId = this.getAttribute('id') || '';
        const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
        const title = this.getAttribute('title') || '';
        const width = toSafeNumber(this.getAttribute('width'), 480);
        const height = toSafeNumber(this.getAttribute('height'), 320);

        if (!id) {
            this.innerHTML = 'Id not found';
            return;
        }

        this.innerHTML =
            `<div class="relative h-0 overflow-hidden pb-[56.25%]">` +
            `<iframe class="absolute left-0 top-0 h-full w-full overflow-hidden" width="${width}" height="${height}" src="https://www.youtube.com/embed/${id}" title="${escapeHtml(title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>` +
            `</div>`;
    }
}
