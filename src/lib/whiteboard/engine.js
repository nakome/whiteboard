/**
 * Vanilla whiteboard engine. Mounts into an existing DOM container.
 * No imports — browser APIs only. markdownToHtml is injected.
 */

export function initWhiteboard({ container, initialContent, onSave, markdownToHtml, readOnly = false }) {
  if (!container) return null;

  const state = {
    cards: [],
    arrows: [],
    zIndexCounter: 1,
    isSelecting: false,
    selectionStart: null,
    selectionBox: null,
    isDragging: false,
    isResizing: false,
    cardToDrag: null,
    cardToResize: null,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    activeContextMenu: null,
    isDrawingArrow: false,
    arrowStartCard: null,
  };

  let messageContainer = null;
  const messages = [];
  let pendingPaste = null;
  let destroyed = false;
  const abort = new AbortController();
  const { signal } = abort;

  function debounce(fn, delay) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function createElement(tag, parent, attributes = {}) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'style' && value && typeof value === 'object') Object.assign(el.style, value);
      else if (key === 'contentEditable') el.setAttribute('contenteditable', value);
      else el[key] = value;
    }
    if (parent) parent.appendChild(el);
    return el;
  }

  function showMessage(textContent, type = 'info', duration = 2000) {
    if (!messageContainer) {
      messageContainer = createElement('div', document.body, {
        id: 'message-container',
        style: {
          position: 'fixed', top: '10px', right: '10px', zIndex: '10000',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px',
        },
      });
    }
    const message = createElement('div', messageContainer, {
      textContent,
      className: `message ${type}`,
      style: {
        fontSize: '12px', color: 'var(--text-color)', opacity: '0',
        transition: 'opacity 0.3s ease', textTransform: 'uppercase',
      },
    });
    messages.push(message);
    messageContainer.style.display = 'flex';
    requestAnimationFrame(() => { message.style.opacity = '1'; });
    setTimeout(() => {
      message.style.opacity = '0';
      setTimeout(() => {
        message.remove();
        const i = messages.indexOf(message);
        if (i > -1) messages.splice(i, 1);
        if (!messages.length && messageContainer) messageContainer.style.display = 'none';
      }, 300);
    }, duration);
  }

  function closeMenus() {
    if (state.activeContextMenu) {
      state.activeContextMenu.remove();
      state.activeContextMenu = null;
    }
  }

  async function renderMarkdownPreview(preview, markdown) {
    const html = markdownToHtml(markdown);
    preview.innerHTML = html && typeof html.then === 'function' ? await html : (html || '');
  }

  function serializeContent() {
    return {
      cards: state.cards.map((card) => ({
        left: card.style.left,
        top: card.style.top,
        width: card.style.width,
        height: card.style.height,
        title: card.querySelector('.card-title')?.textContent || '',
        content: card.querySelector('.markdown-editor')?.value || '',
      })),
      arrows: state.arrows.map((arrow) => ({
        fromIndex: state.cards.indexOf(arrow.fromCard),
        toIndex: state.cards.indexOf(arrow.toCard),
      })).filter((a) => a.fromIndex >= 0 && a.toIndex >= 0),
    };
  }

  const saveDebounced = debounce(() => {
    if (destroyed || readOnly || typeof onSave !== 'function') return;
    onSave(serializeContent());
  }, 800);

  function createSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('arrow');
    Object.assign(svg.style, { position: 'absolute', pointerEvents: 'none', zIndex: '0' });
    return svg;
  }

  function createPath() {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--border-color)');
    path.setAttribute('stroke-width', '1');
    path.setAttribute('stroke-dasharray', '10, 5');
    path.setAttribute('stroke-dashoffset', '0');
    path.classList.add('animated-arrow-path');
    return path;
  }

  function updateArrowPosition(arrow) {
    const fromRect = arrow.fromCard.getBoundingClientRect();
    const toRect = arrow.toCard.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const startX = fromRect.right - cRect.left;
    const startY = fromRect.top + fromRect.height / 2 - cRect.top;
    const endX = toRect.left - cRect.left;
    const endY = toRect.top + toRect.height / 2 - cRect.top;
    arrow.svg.style.left = '0';
    arrow.svg.style.top = '0';
    arrow.svg.setAttribute('width', String(cRect.width));
    arrow.svg.setAttribute('height', String(cRect.height));
    const dx = endX - startX;
    const dy = endY - startY;
    const c1x = startX + Math.abs(dx) * 0.5;
    const c1y = startY + (dy > 0 ? Math.abs(dy) : -Math.abs(dy)) * 0.5;
    const c2x = endX - Math.abs(dx) * 0.5;
    const c2y = endY - (dy > 0 ? Math.abs(dy) : -Math.abs(dy)) * 0.5;
    arrow.path.setAttribute('d', `M ${startX},${startY} C ${c1x},${c1y} ${c2x},${c2y} ${endX},${endY}`);
    const angle = Math.atan2(endY - c2y, endX - c2x);
    const s = 10;
    const p1x = endX - s * Math.cos(angle - Math.PI / 6);
    const p1y = endY - s * Math.sin(angle - Math.PI / 6);
    const p2x = endX - s * Math.cos(angle + Math.PI / 6);
    const p2y = endY - s * Math.sin(angle + Math.PI / 6);
    arrow.arrowHead.setAttribute('points', `${endX},${endY} ${p1x},${p1y} ${p2x},${p2y}`);
    arrow.arrowHead.setAttribute('fill', 'var(--border-color)');
  }

  function createArrow(fromCard, toCard) {
    const svg = createSvg();
    const path = createPath();
    const arrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrowHead.setAttribute('fill', 'var(--border-color)');
    svg.appendChild(path);
    svg.appendChild(arrowHead);
    container.appendChild(svg);
    const arrow = { fromCard, toCard, svg, path, arrowHead };
    state.arrows.push(arrow);
    updateArrowPosition(arrow);
    return arrow;
  }

  function removeArrow(arrow) {
    arrow.svg.remove();
    state.arrows = state.arrows.filter((a) => a !== arrow);
    saveDebounced();
    showMessage('Arrow removed', 'success');
  }

  function setupCardListeners(card) {
    const title = card.querySelector('.card-title');
    const editor = card.querySelector('.markdown-editor');
    const preview = card.querySelector('.markdown-preview');
    const editIcon = card.querySelector('.edit-icon');
    const closeBtn = card.querySelector('.close-btn');

    if (readOnly) {
      if (title) title.setAttribute('contenteditable', 'false');
      if (closeBtn) closeBtn.style.display = 'none';
      if (editIcon) editIcon.style.display = 'none';
      return;
    }

    editIcon.addEventListener('click', () => {
      editor.style.display = 'block';
      preview.style.display = 'none';
      editIcon.style.display = 'none';
      editor.focus();
    }, { signal });

    editor.addEventListener('blur', () => {
      editor.style.display = 'none';
      preview.style.display = 'block';
      editIcon.style.display = 'inline';
      renderMarkdownPreview(preview, editor.value);
      saveDebounced();
    }, { signal });

    const onShortcodeUpdate = (event) => {
      const next = event?.detail?.markdown;
      if (typeof next !== 'string') return;
      editor.value = next;
      saveDebounced();
    };
    preview.addEventListener('wb-checklist-update', onShortcodeUpdate, { signal });
    preview.addEventListener('wb-tabs-update', onShortcodeUpdate, { signal });
    preview.addEventListener('wb-ai-quote-update', onShortcodeUpdate, { signal });

    title.addEventListener('blur', () => saveDebounced(), { signal });

    closeBtn.addEventListener('click', () => {
      state.arrows
        .filter((a) => a.fromCard === card || a.toCard === card)
        .forEach((arrow) => {
          arrow.svg.remove();
          state.arrows = state.arrows.filter((a) => a !== arrow);
        });
      card.remove();
      state.cards = state.cards.filter((c) => c !== card);
      saveDebounced();
    }, { signal });
  }

  function createCard({ x, y, width = 200, height = 150, title = 'Nota', content = '' }) {
    const card = createElement('div', container, {
      className: readOnly ? 'editable-box is-readonly' : 'editable-box',
      style: {
        left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`,
        zIndex: state.zIndexCounter++,
      },
    });
    const header = createElement('div', card, { className: 'card-header' });
    createElement('h3', header, {
      className: 'card-title',
      spellcheck: false,
      contentEditable: readOnly ? 'false' : 'true',
      textContent: String(title || ''),
    });
    const closeBtn = createElement('button', header, {
      className: 'close-btn',
      textContent: '×',
    });
    if (readOnly) {
      closeBtn.style.display = 'none';
    }
    const contentDiv = createElement('div', card, { className: 'card-content' });
    const editor = createElement('textarea', contentDiv, {
      className: 'markdown-editor', spellcheck: false, value: String(content || ''),
    });
    const preview = createElement('div', contentDiv, { className: 'markdown-preview' });
    if (!readOnly) {
      createElement('span', contentDiv, { className: 'edit-icon', textContent: '✏️' });
      createElement('div', card, { className: 'resize-handle' });
    }
    editor.style.display = 'none';
    preview.style.display = 'block';
    state.cards.push(card);
    queueMicrotask(() => {
      renderMarkdownPreview(preview, editor.value);
      setupCardListeners(card);
    });
    return card;
  }

  function cloneCard(card) {
    createCard({
      x: parseFloat(card.style.left) + 20,
      y: parseFloat(card.style.top) + 20,
      width: parseFloat(card.style.width),
      height: parseFloat(card.style.height),
      title: card.querySelector('.card-title')?.textContent || 'Nota',
      content: card.querySelector('.markdown-editor')?.value || '',
    });
    saveDebounced();
    showMessage('Card cloned', 'success');
  }

  function clearBoard(confirmClear = true) {
    if (confirmClear && !confirm('Are you sure you want to clear the whiteboard?')) return;
    state.cards.forEach((c) => c.remove());
    state.arrows.forEach((a) => a.svg.remove());
    state.cards = [];
    state.arrows = [];
    closeMenus();
    saveDebounced();
    showMessage('Whiteboard cleared', 'success');
  }

  function loadImageElement(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo cargar la imagen')); };
      img.src = url;
    });
  }

  async function compressImageBlob(blob, { maxWidth = 1280, maxHeight = 1280, quality = 0.72 } = {}) {
    let sourceWidth = 0;
    let sourceHeight = 0;
    let drawable = null;
    let bitmap = null;
    try {
      if (typeof createImageBitmap === 'function') {
        bitmap = await createImageBitmap(blob);
        sourceWidth = bitmap.width;
        sourceHeight = bitmap.height;
        drawable = bitmap;
      }
    } catch { /* fallback */ }
    if (!drawable) {
      const img = await loadImageElement(blob);
      sourceWidth = img.naturalWidth || img.width;
      sourceHeight = img.naturalHeight || img.height;
      drawable = img;
    }
    const ratio = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
    const width = Math.max(1, Math.round(sourceWidth * ratio));
    const height = Math.max(1, Math.round(sourceHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');
    ctx.drawImage(drawable, 0, 0, width, height);
    if (bitmap?.close) bitmap.close();
    const toBlob = (type, q) => new Promise((resolve) => {
      try { canvas.toBlob((r) => resolve(r), type, q); } catch { resolve(null); }
    });
    let compressed = await toBlob('image/jpeg', quality);
    if (!compressed?.size) compressed = await toBlob('image/webp', quality);
    if (!compressed?.size) compressed = await toBlob('image/png');
    if (!compressed) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      compressed = await (await fetch(dataUrl)).blob();
    }
    if (!compressed) throw new Error('No se pudo comprimir la imagen');
    return { blob: compressed, width, height };
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
  }

  async function createCardFromImageBlob(blob, x, y) {
    showMessage('Comprimiendo imagen…', 'info', 1500);
    const { blob: compressed, width, height } = await compressImageBlob(blob);
    const dataUrl = await blobToDataURL(compressed);
    const scale = Math.min(1, 420 / width, 360 / height);
    createCard({
      x, y,
      width: Math.max(180, Math.round(width * scale)),
      height: Math.max(160, Math.round(height * scale) + 28),
      title: 'Imagen pegada',
      content: `![Imagen](${dataUrl})`,
    });
    showMessage(`Imagen comprimida (${Math.round(compressed.size / 1024)} KB)`, 'success');
  }

  async function pasteClipboard(x, y) {
    closeMenus();
    if (navigator.clipboard?.read) {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            await createCardFromImageBlob(await item.getType(imageType), x, y);
            saveDebounced();
            return;
          }
        }
        for (const item of items) {
          if (item.types.includes('text/plain')) {
            const text = await (await item.getType('text/plain')).text();
            createCard({ x, y, title: 'Nota', content: text });
            saveDebounced();
            return;
          }
        }
      } catch { /* fallback */ }
    }
    if (navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (text?.trim()) {
          createCard({ x, y, title: 'Nota', content: text });
          saveDebounced();
          return;
        }
      } catch { /* fallback */ }
    }
    pendingPaste = { x, y, expires: Date.now() + 15000 };
    showMessage('Pulsa Ctrl+V para pegar la imagen', 'info', 4000);
  }

  function menuItem(menu, text, action, style = {}) {
    createElement('div', menu, {
      textContent: text,
      style: { padding: '5px', cursor: 'pointer', ...style },
    }).addEventListener('click', action, { signal });
  }

  function showWhiteboardContextMenu(event) {
    closeMenus();
    const cRect = container.getBoundingClientRect();
    const x = event.clientX - cRect.left;
    const y = event.clientY - cRect.top;
    const menu = createElement('div', container, {
      className: 'context-menu',
      style: {
        position: 'absolute', left: `${x}px`, top: `${y}px`, padding: '0', zIndex: '1000',
        fontSize: '12px', background: 'var(--bg-color)', border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', color: 'var(--text-color)',
      },
    });
    menuItem(menu, 'Paste clipboard', () => pasteClipboard(x, y));
    menuItem(menu, 'Paste as code', async () => {
      const text = await navigator.clipboard.readText();
      createCard({ x, y, width: 250, height: 200, title: 'Pasted Code', content: `\`\`\`\n${text}\n\`\`\`` });
      closeMenus();
      saveDebounced();
    });
    menuItem(menu, 'Create new card', () => {
      createCard({ x, y, width: 250, height: 200, title: 'New Card', content: '' });
      closeMenus();
      saveDebounced();
    });
    menuItem(menu, 'Clear Whiteboard', () => clearBoard(true), {
      backgroundColor: 'var(--danger)', color: 'var(--bg-color)',
    });
    state.activeContextMenu = menu;
  }

  function showCardContextMenu(event, card) {
    closeMenus();
    const cRect = container.getBoundingClientRect();
    const x = event.clientX - cRect.left;
    const y = event.clientY - cRect.top;
    const menu = createElement('div', container, {
      className: 'context-menu',
      style: {
        position: 'absolute', left: `${x}px`, top: `${y}px`, padding: '0', zIndex: '1000',
        fontSize: '12px', background: 'var(--bg-color)', border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', color: 'var(--text-color)',
      },
    });
    menuItem(menu, 'Clone this', () => { cloneCard(card); closeMenus(); });
    menuItem(menu, 'Connect with arrow', () => {
      state.isDrawingArrow = true;
      state.arrowStartCard = card;
      showMessage('Select card to connect', 'dark', 5000);
      closeMenus();
    });
    const connected = state.arrows.filter((a) => a.fromCard === card || a.toCard === card);
    if (connected.length) {
      const wrap = createElement('div', menu, {
        style: {
          position: 'relative', padding: '5px', cursor: 'pointer',
          background: 'var(--danger)', color: 'var(--bg-color)',
        },
      });
      createElement('div', wrap, { textContent: 'Disconnect arrows', style: { padding: '0' } });
      const sub = createElement('div', wrap, {
        className: 'submenu',
        style: {
          display: 'none', position: 'absolute', left: '100%', top: '0', width: '100%',
          fontSize: '12px', background: 'var(--bg-color)', border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow)', color: 'var(--text-color)',
        },
      });
      connected.forEach((arrow) => {
        const other = arrow.fromCard === card ? arrow.toCard : arrow.fromCard;
        const t = other.querySelector('.card-title')?.textContent || 'card';
        createElement('div', sub, {
          textContent: `× "${t}"`,
          style: { padding: '5px', cursor: 'pointer', color: 'var(--text-color)' },
        }).addEventListener('click', () => { removeArrow(arrow); closeMenus(); }, { signal });
      });
      wrap.addEventListener('mouseenter', () => { sub.style.display = 'block'; }, { signal });
      wrap.addEventListener('mouseleave', () => { sub.style.display = 'none'; }, { signal });
    }
    state.activeContextMenu = menu;
  }

  function renderBoard(data) {
    container.querySelectorAll('.editable-box, .arrow, .selection-box, .context-menu').forEach((el) => el.remove());
    state.cards = [];
    state.arrows = [];
    const cards = Array.isArray(data?.cards) ? data.cards : [];
    const arrows = Array.isArray(data?.arrows) ? data.arrows : [];
    cards.forEach((c) => {
      createCard({
        x: parseFloat(c.left) || 0,
        y: parseFloat(c.top) || 0,
        width: parseFloat(c.width) || 200,
        height: parseFloat(c.height) || 150,
        title: c.title || 'Nota',
        content: c.content || '',
      });
    });
    setTimeout(() => {
      arrows.forEach((a) => {
        const from = state.cards[a.fromIndex];
        const to = state.cards[a.toIndex];
        if (from && to) createArrow(from, to);
      });
    }, 50);
  }

  if (!readOnly) {
    document.addEventListener('mousemove', (event) => {
      const cRect = container.getBoundingClientRect();
      if (state.isDragging || state.isResizing) {
        state.arrows.forEach(updateArrowPosition);
      }
      if (state.isDragging && state.cardToDrag) {
        const x = event.clientX - cRect.left - state.offsetX;
        const y = event.clientY - cRect.top - state.offsetY;
        const card = state.cardToDrag;
        requestAnimationFrame(() => {
          card.style.left = `${Math.max(0, Math.min(x, cRect.width - card.offsetWidth))}px`;
          card.style.top = `${Math.max(0, Math.min(y, cRect.height - card.offsetHeight))}px`;
        });
      } else if (state.isResizing && state.cardToResize) {
        const w = state.startWidth + (event.clientX - state.startX);
        const h = state.startHeight + (event.clientY - state.startY);
        requestAnimationFrame(() => {
          state.cardToResize.style.width = `${Math.max(100, w)}px`;
          state.cardToResize.style.height = `${Math.max(100, h)}px`;
        });
      } else if (state.isSelecting && state.selectionBox) {
        const x = event.clientX - cRect.left;
        const y = event.clientY - cRect.top;
        const left = Math.min(x, state.selectionStart.x);
        const top = Math.min(y, state.selectionStart.y);
        const box = state.selectionBox;
        requestAnimationFrame(() => {
          if (!box) return;
          box.style.left = `${left}px`;
          box.style.top = `${top}px`;
          box.style.width = `${Math.abs(x - state.selectionStart.x)}px`;
          box.style.height = `${Math.abs(y - state.selectionStart.y)}px`;
        });
      }
    }, { signal });

    document.addEventListener('mouseup', () => {
      if (state.isDragging || state.isResizing) {
        state.arrows.forEach(updateArrowPosition);
        state.isDragging = false;
        state.cardToDrag = null;
        state.isResizing = false;
        state.cardToResize = null;
        saveDebounced();
      } else if (state.isSelecting) {
        state.isSelecting = false;
        const w = parseFloat(state.selectionBox.style.width);
        const h = parseFloat(state.selectionBox.style.height);
        if (w >= 50 && h >= 50) {
          createCard({
            x: parseFloat(state.selectionBox.style.left),
            y: parseFloat(state.selectionBox.style.top),
            width: w,
            height: h,
          });
          saveDebounced();
        }
        state.selectionBox.remove();
        state.selectionBox = null;
      }
    }, { signal });

    container.addEventListener('mousedown', (event) => {
      if (event.target.closest('.context-menu')) return;
      const card = event.target.closest('.editable-box');
      if (state.isDrawingArrow && card && card !== state.arrowStartCard) {
        createArrow(state.arrowStartCard, card);
        state.isDrawingArrow = false;
        state.arrowStartCard = null;
        saveDebounced();
        showMessage('Arrow created', 'success');
        return;
      }
      if (card && event.target.classList.contains('resize-handle')) {
        state.isResizing = true;
        state.cardToResize = card;
        state.startWidth = card.offsetWidth;
        state.startHeight = card.offsetHeight;
        state.startX = event.clientX;
        state.startY = event.clientY;
      } else if (card && event.target.classList.contains('card-header')) {
        state.isDragging = true;
        state.cardToDrag = card;
        const cRect = container.getBoundingClientRect();
        state.offsetX = event.clientX - cRect.left - parseFloat(card.style.left);
        state.offsetY = event.clientY - cRect.top - parseFloat(card.style.top);
        card.style.zIndex = state.zIndexCounter++;
      } else if (!card) {
        state.isSelecting = true;
        const cRect = container.getBoundingClientRect();
        state.selectionStart = {
          x: event.clientX - cRect.left,
          y: event.clientY - cRect.top,
        };
        state.selectionBox = createElement('div', container, {
          className: 'selection-box',
          style: { left: `${state.selectionStart.x}px`, top: `${state.selectionStart.y}px` },
        });
      }
    }, { signal });

    container.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const card = event.target.closest('.editable-box');
      if (card && event.target.classList.contains('card-header')) showCardContextMenu(event, card);
      else if (!card) showWhiteboardContextMenu(event);
    }, { signal });

    document.addEventListener('click', (event) => {
      if (state.activeContextMenu && !event.target.closest('.context-menu')) closeMenus();
    }, { signal });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenus();
        state.isDrawingArrow = false;
        state.arrowStartCard = null;
      }
    }, { signal });

    document.addEventListener('paste', async (event) => {
      const waiting = pendingPaste && Date.now() <= pendingPaste.expires;
      const target = event.target;
      const editing =
        target instanceof HTMLTextAreaElement
        || target instanceof HTMLInputElement
        || (target instanceof HTMLElement && target.isContentEditable);
      if (editing && !waiting) return;

      const items = Array.from(event.clipboardData?.items || []);
      const imageItem = items.find((i) => i.type.startsWith('image/'));
      const textItem = items.find((i) => i.type === 'text/plain');
      const rect = container.getBoundingClientRect();
      const x = waiting ? pendingPaste.x : Math.max(20, Math.round(rect.width / 2 - 160));
      const y = waiting ? pendingPaste.y : Math.max(20, Math.round(rect.height / 2 - 140));

      if (imageItem) {
        event.preventDefault();
        pendingPaste = null;
        const blob = imageItem.getAsFile();
        if (!blob) { showMessage('No se pudo leer la imagen', 'error'); return; }
        try {
          await createCardFromImageBlob(blob, x, y);
          saveDebounced();
        } catch {
          showMessage('No se pudo pegar la imagen', 'error');
        }
        return;
      }

      if (waiting && textItem) {
        event.preventDefault();
        pendingPaste = null;
        const text = event.clipboardData.getData('text/plain');
        if (text?.trim()) {
          createCard({ x, y, title: 'Nota', content: text });
          saveDebounced();
        } else showMessage('Portapapeles vacío', 'error');
      }
    }, { signal });
  }

  if (readOnly) {
    container.classList.add('wb-readonly');
  }

  renderBoard(initialContent || { cards: [], arrows: [] });

  const api = {
    getContent() {
      return serializeContent();
    },
    setContent(content) {
      renderBoard(content || { cards: [], arrows: [] });
    },
    createCardFromTemplate({ title = 'Nota', content = '', x = 120, y = 120, width = 320, height = 120 } = {}) {
      if (readOnly) return;
      createCard({ title, content, x, y, width, height });
      saveDebounced();
    },
    clear() {
      if (readOnly) return;
      clearBoard(false);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      abort.abort();
      closeMenus();
      state.cards.forEach((c) => c.remove());
      state.arrows.forEach((a) => a.svg.remove());
      state.cards = [];
      state.arrows = [];
      if (state.selectionBox) {
        state.selectionBox.remove();
        state.selectionBox = null;
      }
      if (messageContainer) {
        messageContainer.remove();
        messageContainer = null;
      }
      messages.length = 0;
    },
  };

  return api;
}

export function destroyWhiteboard(api) {
  if (api && typeof api.destroy === 'function') api.destroy();
}
