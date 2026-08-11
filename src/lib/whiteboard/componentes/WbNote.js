import WbBaseComponent from './WbBaseComponent.js';

export default class WbNote extends WbBaseComponent {
    static get observedAttributes() {
        return ['name', 'class-name'];
    }

    render() {
        const name = this.getAttribute('name');
        const extraClass = this.getAttribute('class-name') || '';
        const classes = name ? `note note-${name} ${extraClass}` : `note ${extraClass}`;
        this.innerHTML = `<div class="${classes.trim()}">${this._source}</div>`;
    }
}
