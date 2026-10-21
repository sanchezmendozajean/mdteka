(function () {
  if (customElements.get('lc-i')) return;
  const NS = 'http://www.w3.org/2000/svg';
  const pascal = n => n.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  function build(tag, attrs, kids) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs || {}) el.setAttribute(k, attrs[k]);
    (kids || []).forEach(c => el.appendChild(build(c[0], c[1], c[2])));
    return el;
  }
  class LcI extends HTMLElement {
    static get observedAttributes() { return ['n', 's', 'w']; }
    connectedCallback() { this.r(); }
    attributeChangedCallback() { this.r(); }
    r() {
      const L = window.lucide;
      const s = this.getAttribute('s') || '16';
      this.style.display = 'inline-flex'; this.style.width = s + 'px'; this.style.height = s + 'px'; this.style.flex = 'none';
      if (!L || !L.icons) { clearTimeout(this._t); this._t = setTimeout(() => this.r(), 60); return; }
      const n = this.getAttribute('n') || 'circle', w = this.getAttribute('w') || '1.5';
      const key = n + '|' + s + '|' + w; if (this._k === key) return; this._k = key;
      const node = L.icons[pascal(n)] || L.icons.Circle;
      const kids = typeof node[0] === 'string' ? node[2] : node;
      this._root = this._root || this.attachShadow({ mode: 'open' });
      this._root.replaceChildren(build('svg', { xmlns: NS, width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, kids));
    }
  }
  customElements.define('lc-i', LcI);
})();
