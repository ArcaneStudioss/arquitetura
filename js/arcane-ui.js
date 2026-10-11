/* Arcane UI · movimento + acabamento. Sem dependências.
   Expõe: Arcane.confirmar({...}) -> Promise<boolean>   e   Arcane.toast(msg, {tipo})
   Atributos: data-reveal, data-stagger, data-split, data-count-to, data-parallax, data-tilt,
              data-magnetic, data-confirm, data-keep-autocomplete */
(() => {
  'use strict';
  const d = document, root = d.documentElement;
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)');
  const fino = matchMedia('(hover:hover) and (pointer:fine)');
  const suportaIO = 'IntersectionObserver' in window;
  const aplicarMovimento = () => root.classList.toggle('motion', !reduzir.matches && suportaIO);
  root.classList.add('js');
  aplicarMovimento();
  reduzir.addEventListener?.('change', aplicarMovimento);
  const comMovimento = () => root.classList.contains('motion');

  /* 1. Sem caixinha de sugestão do navegador em campos de texto livre.
        Nome/telefone/e-mail continuam com os autocomplete corretos (ajuda quem preenche). */
  d.querySelectorAll('textarea, input:not([type]), input[type=text], input[type=search]').forEach(el => {
    if (!el.hasAttribute('autocomplete') && !el.closest('[data-keep-autocomplete]')) el.setAttribute('autocomplete', 'off');
  });

  /* 2. Título palavra por palavra (continua legível para leitor de tela) */
  d.querySelectorAll('[data-split]').forEach(el => {
    const texto = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', texto);
    el.textContent = '';
    texto.split(' ').forEach((w, i) => {
      const o = d.createElement('span'); o.className = 'palavra'; o.setAttribute('aria-hidden', 'true');
      const s = d.createElement('span'); s.textContent = w; s.style.setProperty('--i', i);
      o.append(s); el.append(o, ' ');
    });
  });

  /* 3. Entrada em sequência: filhos de [data-stagger] entram um depois do outro */
  d.querySelectorAll('[data-stagger]').forEach(g => {
    [...g.children].forEach((c, i) => { if (!c.hasAttribute('data-reveal')) c.setAttribute('data-reveal', ''); c.style.setProperty('--i', i); });
  });

  /* 4. Contador que sobe (o valor final já está no HTML: sem JS continua correto) */
  const contar = el => {
    const alvo = parseFloat(el.dataset.countTo), dec = parseInt(el.dataset.dec || '0', 10);
    const fmt = v => (el.dataset.prefix || '') + v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (el.dataset.suffix || '');
    el.setAttribute('aria-label', fmt(alvo));
    if (!comMovimento() || Number.isNaN(alvo)) { el.textContent = fmt(alvo); return; }
    const t0 = performance.now(), dur = parseInt(el.dataset.dur || '1500', 10);
    const passo = t => {
      if (!el.hasAttribute('data-count-to')) return;                 // valor foi trocado por outro código: não sobrescrever
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = fmt(alvo * (1 - Math.pow(1 - p, 3)));
      p < 1 ? requestAnimationFrame(passo) : (el.textContent = fmt(alvo));
    };
    requestAnimationFrame(passo);
  };

  /* 5. Observa tudo que entra na tela */
  const alvos = d.querySelectorAll('[data-reveal],[data-split],[data-count-to]');
  if (suportaIO) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      if (e.target.hasAttribute('data-count-to')) contar(e.target);
      io.unobserve(e.target);
    }), { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    alvos.forEach(el => io.observe(el));
  } else {
    alvos.forEach(el => { el.classList.add('is-in'); if (el.hasAttribute('data-count-to')) contar(el); });
  }

  /* 6. Rolagem: barra de progresso, cabeçalho inteligente, parallax leve (uma vez por quadro) */
  const barra = d.querySelector('.progresso-scroll'), topo = d.querySelector('.topo');
  const par = [...d.querySelectorAll('[data-parallax]')];
  let ultimo = scrollY, agendado = false;
  const quadro = () => {
    const max = Math.max(0, root.scrollHeight - innerHeight);
    const y = Math.min(Math.max(scrollY, 0), max);   // ignora o "elástico" do celular no topo e no fim da página
    if (barra) root.style.setProperty('--scroll', max > 0 ? Math.min(y / max, 1).toFixed(4) : 0);
    if (topo) {
      topo.classList.toggle('topo--sombra', y > 8);
      const dy = y - ultimo;
      if (Math.abs(dy) > 8 || y <= 8) {              // só reage a movimento de verdade (histerese)
        topo.classList.toggle('topo--oculto', dy > 0 && y > 240 && !d.querySelector('.menu.aberto'));
        ultimo = y;
      }
    }
    if (comMovimento() && fino.matches) par.forEach(el => { el.style.transform = `translate3d(0,${(y * (parseFloat(el.dataset.parallax) || 0.1)).toFixed(1)}px,0)`; });
    agendado = false;
  };
  addEventListener('scroll', () => { if (!agendado) { agendado = true; requestAnimationFrame(quadro); } }, { passive: true });
  quadro();

  /* 6b. Barra de rolagem própria (só com mouse): acompanha a cor da página e pode ser arrastada */
  if (matchMedia('(pointer:fine)').matches) {
    const trilho = d.createElement('div'), polegar = d.createElement('i'); trilho.className = 'barra-rolagem'; trilho.setAttribute('aria-hidden', 'true'); trilho.append(polegar); d.body.append(trilho);
    let escondeEm = 0, arrasto = null;
    const medidas = () => { const h = innerHeight, total = root.scrollHeight, polH = Math.max(40, h * h / total); return { h, total, polH, livre: Math.max(h - polH, 1), max: Math.max(total - h, 1) }; };
    const desenhar = () => {
      const m = medidas();
      if (m.total <= m.h + 4) { trilho.classList.remove('is-on'); return; }
      polegar.style.height = m.polH + 'px'; polegar.style.top = (Math.min(scrollY, m.max) / m.max * m.livre).toFixed(1) + 'px';
    };
    const mostrar = () => { trilho.classList.add('is-on'); clearTimeout(escondeEm); escondeEm = setTimeout(() => { if (!arrasto) trilho.classList.remove('is-on'); }, 1500); };
    addEventListener('scroll', () => { desenhar(); mostrar(); }, { passive: true });
    addEventListener('resize', desenhar);
    d.addEventListener('pointermove', e => { if (!arrasto && e.clientX > innerWidth - 28 && root.scrollHeight > innerHeight + 4) { desenhar(); mostrar(); } });
    polegar.addEventListener('pointerdown', e => { const m = medidas(); arrasto = { y: e.clientY, s: scrollY, m }; polegar.setPointerCapture(e.pointerId); polegar.classList.add('is-arrastando'); e.preventDefault(); });
    polegar.addEventListener('pointermove', e => { if (!arrasto) return; const { m } = arrasto; root.style.scrollBehavior = 'auto'; scrollTo(0, arrasto.s + (e.clientY - arrasto.y) * m.max / m.livre); });
    const soltar = () => { if (!arrasto) return; arrasto = null; polegar.classList.remove('is-arrastando'); mostrar(); };
    polegar.addEventListener('pointerup', soltar); polegar.addEventListener('pointercancel', soltar);
    desenhar();
  }

  /* 7. Mouse: inclinação de card e botão magnético (só com mouse, e só com movimento ligado) */
  d.addEventListener('pointermove', e => {
    if (!fino.matches || !comMovimento()) return;
    const t = e.target.closest?.('[data-tilt]');
    if (t) {
      const r = t.getBoundingClientRect();
      t.style.setProperty('--rx', (((e.clientX - r.left) / r.width - 0.5) * 8).toFixed(2) + 'deg');
      t.style.setProperty('--ry', ((0.5 - (e.clientY - r.top) / r.height) * 8).toFixed(2) + 'deg');
    }
    const m = e.target.closest?.('[data-magnetic]');
    if (m) {
      const r = m.getBoundingClientRect();
      m.style.transform = `translate(${((e.clientX - (r.left + r.width / 2)) * 0.18).toFixed(1)}px,${((e.clientY - (r.top + r.height / 2)) * 0.25).toFixed(1)}px)`;
    }
  }, { passive: true });
  d.addEventListener('pointerout', e => {
    const t = e.target.closest?.('[data-tilt]'); if (t) { t.style.removeProperty('--rx'); t.style.removeProperty('--ry'); }
    const m = e.target.closest?.('[data-magnetic]'); if (m) m.style.transform = '';
  });

  /* 8. Pop-up de confirmação bonito (no lugar de confirm/alert/prompt do navegador) */
  let dlg;
  const criarDialog = () => {
    dlg = d.createElement('dialog'); dlg.className = 'ui-dialog';
    dlg.setAttribute('aria-labelledby', 'ui-dlg-t'); dlg.setAttribute('aria-describedby', 'ui-dlg-d');
    dlg.innerHTML = '<form method="dialog" class="ui-dialog__in"><h2 id="ui-dlg-t"></h2><p id="ui-dlg-d"></p>' +
      '<div class="ui-dialog__acoes"><button type="button" class="btn btn-sec" data-cancelar></button><button type="button" class="btn" data-ok></button></div></form>';
    d.body.append(dlg);
  };
  const confirmar = ({ titulo = 'Confirmar?', texto = '', ok = 'Confirmar', cancelar = 'Cancelar', perigo = false } = {}) => new Promise(resolve => {
    if (!dlg) criarDialog();
    const bOk = dlg.querySelector('[data-ok]'), bCancel = dlg.querySelector('[data-cancelar]');
    dlg.querySelector('h2').textContent = titulo;
    dlg.querySelector('p').textContent = texto; dlg.querySelector('p').hidden = !texto;
    bOk.textContent = ok; bCancel.textContent = cancelar;
    dlg.classList.toggle('ui-dialog--perigo', perigo);
    const retorno = d.activeElement; let valor = false, feito = false;
    const finalizar = () => {                                                   // idempotente: roda uma vez só
      if (feito) return; feito = true;
      root.classList.remove('ui-lock'); retorno?.focus?.(); resolve(valor);
    };
    const fechar = v => {
      valor = v; dlg.classList.add('is-closing');
      const fim = () => { dlg.classList.remove('is-closing'); if (dlg.open) dlg.close(); finalizar(); };
      comMovimento() ? setTimeout(fim, 170) : fim();
    };
    bOk.onclick = () => fechar(true);
    bCancel.onclick = () => fechar(false);
    dlg.oncancel = e => { e.preventDefault(); fechar(false); };                 // tecla Esc
    dlg.onclick = e => { if (e.target === dlg) fechar(false); };                // clique fora
    dlg.onclose = finalizar;                                                    // rede de segurança
    root.classList.add('ui-lock');
    dlg.showModal();
    (perigo ? bCancel : bOk).focus();                                           // ação destrutiva nunca recebe foco inicial
  });

  /* qualquer link/botão com data-confirm pede confirmação antes de qualquer outra ação
     (captura na fase inicial: nenhum outro clique do elemento roda até o "sim") */
  d.addEventListener('click', async e => {
    const el = e.target.closest?.('[data-confirm]');
    if (!el || el.dataset.confirmado) return;
    e.preventDefault(); e.stopPropagation();
    const sim = await confirmar({ titulo: el.dataset.confirm, texto: el.dataset.confirmTexto || '', ok: el.dataset.confirmOk || 'Confirmar', perigo: el.hasAttribute('data-confirm-perigo') });
    if (sim) { el.dataset.confirmado = '1'; el.click(); delete el.dataset.confirmado; }
  }, true);

  /* 9. Aviso rápido */
  const toast = (msg, { tipo = 'info', ms = 3800 } = {}) => {
    let box = d.querySelector('.ui-toasts');
    if (!box) { box = d.createElement('div'); box.className = 'ui-toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); d.body.append(box); }
    const t = d.createElement('div'); t.className = 'ui-toast ui-toast--' + tipo; t.textContent = msg; box.append(t);
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 230); }, ms);
  };
  window.alert = msg => toast(String(msg));          // rede de segurança: alert() nunca mostra a caixa feia do navegador

  window.Arcane = { confirmar, toast };
})();
