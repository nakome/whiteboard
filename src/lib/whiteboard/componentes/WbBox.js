import WbBaseComponent from './WbBaseComponent.js';
import { escapeHtml, toSafeNumber } from './utils.js';

export default class WbBox extends WbBaseComponent {
    static get observedAttributes() {
        return ['num'];
    }

    render() {
        const num = toSafeNumber(this.getAttribute('num'), 6);
        this.innerHTML = `<div class="box-${num}">${this._source}</div>`;
    }
}
