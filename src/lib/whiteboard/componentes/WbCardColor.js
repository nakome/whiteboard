import WbBaseComponent from './WbBaseComponent.js';
import { escapeHtml } from './utils.js';

export default class WbCardColor extends WbBaseComponent {
    static get observedAttributes() {
        return ['name'];
    }

    render() {
        const color = this.getAttribute('name') || 'red';
        this.innerHTML = `<span style="color:${escapeHtml(color)}">${this._source}</span>`;
    }
}