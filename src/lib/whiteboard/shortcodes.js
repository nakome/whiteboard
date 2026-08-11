import './componentes/index.js';

const isLowerCaseOrDigit = (char) => /[a-z0-9]/.test(char);
const escapeSpecialCharacter = (char) => char.replace('$', '\\$');
const escapeHtmlAttribute = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const closeTagString = (name) => {
    if (!isLowerCaseOrDigit(name[0])) {
        return `[${escapeSpecialCharacter(name[0])}]?${name.slice(1)}`;
    }
    return name;
};

const typecast = (val) => {
    val = val.trim().replace(/(^['"]|['"]$)/g, '');
    if (/^\d+$/.test(val)) return Number(val);
    if (/^\d+\.\d+$/.test(val)) return Number(val);
    if (val === 'true' || val === 'false') return val === 'true';
    if (val === 'undefined') return undefined;
    if (val === 'null') return null;
    return val;
};

const formatRegExp = /%[sdj%]/g;

const format = (f, ...args) => {
    if (typeof f !== 'string') return args.map(String).join(' ');

    let i = 0;
    const str = String(f).replace(formatRegExp, (x) => {
        if (x === '%%') return '%';
        if (i >= args.length) return x;
        switch (x) {
            case '%s':
                return String(args[i++]);
            case '%d':
                return Number(args[i++]);
            case '%j':
                try {
                    return JSON.stringify(args[i++]);
                } catch {
                    return '[Circular]';
                }
            default:
                return x;
        }
    });

    return str + (i < args.length ? ' ' + args.slice(i).join(' ') : '');
};

const REGEX_PATTERNS = {
    ATTRS: /(\s+([a-z0-9\-_]+|([a-z0-9\-_]+)\s*=\s*([a-z0-9\-_]+|\d+\.\d+|'[^']*'|"[^"]*")))*/,
    SLASH: /\s*\/?\s*/,
    OPEN: /\[\s*%s/,
    RIGHT_BRACKET: '\\]',
    CLOSE: /\[\s*\/\s*%s\s*\]/,
    CONTENT: /(.|\n)*?/
};

class ShortCode {
    constructor() {
        this.callbacks = new Map();
        this.callbacks.set('parse', this.parse.bind(this));
        this.callbacks.set('parseInContext', this.parseInContext.bind(this));
    }

    add(name, callback) {
        if (typeof name === 'object') {
            for (const [key, value] of Object.entries(name)) {
                if (typeof value === 'function') {
                    this.callbacks.set(key, value);
                }
            }
            return;
        }

        this.callbacks.set(name, callback);
    }

    parse(buf, extra = {}, context = this.callbacks) {
        for (const [name, callback] of context) {
            if (name === 'parse' || name === 'parseInContext') continue;

            const regex = {
                wrapper: new RegExp(
                    format(REGEX_PATTERNS.OPEN.source, name) +
                        REGEX_PATTERNS.ATTRS.source +
                        REGEX_PATTERNS.RIGHT_BRACKET +
                        REGEX_PATTERNS.CONTENT.source +
                        format(REGEX_PATTERNS.CLOSE.source, closeTagString(name)),
                    'gi'
                ),
                inline: new RegExp(
                    format(REGEX_PATTERNS.OPEN.source, name) +
                        REGEX_PATTERNS.ATTRS.source +
                        REGEX_PATTERNS.SLASH.source +
                        REGEX_PATTERNS.RIGHT_BRACKET,
                    'gi'
                )
            };

            for (const [type, pattern] of Object.entries(regex)) {
                const matches = buf.match(pattern);
                if (!matches) continue;

                for (const match of matches) {
                    const { content, attr } = this.parseShortcode(name, match, type === 'inline');
                    buf = buf.replace(match, callback.call(null, content, attr, extra));
                }
            }
        }

        return buf;
    }

    parseInContext(buf, context, data) {
        return this.parse(buf, data, new Map(Object.entries(context)));
    }

    parseShortcode(name, buf, inline = false) {
        const regex = new RegExp(
            '^' +
                format(REGEX_PATTERNS.OPEN.source, name) +
                REGEX_PATTERNS.ATTRS.source +
                /\s*/.source +
                (inline ? REGEX_PATTERNS.SLASH.source + REGEX_PATTERNS.RIGHT_BRACKET : REGEX_PATTERNS.RIGHT_BRACKET),
            'i'
        );

        const attr = {};
        let content = buf;

        let match;
        while ((match = content.match(regex)) !== null) {
            const key = match[3] || match[2];
            const val = match[4] || match[3];
            const pattern = match[1];

            if (!pattern) {
                break;
            }

            const idx = content.lastIndexOf(pattern);
            attr[key] = val !== undefined ? typecast(val) : true;
            content = content.slice(0, idx) + content.slice(idx + pattern.length);
        }

        content = content
            .replace(regex, '')
            .replace(new RegExp(format(REGEX_PATTERNS.CLOSE.source, closeTagString(name))), '');

        return {
            attr: Object.fromEntries(Object.entries(attr).reverse()),
            content: inline ? content : content.replace(/(^\n|\n$)/g, '')
        };
    }
}

function buildShortcodes(markedLib, shortcode) {
    return [
        {
            name: 'Boxes',
            handler: (element) => `<div class="boxes">${element}</div>`
        },
        {
            name: 'Box',
            handler: (element, options) => {
                const num = options.num ? options.num : 6;
                return `<wb-box num="${num}">${markedLib.parse(shortcode.parse(element))}</wb-box>`;
            }
        },
        {
            name: 'Youtube',
            handler: (_element, options) => {
                const id = options.id ? options.id : '';
                const title = options.title ? options.title : '';
                const width = options.width ? options.width : '480';
                const height = options.height ? options.height : '320';
                return `<wb-youtube id="${id}" title="${title}" width="${width}" height="${height}"></wb-youtube>`;
            }
        },
        {
            name: 'Iframe',
            handler: (_element, options) => {
                const src = options.src ? options.src : '';
                const title = options.title ? options.title : '';
                const width = options.width ? options.width : '480';
                const height = options.height ? options.height : '320';
                return src
                    ? `<div class="relative h-0 overflow-hidden pb-[56.25%]"><iframe class="absolute left-0 top-0 h-full w-full overflow-hidden" width="${width}" height="${height}" src="${src}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`
                    : 'Src not found';
            }
        },
        {
            name: 'Video',
            handler: (_element, options) => {
                const src = options.src ? String(options.src) : '';
                const poster = options.poster ? String(options.poster) : '';
                const controls = options.controls === false ? '' : ' controls';
                const autoplay = options.autoplay ? ' autoplay' : '';
                const muted = options.muted ? ' muted' : '';
                const loop = options.loop ? ' loop' : '';
                const playsinline = options.playsinline ? ' playsinline' : '';
                const preload = options.preload ? ` preload="${String(options.preload)}"` : '';
                const width = options.width ? ` width="${String(options.width)}"` : '';
                const height = options.height ? ` height="${String(options.height)}"` : '';
                const title = options.title ? ` title="${String(options.title)}"` : '';
                const posterAttr = poster !== '' ? ` poster="${poster}"` : '';
                return src !== ''
                    ? `<video class="w-full rounded"${controls}${autoplay}${muted}${loop}${playsinline}${preload}${width}${height}${posterAttr}${title} src="${src}"></video>`
                    : 'Src not found';
            }
        },
        {
            name: 'Audio',
            handler: (_element, options) => {
                const src = options.src ? String(options.src) : '';
                const controls = options.controls === false ? '' : ' controls';
                const autoplay = options.autoplay ? ' autoplay' : '';
                const muted = options.muted ? ' muted' : '';
                const loop = options.loop ? ' loop' : '';
                const preload = options.preload ? ` preload="${String(options.preload)}"` : '';
                return src !== ''
                    ? `<audio class="w-full"${controls}${autoplay}${muted}${loop}${preload} src="${src}"></audio>`
                    : 'Src not found';
            }
        },
        {
            name: 'Color',
            handler: (element, options) => {
                const color = options.name ? options.name : 'red';
                return `<wb-card-color name="${color}">${markedLib.parseInline(element)}</wb-card-color>`;
            }
        },
        {
            name: 'Justify',
            handler: (element) => `<div class="text-justify">${markedLib.parse(element)}</div>`
        },
        {
            name: 'Center',
            handler: (element) => `<div class="text-center">${markedLib.parse(element)}</div>`
        },
        {
            name: 'Right',
            handler: (element) => `<div class="text-right">${markedLib.parse(element)}</div>`
        },
        {
            name: 'Divider',
            handler: (_element, options) => {
                const num = options.num ? options.num : 1;
                return `<div class="divider" style="margin:${num}em auto">&nbsp;</div>`;
            }
        },
        {
            name: 'Note',
            handler: (element, options) => {
                const extend = options.class ? options.class : '';
                const variant = options.name ? options.name : '';
                return `<wb-note name="${variant}" class-name="${extend}">${markedLib.parseInline(element)}</wb-note>`;
            }
        },
        {
            name: 'SmartQuote',
            handler: (element, options) => {
                const prompt = options.prompt
                    ? String(options.prompt)
                    : String(element || '').trim();
                const tone = options.tone ? String(options.tone) : 'inspirador';
                const language = options.lang
                    ? String(options.lang)
                    : (options.language ? String(options.language) : 'es');
                const author = options.author ? String(options.author) : '';
                const quote = options.quote ? String(options.quote) : '';
                const payload = encodeURIComponent(JSON.stringify({
                    prompt,
                    tone,
                    language,
                    author,
                    quote
                }));

                return `<wb-ai-quote data-payload="${escapeHtmlAttribute(payload)}"></wb-ai-quote>`;
            }
        },
        {
            name: 'Code',
            handler: (element, options) => {
                const title = options.title ? String(options.title) : 'Code';
                const lang = options.lang
                    ? String(options.lang)
                    : (options.language ? String(options.language) : 'txt');
                const code = String(element || '');
                const open = Boolean(options.open);
                const payload = encodeURIComponent(JSON.stringify({
                    title,
                    lang,
                    code,
                    open
                }));

                return `<wb-hide-code data-payload="${escapeHtmlAttribute(payload)}"></wb-hide-code>`;
            }
        },
        {
            name: 'Columns',
            handler: (element, options) => {
                const num = options.num ? options.num : 2;
                return `<div class="col-${num}">${markedLib.parse(element)}</div>`;
            }
        },
        {
            name: 'Tabs',
            handler: (element, options) => {
                const tabRegex = /\[Tab(?:\s+name=(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\]([\s\S]*?)\[\/Tab\]/gi;
                const tabs = [];
                let match;

                while ((match = tabRegex.exec(String(element || ''))) !== null) {
                    const title = String(match[1] || match[2] || match[3] || `Tab ${tabs.length + 1}`);
                    const raw = String(match[4] || '').trim();
                    tabs.push({
                        title,
                        raw,
                        content: markedLib.parse(shortcode.parse(raw))
                    });
                }

                if (tabs.length === 0) {
                    const title = options.title ? String(options.title) : 'Contenido';
                    tabs.push({
                        title,
                        content: markedLib.parse(shortcode.parse(String(element || '')))
                    });
                }

                const requestedActive = Number(options.active ?? 0);
                const active = Number.isFinite(requestedActive) && requestedActive >= 0 ? requestedActive : 0;
                const payload = encodeURIComponent(JSON.stringify({ tabs, active }));
                return `<wb-tabs data-tabs="${payload}"></wb-tabs>`;
            }
        },
        {
            name: 'Checklist',
            handler: (element, options) => {
                const rawLines = String(element || '').split('\n');
                const listItems = [];

                for (const rawLine of rawLines) {
                    const line = String(rawLine || '').trim();
                    if (!line) {
                        continue;
                    }

                    const taskMatch = line.match(/^[-*]\s*\[( |x|X)\]\s+(.+)$/);
                    if (taskMatch) {
                        const rawText = String(taskMatch[2] || '').trim();
                        listItems.push({
                            checked: /x/i.test(taskMatch[1]),
                            raw: rawText,
                            text: markedLib.parseInline(shortcode.parse(rawText))
                        });
                        continue;
                    }

                    listItems.push({
                        checked: false,
                        raw: line,
                        text: markedLib.parseInline(shortcode.parse(line))
                    });
                }

                const title = options.title ? String(options.title) : 'Checklist';
                const payload = encodeURIComponent(JSON.stringify({ title, items: listItems }));
                return `<wb-checklist data-items="${payload}"></wb-checklist>`;
            }
        },
        {
            name: 'Timeline',
            handler: (element, options) => {
                const rawLines = String(element || '').split('\n').map((line) => line.trim()).filter(Boolean);
                const items = rawLines.map((line) => {
                    const parts = line.split('|').map((part) => part.trim());
                    const date = parts[0] || '';
                    const title = parts[1] || parts[0] || 'Hito';
                    const description = parts[2] || '';
                    const state = String(parts[3] || 'planned').toLowerCase();
                    return {
                        date,
                        title,
                        description: description ? markedLib.parseInline(shortcode.parse(description)) : '',
                        state
                    };
                });

                const timelineTitle = options.title ? String(options.title) : 'Timeline';
                const payload = encodeURIComponent(JSON.stringify({ title: timelineTitle, items }));
                return `<wb-timeline data-items="${payload}"></wb-timeline>`;
            }
        },
        {
            name: 'KPI',
            handler: (_element, options) => {
                const cards = [];
                const value = options.value ? String(options.value) : '';
                const title = options.title ? String(options.title) : 'KPI';
                const trend = options.trend ? String(options.trend) : '';
                const tone = options.tone ? String(options.tone).toLowerCase() : 'neutral';

                cards.push({ title, value, trend, tone });

                const payload = encodeURIComponent(JSON.stringify({ cards }));
                return `<wb-kpi-grid data-kpi="${payload}"></wb-kpi-grid>`;
            }
        },
        {
            name: 'KPIGrid',
            handler: (element, options) => {
                const rawLines = String(element || '').split('\n').map((line) => line.trim()).filter(Boolean);
                const cards = rawLines.map((line) => {
                    const parts = line.split('|').map((part) => part.trim());
                    return {
                        title: parts[0] || 'KPI',
                        value: parts[1] || '-',
                        trend: parts[2] || '',
                        tone: String(parts[3] || 'neutral').toLowerCase()
                    };
                });

                if (!cards.length) {
                    cards.push({
                        title: options.title ? String(options.title) : 'KPI',
                        value: options.value ? String(options.value) : '-',
                        trend: options.trend ? String(options.trend) : '',
                        tone: options.tone ? String(options.tone).toLowerCase() : 'neutral'
                    });
                }

                const payload = encodeURIComponent(JSON.stringify({ cards }));
                return `<wb-kpi-grid data-kpi="${payload}"></wb-kpi-grid>`;
            }
        },
        {
            name: 'Changelog',
            handler: (element, options) => {
                const rawLines = String(element || '').split('\n').map((line) => line.trim()).filter(Boolean);
                const items = rawLines.map((line) => {
                    const parts = line.split('|').map((part) => part.trim());
                    return {
                        version: parts[0] || 'v0.0.0',
                        date: parts[1] || '',
                        change: parts[2] ? markedLib.parseInline(shortcode.parse(parts[2])) : '',
                        type: String(parts[3] || 'changed').toLowerCase()
                    };
                });

                const title = options.title ? String(options.title) : 'Changelog';
                const payload = encodeURIComponent(JSON.stringify({ title, items }));
                return `<wb-changelog data-changelog="${payload}"></wb-changelog>`;
            }
        },
        {
            name: 'Matrix',
            handler: (element, options) => {
                const rawLines = String(element || '').split('\n').map((line) => line.trim()).filter(Boolean);
                const items = rawLines.map((line) => {
                    const parts = line.split('|').map((part) => part.trim());
                    return {
                        quadrant: String(parts[0] || 'quick_wins').toLowerCase(),
                        text: parts[1] ? markedLib.parseInline(shortcode.parse(parts[1])) : ''
                    };
                });

                const title = options.title ? String(options.title) : 'Impact vs Effort';
                const payload = encodeURIComponent(JSON.stringify({ title, items }));
                return `<wb-impact-matrix data-matrix="${payload}"></wb-impact-matrix>`;
            }
        }
    ];
}

export function createMarkdownRenderer(markedLib) {
    const shortcode = new ShortCode();
    const definitions = buildShortcodes(markedLib, shortcode);

    definitions.forEach((shortCode) => {
        try {
            shortcode.add(shortCode.name, shortCode.handler);
        } catch (error) {
            console.error(`Error adding ShortCode '${shortCode.name}':`, error);
        }
    });

    return function markdownToHtml(txt) {
        const text = String(txt || '').trim();
        const rendered = shortcode.parse(text);
        return markedLib.parse(rendered);
    };
}
