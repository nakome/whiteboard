/**
 * Compact shortcode catalog for AI prompts (ask / generate).
 * Keep in sync with `templates` and handlers in shortcodes.js.
 */
export const SHORTCODE_AI_GUIDE = [
  'El content de cada card admite Markdown y shortcodes (estilo BBCode).',
  'Sintaxis: [Tag attr=valor]cuerpo[/Tag] o inline [Tag attr=valor]. Atributos con espacios van entre comillas.',
  'Incluye shortcodes cuando aporten estructura visual; no satures todas las cards.',
  'Catálogo:',
  "- Note: [Note name=success|warning|info|danger]texto[/Note]",
  "- Color: [Color name='#f55'|orange]**texto**[/Color]",
  "- SmartQuote: [SmartQuote prompt='tema' tone='inspirador' lang='es']",
  "- Code: [Code title='Demo' lang='js' open=false]\\ncodigo\\n[/Code]",
  "- Tabs: [Tabs active=0][Tab name='A']...[/Tab][Tab name='B']...[/Tab][/Tabs]",
  "- Checklist: [Checklist title='Sprint']\\n- [x] Hecho\\n- [ ] Pendiente\\n[/Checklist]",
  "- Timeline: [Timeline title='Plan']\\nYYYY-MM-DD | Titulo | Desc | done|in_progress|planned|blocked\\n[/Timeline]",
  "- KPIGrid: [KPIGrid]\\nTitulo | valor | tendencia | success|info|warning|neutral\\n[/KPIGrid]",
  "- Changelog: [Changelog title='Notes']\\nv1.0 | fecha | cambio | added|fixed|changed\\n[/Changelog]",
  "- Matrix: [Matrix title='Prioridad']\\nquick_wins|major_projects|fill_ins|thankless_tasks | texto\\n[/Matrix]",
  "- Layout: [Columns num=2|3]...[/Columns], [Justify|Center|Right]...[/Justify|Center|Right], [Divider num=1]",
  "- Boxes: [Boxes][Box num=3]...[/Box][/Boxes]",
  "- Media: [Youtube id='...'], [Video src='...' controls=true], [Audio src='...'], [Iframe src='...' width='480' height='320']",
].join('\n')

