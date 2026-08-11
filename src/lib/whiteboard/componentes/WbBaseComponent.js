export default class WbBaseComponent extends HTMLElement {
    constructor() {
        super();
        this._source = '';
        this._isInitialized = false;
    }

    connectedCallback() {
        if (!this._isInitialized) {
            this._source = this.innerHTML;
            this._isInitialized = true;
        }
        this.render();
    }

    attributeChangedCallback() {
        if (this._isInitialized) {
            this.render();
        }
    }

    render() {
    }
}