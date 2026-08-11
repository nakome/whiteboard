import WbBaseComponent from './WbBaseComponent.js';
import { escapeHtml } from './utils.js';

export default class WbTabs extends WbBaseComponent {
    static get observedAttributes() {
        return ['data-tabs'];
    }

    parsePayload() {
        const raw = this.getAttribute('data-tabs') || '';
        if (!raw) {
            return { tabs: [], active: 0 };
        }

        try {
            const parsed = JSON.parse(decodeURIComponent(raw));
            const tabs = Array.isArray(parsed.tabs) ? parsed.tabs : [];
            const requestedActive = Number(parsed.active || 0);
            const active = Number.isFinite(requestedActive) && requestedActive >= 0 ? requestedActive : 0;
            return { tabs, active };
        } catch {
            return { tabs: [], active: 0 };
        }
    }

    render() {
        const payload = this.parsePayload();
        const tabs = payload.tabs;

        if (!tabs.length) {
            this.innerHTML = '<div class="wb-tabs wb-tabs-empty">Sin tabs para mostrar.</div>';
            return;
        }

        const safeActive = Math.min(payload.active, tabs.length - 1);

        const tabButtons = tabs
            .map((tab, index) => {
                const isActive = index === safeActive;
                const title = escapeHtml(String(tab.title || `Tab ${index + 1}`));
                return `<button type="button" class="wb-tabs-btn${isActive ? ' is-active' : ''}" data-tab-index="${index}" aria-selected="${isActive ? 'true' : 'false'}">${title}</button>`;
            })
            .join('');

        const tabPanels = tabs
            .map((tab, index) => {
                const isActive = index === safeActive;
                return `<section class="wb-tabs-panel${isActive ? ' is-active' : ''}" data-tab-panel="${index}" ${isActive ? '' : 'hidden'}>${String(tab.content || '')}</section>`;
            })
            .join('');

        this.innerHTML = `<div class="wb-tabs"><div class="wb-tabs-nav" role="tablist">${tabButtons}</div><div class="wb-tabs-content">${tabPanels}</div></div>`;

        const buttons = Array.from(this.querySelectorAll('.wb-tabs-btn'));
        const panels = Array.from(this.querySelectorAll('.wb-tabs-panel'));

        buttons.forEach((button) => {
            button.addEventListener('click', () => {
                const targetIndex = Number(button.getAttribute('data-tab-index'));

                buttons.forEach((currentButton, currentIndex) => {
                    const active = currentIndex === targetIndex;
                    currentButton.classList.toggle('is-active', active);
                    currentButton.setAttribute('aria-selected', active ? 'true' : 'false');
                });

                panels.forEach((panel, currentIndex) => {
                    const active = currentIndex === targetIndex;
                    panel.classList.toggle('is-active', active);
                    panel.toggleAttribute('hidden', !active);
                });

                this.emitTabsUpdate(targetIndex);
            });
        });
    }

    emitTabsUpdate(activeIndex) {
        const payload = this.parsePayload();
        const tabs = payload.tabs;
        if (!tabs.length) {
            return;
        }

        const tabLines = tabs
            .map((tab) => {
                const name = String(tab.title || 'Tab').replaceAll("'", "\\'");
                const raw = String(tab.raw || tab.content || '').trim();
                return `[Tab name='${name}']${raw}[/Tab]`;
            })
            .join('\n');

        const markdown = `[Tabs active=${activeIndex}]\n${tabLines}\n[/Tabs]`;
        this.dispatchEvent(new CustomEvent('wb-tabs-update', {
            bubbles: true,
            composed: true,
            detail: { markdown }
        }));
    }
}
