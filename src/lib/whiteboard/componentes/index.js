/**
 * Register whiteboard custom elements (browser only).
 * Dynamic imports avoid evaluating HTMLElement subclasses during Next.js SSR.
 */

async function registerWhiteboardComponents() {
  if (typeof customElements === 'undefined') return;

  const [
    { default: WbNote },
    { default: WbYoutube },
    { default: WbBox },
    { default: WbCardColor },
    { default: WbTabs },
    { default: WbChecklist },
    { default: WbTimeline },
    { default: WbKpiGrid },
    { default: WbChangelog },
    { default: WbImpactMatrix },
    { default: WbAiQuote },
    { default: WbHideCode },
  ] = await Promise.all([
    import('./WbNote.js'),
    import('./WbYoutube.js'),
    import('./WbBox.js'),
    import('./WbCardColor.js'),
    import('./WbTabs.js'),
    import('./WbChecklist.js'),
    import('./WbTimeline.js'),
    import('./WbKpiGrid.js'),
    import('./WbChangelog.js'),
    import('./WbImpactMatrix.js'),
    import('./WbAiQuote.js'),
    import('./WbHideCode.js'),
  ]);

  const defs = [
    ['wb-note', WbNote],
    ['wb-youtube', WbYoutube],
    ['wb-box', WbBox],
    ['wb-card-color', WbCardColor],
    ['wb-tabs', WbTabs],
    ['wb-checklist', WbChecklist],
    ['wb-timeline', WbTimeline],
    ['wb-kpi-grid', WbKpiGrid],
    ['wb-changelog', WbChangelog],
    ['wb-impact-matrix', WbImpactMatrix],
    ['wb-ai-quote', WbAiQuote],
    ['wb-hide-code', WbHideCode],
  ];

  for (const [name, ctor] of defs) {
    if (!customElements.get(name)) {
      customElements.define(name, ctor);
    }
  }
}

if (typeof window !== 'undefined') {
  void registerWhiteboardComponents();
}

export { registerWhiteboardComponents };