export const templates = [{
    text: '✅ Note success',
    title: 'Shortcode: Note',
    content: '[Note name=success] Success note [/Note]',
}, {
    text: '⚠️ Note warning',
    title: 'Shortcode: Note',
    content: '[Note name=warning] Warning note [/Note]'
}, {
    text: 'ℹ️ Note info',
    title: 'Shortcode: Note',
    content: '[Note name=info] Info note [/Note]'
}, {
    text: '⛔ Note danger',
    title: 'Shortcode: Note',
    content: '[Note name=danger] Danger note [/Note]'
}, {
    text: '🎨 Color',
    title: 'Shortcode: Color',
    content: "This is a [Color name='#f55']**RED**[/Color] and this is [Color name=orange]**ORANGE**[/Color]"
}, {
    text: '🤖 Smart Quote IA',
    title: 'Shortcode: SmartQuote',
    content: "[SmartQuote prompt='Frase inspiradora para iniciar el sprint' tone='inspirador' lang='es']"
}, {
    text: '🔽 Code',
    title: 'Shortcode: Code',
    content: "[Code title='Demo JS' lang='js' open=false]\nconsole.log('Hello from hidden code');\n[/Code]"
}, {
    text: '🗂️ Tabs interactivas',
    title: 'Shortcode: Tabs',
    content: "[Tabs active=0]\n[Tab name='Resumen']Estado general del proyecto.[/Tab]\n[Tab name='Pendientes']- [ ] Definir alcance\n- [x] Crear wireframes[/Tab]\n[Tab name='Notas']Puedes usar **Markdown** y shortcodes dentro de cada tab.[/Tab]\n[/Tabs]"
}, {
    text: '✅ Checklist progreso',
    title: 'Shortcode: Checklist',
    content: "[Checklist title='Sprint 12']\n- [x] Diseno aprobado\n- [ ] API terminada\n- [ ] QA funcional\n- [ ] Deploy produccion\n[/Checklist]"
}, {
    text: '🕒 Timeline',
    title: 'Shortcode: Timeline',
    content: "[Timeline title='Lanzamiento v1']\n2026-05-01 | Kickoff | Se definio objetivos y alcance | done\n2026-05-03 | Desarrollo | Estructura base implementada | in_progress\n2026-05-05 | QA | Validacion funcional completa | planned\n2026-05-06 | Go-live | Esperando aprobacion final | blocked\n[/Timeline]"
}, {
    text: '📈 KPI Grid',
    title: 'Shortcode: KPIGrid',
    content: "[KPIGrid]\nMRR | $12.400 | +12% | success\nChurn | 2.1% | -0.4% | info\nNPS | 54 | +8 | success\nIncidencias | 7 | +2 | warning\n[/KPIGrid]"
}, {
    text: '📝 Changelog',
    title: 'Shortcode: Changelog',
    content: "[Changelog title='Release Notes']\nv1.4.0 | 2026-05-05 | Nueva vista de dashboard y mejoras UX | added\nv1.4.1 | 2026-05-06 | Fix de errores en importacion CSV | fixed\nv1.5.0 | 2026-05-10 | Refactor del parser de shortcodes | changed\n[/Changelog]"
}, {
    text: '🧭 Impact Matrix',
    title: 'Shortcode: Matrix',
    content: "[Matrix title='Priorizacion Q2']\nquick_wins | Corregir validaciones de formulario\nmajor_projects | Nuevo sistema de permisos\nfill_ins | Mejorar placeholders\nthankless_tasks | Limpiar deuda tecnica legacy\n[/Matrix]"
}, {
    text: '🗂️ Columns 2',
    title: 'Shortcode: Columns',
    content: '[Columns num=2]Lorem ipsum dolor sit amet...[/Columns]'
}, {
    text: '🗂️ Columns 3',
    title: 'Shortcode: Columns',
    content: '[Columns num=3]Lorem ipsum dolor sit amet...[/Columns]'
}, {
    text: '↔️ Justify',
    title: 'Shortcode: Justify',
    content: '[Justify]Texto justificado[/Justify]'
}, {
    text: '↔️ Center',
    title: 'Shortcode: Center',
    content: '[Center]Texto centrado[/Center]'
}, {
    text: '➡️ Right',
    title: 'Shortcode: Right',
    content: '[Right]Texto a la derecha[/Right]'
}, {
    text: '➖ Divider',
    title: 'Shortcode: Divider',
    content: '[Divider num=1]'
}, {
    text: '📦 Boxes demo',
    title: 'Shortcode: Boxes',
    content: '[Boxes]\n[Box num=3][Color name=blue]Box 3[/Color][/Box]\n[Box num=3][Color name=blue]Box 3[/Color][/Box]\n[Box num=3][Color name=blue]Box 3[/Color][/Box]\n[/Boxes]'
}, {
    text: '📊 Table',
    title: 'Shortcode: Table',
    content: '| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |'
}, {
    text: '▶️ Youtube',
    title: 'Shortcode: Youtube',
    content: "[Youtube id='EmdEhn7Sf40']"
}, {
    text: '🎬 Video',
    title: 'Shortcode: Video',
    content: "[Video src='https://www.w3schools.com/html/mov_bbb.mp4' controls=true autoplay=false muted=false loop=false playsinline=true preload='metadata' poster='https://peach.blender.org/wp-content/uploads/title_anouncement.jpg']"
}, {
    text: '🎵 Audio',
    title: 'Shortcode: Audio',
    content: "[Audio src='https://www.w3schools.com/html/horse.mp3' controls=true autoplay=false muted=false loop=false preload='metadata']"
}, {
    text: '🖼️ Iframe',
    title: 'Shortcode: Iframe',
    content: "[Iframe src='https://example.com' title='Example' width='480' height='320']"
}];

/**
 * Builds action-ready shortcode menu items.
 *
 * Reusability contract:
 * - Returns a normalized structure: `{ text, action }`
 * - Does not mutate incoming dependencies
 * - Keeps creation defaults centralized for all shortcode entries
 */
export default function createShortcodeTemplates({ createCard, container, state }) {
    return templates.map((template) => ({
        text: template.text,
        action: (event) => {
            event?.preventDefault?.();
            // Default placement/size for quick insert from any menu surface.
            createCard(container, state, {
                x: 120,
                y: 120,
                width: 320,
                height: 120,
                title: template.title,
                content: template.content,
            });
        },
    }));
}