/* Casa Entardecer · passeio pela casa
   - PC com mouse: a rolagem comanda a câmera (palco fixo, rolagem do próprio navegador).
   - Celular/toque: um cômodo por vez (setas, pontos ou deslizar), transição animada por tempo.
   - WebGL: cada foto tem um mapa de profundidade; a câmera "anda" e o que está perto se mexe mais.
   - Sem WebGL: canvas 2D com zoom simples. Sem JS ou com movimento reduzido: lista de fotos com texto. */
(() => {
  'use strict';
  const d = document, tour = d.querySelector('.tour');
  if (!tour) return;
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  initConversa();
  if (reduzir) return; // página comum: poster + lista de cômodos

  const ROOMS = [
    { n: 'Fachada', img: '01-fachada', fx: .46, T: [.5, .6], hot: [
      { u: .27, v: .36, d: .32, t: 'Brises de freijó', x: 'Filtram o sol da tarde e dão privacidade sem fechar a casa.' },
      { u: .74, v: .6, d: .4, t: 'Base em pedra', x: 'Travertino bruto ancorando os volumes de cal no terreno.' }] },
    { n: 'Entrada', img: '02-entrada', fx: .52, T: [.52, .44], hot: [
      { u: .585, v: .42, d: .4, t: 'Porta pivotante', x: 'Um painel único de madeira que gira no próprio eixo e abre a casa inteira.' },
      { u: .5, v: .84, d: .8, t: 'Degraus de travertino', x: 'Luz escondida sob cada degrau para chegar devagar, mesmo à noite.' }] },
    { n: 'Sala', img: '03-sala', fx: .42, T: [.86, .55], fire: 1, hot: [
      { u: .17, v: .62, d: .45, t: 'Lareira', x: 'Travertino polido e fogo na altura de quem está sentado.' },
      { u: .5, v: .06, d: .3, t: 'Forro de ripas', x: 'Madeira que aquece a luz e melhora a acústica do pé-direito duplo.' }] },
    { n: 'Cozinha', img: '04-cozinha', fx: .46, T: [.44, .3], hot: [
      { u: .33, v: .78, d: .9, t: 'Ilha em travertino', x: 'Bloco maciço de pedra, o lugar onde todo mundo acaba se encontrando.' },
      { u: .47, v: .24, d: .3, t: 'Escada solta', x: 'Degraus em balanço que levam aos quartos sem pesar no ambiente.' }] },
    { n: 'Quarto', img: '05-quarto', fx: .56, T: [.24, .45], hot: [
      { u: .82, v: .33, d: .45, t: 'Cabeceira iluminada', x: 'Luz escondida que lava a madeira e não ofusca quem deita.' },
      { u: .2, v: .3, d: .45, t: 'Cortinas de linho', x: 'Deixam a brisa passar e filtram a luz da manhã.' }] },
    { n: 'Terraço', img: '06-terraco', fx: .58, T: [.6, .5], fire: 1, hot: [
      { u: .53, v: .65, d: .6, t: 'Fogo de chão', x: 'O ponto de encontro das noites, em travertino como o resto da casa.' }] }
  ];
  const N = ROOMS.length, UMAX = N - 0.4, DW = .62, Z0 = 1.08, IA = 1536 / 864;
  const palco = tour.querySelector('.tour__palco'), canvas = tour.querySelector('.tour__tela');
  const hero = tour.querySelector('.tour__hero'), legendas = [...tour.querySelectorAll('.comodo')];
  const pontosEl = tour.querySelector('.tour__pontos'), cartao = tour.querySelector('.tour__cartao');
  const lista = tour.querySelector('.tour__lista'), btAnt = tour.querySelector('[data-ant]'), btProx = tour.querySelector('[data-prox]');
  const modoScroll = matchMedia('(pointer: fine) and (min-width: 900px)').matches;
  tour.classList.add('is-js', modoScroll ? 'is-scroll' : 'is-paginas');

  // ---------- utilidades ----------
  const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const eo = x => 1 - Math.pow(1 - x, 3);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- estado da câmera a partir de u (0..UMAX) ----------
  function camera(u) {
    const i = Math.min(N - 1, Math.floor(u)), w = u - i;
    const A = { i, z: Z0 + .1 * eo(cl(w / DW)), bob: 0 }, out = { A, B: null, m: 0, w, dip: 0 };
    if (w > DW && i < N - 1) {
      const q = (w - DW) / (1 - DW), e = eio(q);
      A.z = Z0 + .1 + .9 * Math.pow(e, 1.35);
      out.B = { i: i + 1, z: 1 + (Z0 - 1) * e };
      out.m = ss(.38, .86, q);
      out.dip = Math.sin(Math.PI * out.m) * .22;
      A.bob = out.B.bob = Math.sin(q * Math.PI * 4) * Math.sin(q * Math.PI) * .0035;
    }
    return out;
  }
  // cobertura (object-fit: cover com ponto focal) em coordenadas de textura
  function cobre(fx, sa) {
    const sc = sa > IA ? [1, IA / sa] : [sa / IA, 1];
    return { sc, c: [cl(fx, sc[0] / 2, 1 - sc[0] / 2), .5] };
  }
  // ponto da foto (u,v,profundidade) -> posição na tela (0..1); mesma conta do shader, ao contrário
  function naTela(h, room, z, par, sa) {
    const { sc, c } = cobre(room.fx, sa), T = room.T, k = 1 - 1 / z, kz = (z - 1) * .9;
    const cc = [lerp(c[0], T[0], k), lerp(c[1], T[1], k)];
    const t1 = [h.u - (h.d - .4) * par[0], h.v - (h.d - .4) * par[1]];
    const f = 1 + kz * (h.d - .4);
    const t0 = [cc[0] + (t1[0] - cc[0]) * f, cc[1] + (t1[1] - cc[1]) * f];
    const b = [c[0] + (t0[0] - cc[0]) * z, c[1] + (t0[1] - cc[1]) * z];
    return [.5 + (b[0] - c[0]) / sc[0], .5 + (b[1] - c[1]) / sc[1]];
  }

  // ---------- desenho: WebGL (com profundidade) ou 2D ----------
  const VS = 'attribute vec2 p;varying vec2 s;void main(){s=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
  const FS = `precision mediump float;varying vec2 s;
uniform sampler2D tA,dA,tB,dB,tT;uniform vec2 scA,cA,TA,scB,cB,TB,par;uniform float zA,zB,m,dip,fA,fB,tm,ti,bob;
vec2 cam(vec2 sc,vec2 c,vec2 T,float z,sampler2D dp,out float dd){
  vec2 b=c+(s-.5)*sc;b.y+=bob;vec2 cc=mix(c,T,1.-1./z);vec2 t=cc+(b-c)/z;
  float d=texture2D(dp,t).r;dd=d;t=cc+(t-cc)/(1.+(z-1.)*.9*(d-.4));t+=(d-.4)*par;return t;}
vec3 fogo(vec3 c,float f){float l=dot(c,vec3(.299,.587,.114));float w=smoothstep(.15,.42,c.r-c.b)*smoothstep(.42,.85,l);
  return c*(1.+f*w*(.09*sin(tm*13.)+.06*sin(tm*7.3+1.)+.05*sin(tm*23.1+2.)));}
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){float da,db;vec2 a=cam(scA,cA,TA,zA,dA,da);vec3 c=fogo(texture2D(tA,a).rgb,fA);
  if(ti>0.){vec4 tt=texture2D(tT,s);float occ=smoothstep(.07,.16,da);c=mix(c,vec3(.97,.93,.88),tt.a*ti*(1.-occ)*.94);}
  if(m>0.){vec2 b=cam(scB,cB,TB,zB,dB,db);c=mix(c,fogo(texture2D(tB,b).rgb,fB),m);}
  c*=1.-dip;float v=length(s-.5);c*=1.-.35*v*v;c+=(h(s*997.+tm)-.5)*.03;gl_FragColor=vec4(c,1.);}`;

  let gl = null, prog, U = {}, ctx2d = null, titulo = null, texTitulo = null;
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  } catch (e) { gl = null; }
  if (gl) {
    const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    try {
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      'tA dA tB dB tT scA cA TA scB cB TB par zA zB m dip fA fB tm ti bob'.split(' ').forEach(k => U[k] = gl.getUniformLocation(prog, k));
      ['tA', 'dA', 'tB', 'dB', 'tT'].forEach((k, i) => gl.uniform1i(U[k], i));
    } catch (e) { gl = null; }
  }
  if (!gl) ctx2d = canvas.getContext('2d');

  const vazio = gl && (() => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); return t; })();
  function textura(img) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  const carregar = src => new Promise((ok, erro) => { const im = new Image(); im.decoding = 'async'; im.onload = () => ok(im); im.onerror = erro; im.src = src; });
  const pront = [], pedidos = [];
  function pedir(i) {
    if (i < 0 || i >= N || pedidos[i]) return pedidos[i];
    const r = ROOMS[i];
    pedidos[i] = Promise.all([carregar(`img/${r.img}.webp`), gl ? carregar(`img/${r.img}-prof.webp`) : null]).then(([im, dp]) => {
      pront[i] = gl ? { t: textura(im), d: textura(dp) } : { im };
      sujo = true;
    }).catch(() => { pedidos[i] = null; });
    return pedidos[i];
  }

  // título gigante atrás da casa (só no WebGL: a profundidade esconde as letras atrás do telhado e das palmeiras)
  function desenharTitulo(W, H) {
    if (!gl) return;
    titulo = titulo || d.createElement('canvas');
    const k = .5; titulo.width = Math.round(W * k); titulo.height = Math.round(H * k);
    const g = titulo.getContext('2d'), w = titulo.width, h = titulo.height;
    g.clearRect(0, 0, w, h);
    const fonte = f => `600 ${f}px Geist, system-ui, sans-serif`;
    let fs = Math.min(w * .15, h * .19);
    g.font = fonte(fs); if ('letterSpacing' in g) g.letterSpacing = `${-fs * .04}px`;
    const larg = g.measureText('Entardecer').width, max = w * (W > H ? .66 : .9);
    if (larg > max) { fs *= max / larg; g.font = fonte(fs); if ('letterSpacing' in g) g.letterSpacing = `${-fs * .04}px`; }
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
    const y = h * (W > H ? .292 : .262);
    g.fillText('Entardecer', w / 2, y);
    g.font = `500 ${Math.max(10, fs * .13)}px "Geist Mono", monospace`;
    if ('letterSpacing' in g) g.letterSpacing = `${fs * .03}px`;
    g.fillText('CASA', w / 2, y - fs * .82);
    gl.activeTexture(gl.TEXTURE4);
    if (!texTitulo) texTitulo = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texTitulo);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, titulo);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    tour.classList.add('is-titulo-gl');
  }

  let W = 0, H = 0, sujo = true;
  function medir() {
    const r = palco.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, modoScroll ? 1.75 : 1.5);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; if (gl) gl.viewport(0, 0, W, H); }
    d.fonts && d.fonts.ready.then(() => { desenharTitulo(W, H); sujo = true; });
    sujo = true;
  }

  function desenhar(cam, par, t) {
    const sa = W / H, { A, B } = cam;
    const rA = pront[A.i] ? A : (B && pront[B.i] ? B : null);
    if (!rA) return false;
    if (gl) {
      const bind = (unit, tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); };
      const set = (suf, st) => { const r = ROOMS[st.i], cv = cobre(r.fx, sa); gl.uniform2fv(U['sc' + suf], cv.sc); gl.uniform2fv(U['c' + suf], cv.c); gl.uniform2fv(U['T' + suf], r.T); gl.uniform1f(U['z' + suf], st.z); gl.uniform1f(U['f' + suf], r.fire ? 1 : 0); };
      bind(0, pront[rA.i].t); bind(1, pront[rA.i].d); set('A', rA);
      const temB = B && pront[B.i] && rA === A;
      if (temB) { bind(2, pront[B.i].t); bind(3, pront[B.i].d); set('B', B); } else { bind(2, vazio); bind(3, vazio); }
      bind(4, texTitulo || vazio);
      gl.uniform1f(U.m, temB ? cam.m : 0); gl.uniform1f(U.dip, cam.dip); gl.uniform2fv(U.par, par);
      gl.uniform1f(U.tm, t); gl.uniform1f(U.bob, A.bob || 0);
      gl.uniform1f(U.ti, texTitulo && A.i === 0 ? 1 - ss(.1, .34, cam.w) : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      const pinta = (st, alpha) => {
        const r = ROOMS[st.i], im = pront[st.i].im, { sc, c } = cobre(r.fx, sa), k = 1 - 1 / st.z;
        const cc = [lerp(c[0], r.T[0], k), lerp(c[1], r.T[1], k)];
        const sw = sc[0] / st.z, sh = sc[1] / st.z;
        ctx2d.globalAlpha = alpha;
        ctx2d.drawImage(im, (cc[0] - sw / 2) * im.width, (cc[1] - sh / 2) * im.height, sw * im.width, sh * im.height, 0, 0, W, H);
      };
      pinta(rA, 1);
      if (B && pront[B.i] && rA === A && cam.m > 0) pinta(B, cam.m);
      ctx2d.globalAlpha = 1;
    }
    return true;
  }

  // ---------- pontos de detalhe ----------
  let pontos = [], salaPontos = -1, aberto = null;
  function montarPontos(i) {
    if (salaPontos === i) return; salaPontos = i; fecharCartao();
    pontosEl.innerHTML = ''; pontos = (i >= 0 ? ROOMS[i].hot : []).map(h => {
      const b = d.createElement('button'); b.type = 'button'; b.className = 'ponto';
      b.setAttribute('aria-label', 'Detalhe: ' + h.t); b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', () => abrirCartao(b, h)); pontosEl.appendChild(b); return { b, h };
    });
  }
  function abrirCartao(b, h) {
    if (aberto === b) return fecharCartao();
    fecharCartao(); aberto = b; b.setAttribute('aria-expanded', 'true');
    cartao.querySelector('.tour__cartao-t').textContent = h.t; cartao.querySelector('.tour__cartao-d').textContent = h.x; cartao.hidden = false;
  }
  function fecharCartao() { if (aberto) aberto.setAttribute('aria-expanded', 'false'); aberto = null; cartao.hidden = true; }
  cartao.querySelector('.tour__cartao-x').addEventListener('click', fecharCartao);
  d.addEventListener('keydown', e => { if (e.key === 'Escape') fecharCartao(); });

  // ---------- trilho ----------
  const botoes = ROOMS.map((r, i) => {
    const b = d.createElement('button'); b.type = 'button'; const sp = d.createElement('span'); sp.textContent = r.n; b.append(d.createElement('i'), sp);
    b.addEventListener('click', () => irPara(i)); lista.appendChild(b); return b;
  });

  // ---------- controle: rolagem (PC) ou páginas (toque) ----------
  let u = 0, uAlvo = 0, alvoPag = 0, anim = null, dwellIni = performance.now(), par = [0, 0], parAlvo = [0, 0];
  function progressoScroll() {
    const r = tour.getBoundingClientRect(), total = tour.offsetHeight - palco.offsetHeight;
    return cl(-r.top / Math.max(1, total)) * UMAX;
  }
  function irPara(i) {
    if (modoScroll) {
      const total = tour.offsetHeight - palco.offsetHeight, uu = i === 0 ? 0 : i + .3;
      scrollTo({ top: tour.offsetTop + (uu / UMAX) * total + 1, behavior: 'smooth' });
    } else animarPara(i);
  }
  function animarPara(i) {
    i = cl(i, 0, N - 1); if (i === alvoPag && !anim) return;
    const de = u, para = i, dur = Math.abs(para - de) > 1.5 ? 1.2 : (para > de ? 1.9 : 1.3), t0 = performance.now();
    alvoPag = i; pedir(i); pedir(i + 1);
    anim = { de, para, dur, t0 };
  }
  tour.querySelector('[data-entrar]').addEventListener('click', () => irPara(1));
  btAnt.addEventListener('click', () => animarPara(alvoPag - 1));
  btProx.addEventListener('click', () => animarPara(alvoPag + 1));
  if (!modoScroll) {
    let x0 = null, y0 = 0;
    palco.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
    palco.addEventListener('touchmove', e => { const t = e.touches[0]; parAlvo = [cl((t.clientX - x0) / innerWidth, -.5, .5) * -.03, 0]; }, { passive: true });
    palco.addEventListener('touchend', e => {
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; parAlvo = [0, 0];
      if (x0 !== null && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) animarPara(alvoPag + (dx < 0 ? 1 : -1));
      x0 = null;
    }, { passive: true });
  } else {
    palco.addEventListener('pointermove', e => { parAlvo = [(e.clientX / innerWidth - .5) * -.022, (e.clientY / innerHeight - .5) * -.012]; });
  }

  // ---------- laço de quadros (só roda com o passeio na tela) ----------
  let visivel = false, rodando = false, ultimo = 0;
  const gravar = /[?&]gravar\b/.test(location.search); // modo de gravação de vídeo: quadro a quadro, controlado de fora
  function quadro(agora) {
    if (!gravar) { if (!visivel || d.hidden) { rodando = false; return; } requestAnimationFrame(quadro); }
    const t = agora / 1000;
    if (gravar) { u = window.__u || 0; parAlvo = window.__par || [0, 0]; par = parAlvo; sujo = true; }
    else if (modoScroll) { uAlvo = progressoScroll(); u = Math.abs(uAlvo - u) < .0005 ? uAlvo : lerp(u, uAlvo, .14); }
    else if (anim) {
      const q = cl((agora - anim.t0) / (anim.dur * 1000)); u = lerp(anim.de, anim.para, eio(q));
      if (q >= 1) { anim = null; u = alvoPag; dwellIni = agora; }
    } else {
      const lim = alvoPag === 0 ? .08 : .5; u = alvoPag + lim * eo(cl((agora - dwellIni) / 14000));
    }
    par = [lerp(par[0], parAlvo[0], .06), lerp(par[1], parAlvo[1], .06)];
    const cam = camera(u), i = cam.A.i, w = cam.w;
    pedir(i); pedir(i + 1); if (modoScroll) pedir(i + 2);
    const fogo = ROOMS[i].fire || (cam.B && ROOMS[cam.B.i].fire);
    const mudou = sujo || Math.abs(u - (quadro.u ?? -1)) > 1e-5 || Math.abs(par[0] - (quadro.p ?? 0)) > 1e-5;
    if (!mudou && !(fogo && agora - ultimo > 40)) return;
    quadro.u = u; quadro.p = par[0]; ultimo = agora; sujo = false;
    if (desenhar(cam, par, t % 1000) && !tour.classList.contains('is-gl')) tour.classList.add('is-gl');
    // textos
    const h0 = i === 0 ? 1 - ss(.08, .3, w) : 0;
    hero.style.opacity = h0; hero.style.transform = `translateY(${(1 - h0) * -24}px)`; hero.style.visibility = h0 < .02 ? 'hidden' : 'visible';
    const ativo = cam.B && cam.m > .5 ? cam.B.i : i, wl = cam.B && cam.m > .5 ? 0 : w;
    legendas.forEach((li, k) => {
      const on = k === ativo && (k === 0 ? wl > .3 : true) && (wl < .72 || k === N - 1) && !(cam.B && cam.m > .15 && cam.m < .85);
      li.classList.toggle('is-on', on);
    });
    const perto = Math.round(cl(u, 0, N - 1));
    botoes.forEach((b, k) => b.setAttribute('aria-current', k === (modoScroll ? perto : alvoPag) ? 'true' : 'false'));
    btAnt.disabled = alvoPag <= 0; btProx.disabled = alvoPag >= N - 1;
    // pontos: só parado no cômodo (e fora do herói)
    const parado = !cam.B || cam.m === 0 ? (w < DW - .04 && (i > 0 || w > .3)) : false;
    montarPontos(parado ? i : -1);
    if (parado) {
      const r = ROOMS[i];
      pontos.forEach(({ b, h }) => {
        const [x, y] = naTela(h, r, cam.A.z, par, W / H);
        const dentro = x > .04 && x < .96 && y > .1 && y < .8;
        b.classList.toggle('is-on', dentro); b.tabIndex = dentro ? 0 : -1;
        b.style.transform = `translate(${x * palco.clientWidth}px,${y * palco.clientHeight}px)`;
      });
    }
  }
  if (gravar) { window.__render = quadro; window.__pronto = Promise.all(ROOMS.map((r, k) => pedir(k))); }
  function iniciar() { if (gravar) return; if (!rodando && visivel) { rodando = true; requestAnimationFrame(quadro); } }
  new IntersectionObserver(es => { visivel = es[0].isIntersecting; iniciar(); }, { rootMargin: '100px' }).observe(palco);
  d.addEventListener('visibilitychange', iniciar);
  new ResizeObserver(() => { medir(); iniciar(); }).observe(palco);
  medir();
  pedir(0).then(() => { pedir(1); iniciar(); });
  if (modoScroll) addEventListener('load', () => { let k = 2; const prox = () => { if (k < N) pedir(k++).then(prox); }; setTimeout(prox, 600); });

  // topo sólido fora do passeio
  const topo = d.getElementById('topo');
  new IntersectionObserver(es => topo.classList.toggle('is-solido', !es[0].isIntersecting), { rootMargin: '-80px 0px 0px 0px' }).observe(palco);

  // ---------- janela "Agendar conversa" (formulário só quando a pessoa pede) ----------
  function initConversa() {
    const dlg = d.getElementById('conversa'); if (!dlg) return;
    const form = dlg.querySelector('form'), erro = dlg.querySelector('.campo__erro');
    let origem = null;
    d.querySelectorAll('[data-abrir-conversa]').forEach(b => b.addEventListener('click', () => {
      origem = b; erro.hidden = true;
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      d.documentElement.style.overflow = 'hidden';
    }));
    const fechar = () => { dlg.close ? dlg.close() : dlg.removeAttribute('open'); };
    dlg.addEventListener('close', () => { d.documentElement.style.overflow = ''; origem && origem.focus(); });
    dlg.querySelector('[data-fechar]').addEventListener('click', fechar);
    dlg.addEventListener('click', e => { if (e.target === dlg) fechar(); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!form.nome.value.trim() || form.tel.value.replace(/\D/g, '').length < 10) { erro.hidden = false; return; }
      fechar(); form.reset();
      window.Arcane && Arcane.toast('Site de exemplo: aqui o pedido iria para o WhatsApp do ateliê.', { tipo: 'ok' });
    });
    d.querySelectorAll('[data-whats]').forEach(b => b.addEventListener('click', () =>
      window.Arcane && Arcane.toast('Site de exemplo: aqui entra o WhatsApp do escritório.', { tipo: 'info' })));
  }
})();
