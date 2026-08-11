import WbBaseComponent from './WbBaseComponent.js';
import { escapeHtml } from './utils.js';

export default class WbChecklist extends WbBaseComponent {
    static get observedAttributes() {
        return ['data-items'];
    }

    parsePayload() {
        const raw = this.getAttribute('data-items') || '';
        if (!raw) {
            return { title: 'Checklist', items: [] };
        }

        try {
            const parsed = JSON.parse(decodeURIComponent(raw));
            return {
                title: String(parsed.title || 'Checklist'),
                items: Array.isArray(parsed.items) ? parsed.items : []
            };
        } catch {
            return { title: 'Checklist', items: [] };
        }
    }

    render() {
        const payload = this.parsePayload();
        const items = payload.items;
        const total = items.length;
        const completed = items.filter((item) => Boolean(item.checked)).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        const htmlItems = items
            .map((item, index) => {
                const checked = Boolean(item.checked);
                const text = String(item.text || '');
                const raw = escapeHtml(String(item.raw || ''));
                return `<label class="wb-checklist-item${checked ? ' is-checked' : ''}" draggable="true" data-drag-index="${index}" data-raw="${raw}"><button type="button" class="wb-checklist-drag" aria-label="Drag item">::</button><input type="checkbox" data-check-index="${index}" ${checked ? 'checked' : ''} /><span>${text}</span></label>`;
            })
            .join('');

        this.innerHTML =
            `<section class="wb-checklist">` +
            `<header class="wb-checklist-header">` +
            `<strong class="wb-checklist-title">${escapeHtml(payload.title)}</strong>` +
            `<span class="wb-checklist-meta"><b data-check-count="done">${completed}</b>/<b data-check-count="total">${total}</b> (${percent}%)</span>` +
            `</header>` +
            `<div class="wb-checklist-progress"><div class="wb-checklist-progress-bar" data-check-progress style="width:${percent}%"></div></div>` +
            `<div class="wb-checklist-items">${htmlItems}</div>` +
            `</section>`;

        const checkboxes = Array.from(this.querySelectorAll('input[data-check-index]'));
        checkboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                const row = checkbox.closest('.wb-checklist-item');
                row?.classList.toggle('is-checked', checkbox.checked);
                this.updateProgressFromDom();
            });
        });

        this.attachDragAndDrop();
    }

    attachDragAndDrop() {
        let sourceRow = null;
        const rows = Array.from(this.querySelectorAll('.wb-checklist-item'));

        rows.forEach((row) => {
            row.addEventListener('dragstart', () => {
                sourceRow = row;
                row.classList.add('is-dragging');
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('is-dragging');
                rows.forEach((item) => item.classList.remove('is-drop-target'));
            });

            row.addEventListener('dragover', (event) => {
                event.preventDefault();
                if (sourceRow && sourceRow !== row) {
                    rows.forEach((item) => item.classList.remove('is-drop-target'));
                    row.classList.add('is-drop-target');
                }
            });

            row.addEventListener('drop', (event) => {
                event.preventDefault();
                if (!sourceRow || sourceRow === row) {
                    return;
                }

                const container = this.querySelector('.wb-checklist-items');
                if (!container) {
                    return;
                }

                const sourceRect = sourceRow.getBoundingClientRect();
                const targetRect = row.getBoundingClientRect();
                const moveDown = sourceRect.top < targetRect.top;

                if (moveDown) {
                    container.insertBefore(sourceRow, row.nextSibling);
                } else {
                    container.insertBefore(sourceRow, row);
                }

                rows.forEach((item) => item.classList.remove('is-drop-target'));
                this.updateProgressFromDom();
            });
        });
    }

    updateProgressFromDom() {
        const checkboxes = Array.from(this.querySelectorAll('input[data-check-index]'));
        const total = checkboxes.length;
        const completed = checkboxes.filter((checkbox) => checkbox.checked).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        const progress = this.querySelector('[data-check-progress]');
        const doneCounter = this.querySelector('[data-check-count="done"]');
        const totalCounter = this.querySelector('[data-check-count="total"]');
        const meta = this.querySelector('.wb-checklist-meta');

        if (progress) {
            progress.style.width = `${percent}%`;
        }

        if (doneCounter) {
            doneCounter.textContent = String(completed);
        }

        if (totalCounter) {
            totalCounter.textContent = String(total);
        }

        if (meta) {
            meta.innerHTML = `<b data-check-count="done">${completed}</b>/<b data-check-count="total">${total}</b> (${percent}%)`;
        }

        this.emitChecklistUpdate();
    }

    emitChecklistUpdate() {
        const rows = Array.from(this.querySelectorAll('.wb-checklist-item'));
        const title = String(this.parsePayload().title || 'Checklist').replaceAll("'", "\\'");
        const lines = rows.map((row) => {
            const checkbox = row.querySelector('input[data-check-index]');
            const checked = Boolean(checkbox?.checked);
            const raw = String(row.getAttribute('data-raw') || '').trim();
            return `- [${checked ? 'x' : ' '}] ${raw}`;
        });

        const markdown = `[Checklist title='${title}']\n${lines.join('\n')}\n[/Checklist]`;
        this.dispatchEvent(new CustomEvent('wb-checklist-update', {
            bubbles: true,
            composed: true,
            detail: { markdown }
        }));
    }
}
