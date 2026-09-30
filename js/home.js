/* =====================================================================
   Homepage: the desk (Webflow build)
   Needs GSAP + ScrollTrigger + Draggable and Three.js (loaded before this file), and css/site.css.
   Images load from this repository, worked out from where this file was loaded.
   The four objects link to their case-study pages; the special-interests pack links to Wolseley Dragons.
   ===================================================================== */
(function(){
  'use strict';
  var me = document.currentScript;
  var ROOT = window.DESK_ROOT || (me && me.src ? me.src.replace(/js\/home(\.min)?\.js.*$/, '') : '');
  window.__deskErr = window.__deskErr || [];
  var root = document.documentElement;
  var $  = function(s,c){ return (c||document).querySelector(s); };
  var $$ = function(s,c){ return Array.prototype.slice.call((c||document).querySelectorAll(s)); };
  var A = { 'hb-label': { src: ROOT + 'img/hydrobolt/hb-label.webp' } };   /* the can's wrap */
  var live = $('[data-live]');

  /* ---------- 1. Hydrobolt: the flat wrap drawn onto a cylinder, one column at a time.
       phi turns the can; highlights live in a separate layer and stay put, which is what reads as round. */
  /* =================================================================
     CanGL: the Hydrobolt can in real 3D (Three.js). One shared WebGL renderer draws each can on demand and
     copies the result into that can's own canvas, so there is only ever one GL context however many cans.
     A lathe-turned aluminium shell, the wrap on a clear-coated printed band, a pull tab, lit by a small painted
     studio (a window to the top-left of the desk) so the metal has something real to reflect.
     'top'     : the can lying on the desk, seen from straight above (homepage, Hydrobolt desk)
     'product' : the can standing, seen from a little above (the packaging view)
     ================================================================= */
  /* built after the page has loaded and painted (shader compilation can take a moment on slow machines); until then
     the cans are drawn by the 2D renderer, and every can redraws itself once 'cangl:ready' fires */
  function buildCanGL(){
    var T = window.THREE; if(!T) return null;
    var R;
    try { R = new T.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'low-power' });   /* copied out straight after each render, so no preserved buffer is needed */ }
    catch(err){ return null; }
    if(!R.getContext()) return null;
    R.setPixelRatio(1); R.setClearColor(0x000000, 0);
    R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1;

    var scene = new T.Scene();
    /* the room, as a small high-dynamic-range panorama (y up), computed rather than loaded: a warm wall that falls off
       towards the desk, a bright ceiling, one big window up and to the left (many times brighter than the walls, which
       is what gives aluminium and varnish their highlights), a strip light opposite, and two dark flags for contrast */
    var EW = 256, EH = 128, px = new Uint16Array(EW * EH * 4), H16 = T.DataUtils.toHalfFloat;
    function lerp(a, b, t){ return a + (b - a) * t; }
    for(var yy = 0; yy < EH; yy++){
      var v = yy / (EH - 1), el = (.5 - v) * Math.PI;                    /* elevation: +90 at the top row */
      for(var xx = 0; xx < EW; xx++){
        var u = xx / EW, az = (u - .5) * Math.PI * 2;
        var dx = Math.cos(el) * Math.cos(az), dy = Math.sin(el), dz = Math.cos(el) * Math.sin(az);
        var base = dy > 0 ? lerp(.34, 1.2, Math.pow(dy, .55)) : lerp(.3, .1, Math.min(1, -dy * 3));
        var r = base * 1.0, gg = base * .95, bl = base * .86;
        /* the window: centred up and to the left of the desk */
        var wx = -.32, wy = .9, wz = -.3, wl = Math.hypot(wx, wy, wz), dot = (dx * wx + dy * wy + dz * wz) / wl;
        var win = Math.max(0, (dot - .9) / .1); win = win * win * (3 - 2 * win);
        r += win * 30; gg += win * 29.5; bl += win * 28;
        /* a tall softbox low on the left, for the standing can's long highlight */
        var qx = -.75, qy = .18, qz = .62, ql = Math.hypot(qx, qy, qz), d3 = (dx * qx + dy * qy + dz * qz) / ql;
        var box = Math.max(0, (d3 - .955) / .045) * (Math.abs(dy - .18) < .35 ? 1 : 0); r += box * 14; gg += box * 14; bl += box * 13.5;
        /* a strip light to the right */
        var sx = .8, sy = .35, sz = .45, sl = Math.hypot(sx, sy, sz), d2 = (dx * sx + dy * sy + dz * sz) / sl;
        var strip = Math.max(0, (d2 - .94) / .06); r += strip * 6; gg += strip * 6.2; bl += strip * 6.6;
        /* two dark flags near the horizon, for contrast in the metal */
        var f1 = Math.max(0, 1 - Math.hypot(az - 1.9, el - .15) / .45), f2 = Math.max(0, 1 - Math.hypot(az + 2.4, el - .1) / .4);
        var dark = 1 - .85 * Math.max(f1, f2); r *= dark; gg *= dark; bl *= dark;
        var o = (yy * EW + xx) * 4; px[o] = H16(r); px[o + 1] = H16(gg); px[o + 2] = H16(bl); px[o + 3] = H16(1);
      }
    }
    var envTex = new T.DataTexture(px, EW, EH, T.RGBAFormat, T.HalfFloatType);
    envTex.mapping = T.EquirectangularReflectionMapping; envTex.magFilter = T.LinearFilter; envTex.minFilter = T.LinearFilter; envTex.needsUpdate = true;
    var pm = new T.PMREMGenerator(R); scene.environment = pm.fromEquirectangular(envTex).texture; envTex.dispose(); pm.dispose();

    var key = new T.DirectionalLight(0xfff3e4, 1.2), rim = new T.DirectionalLight(0xdfe8ff, .3);
    scene.add(key, rim);

    /* the can, in millimetres: 66 x 157, a 475 mL tall can; built standing, centred on its middle */
    var pivot = new T.Group(), lay = new T.Group(), can = new T.Group(), body = new T.Group();
    scene.add(pivot); pivot.add(lay); lay.add(can); can.add(body); body.position.y = -78.5;
    var metal = new T.MeshStandardMaterial({ color:0xdadee2, metalness:1, roughness:.2 });
    var metalDark = new T.MeshStandardMaterial({ color:0xc2c7cc, metalness:1, roughness:.3 });
    var lathe = function(pts, mat){ var m = new T.Mesh(new T.LatheGeometry(pts.map(function(p){ return new T.Vector2(p[0], p[1]); }), 96), mat); body.add(m); return m; };
    lathe([[0,4.2],[10,3.9],[18,2.9],[24,1.4],[27.4,.2],[28.8,0],[30.4,.5],[31.8,2],[32.7,4.5],[33,8],[33,12.6]], metalDark);
    lathe([[33,138.4],[33,141],[32.6,143.8],[31.4,147],[29.6,150.3],[28.1,152.6],[27.3,154.2],[27.5,155.2],[28,156.1],[27.6,156.9],[26.6,157.1],[25.9,156.2],[25.4,154.6],[24.9,153.9],[0,154.3]], metal);
    var tex = new T.Texture(); tex.colorSpace = T.SRGBColorSpace; tex.wrapS = T.RepeatWrapping; tex.offset.x = .5; tex.anisotropy = R.capabilities.getMaxAnisotropy();
    var wrap = new T.MeshPhysicalMaterial({ map:tex, metalness:.22, roughness:.42, clearcoat:1, clearcoatRoughness:.06 });
    var band = new T.Mesh(new T.CylinderGeometry(33.03, 33.03, 126, 160, 1, true), wrap); band.position.y = 75.5; body.add(band);
    var tabShape = new T.Shape(); tabShape.absarc(0, 0, 4.2, Math.PI * .5, Math.PI * 1.5, false); tabShape.lineTo(14, -4.2); tabShape.absarc(14, 0, 4.2, -Math.PI * .5, Math.PI * .5, false); tabShape.lineTo(0, 4.2);
    var hole = new T.Path(); hole.absellipse(12.5, 0, 2.6, 2.2, 0, Math.PI * 2, true); tabShape.holes.push(hole);
    var tab = new T.Mesh(new T.ExtrudeGeometry(tabShape, { depth:.6, bevelEnabled:false }), metal); tab.rotation.x = -Math.PI / 2; tab.position.set(-4, 154.9, 0); body.add(tab);
    var rivet = new T.Mesh(new T.CylinderGeometry(1.6, 1.8, .9, 20), metal); rivet.position.set(0, 154.9, 0); body.add(rivet);

    var img = new Image(), ready = false, waiting = [];
    img.crossOrigin = 'anonymous';                            /* the wrap comes from another server: WebGL needs CORS to use it */
    img.onload = function(){ tex.image = img; tex.needsUpdate = true; ready = true; waiting.forEach(function(f){ f(); }); waiting = []; };
    img.src = A['hb-label'].src;

    var ortho = new T.OrthographicCamera(-1, 1, 1, -1, 1, 2000), persp = new T.PerspectiveCamera(22, 1, 1, 4000);
    key.position.set(-1, 1.35, -1); rim.position.set(1, .35, 1);          /* fixed to the room: the window is up and to the left */
    function render(target, o){
      if(!ready){ waiting.push(function(){ render(target, o); }); return false; }
      var w = target.width, h = target.height; if(!w || !h) return false;
      R.setSize(w, h, false);                                /* target canvases are already capped at 2x by their owners */
      var cam, b = -(o.angle || 0) * Math.PI / 180;
      can.rotation.set(0, -(o.phi || 0), 0);
      if(o.mode === 'top'){
        /* lying on the desk along the canvas' long axis (lid to the top of the canvas), seen from straight above. The element
           is turned on the page by `angle`; the can and the camera turn together here by the same amount, so the room
           (window, reflections) stays where it is while the picture in the canvas does not change shape. */
        var fh = 157 / .92, fw = fh * w / h; if(fw < 70){ fw = 70; fh = fw * h / w; }
        ortho.left = -fw / 2; ortho.right = fw / 2; ortho.top = fh / 2; ortho.bottom = -fh / 2; ortho.updateProjectionMatrix();
        lay.rotation.set(-Math.PI / 2, 0, 0); pivot.rotation.set(0, b, 0);
        ortho.position.set(0, 800, 0); ortho.up.set(-Math.sin(b), 0, -Math.cos(b)); ortho.lookAt(0, 0, 0);
        cam = ortho;
      } else {
        lay.rotation.set(0, 0, 0); pivot.rotation.set(0, 0, 0);
        persp.aspect = w / h; persp.updateProjectionMatrix();
        persp.position.set(0, 110, 470); persp.lookAt(0, -4, 0);
        cam = persp;
      }
      R.render(scene, cam);
      var c = target.getContext('2d'); c.clearRect(0, 0, w, h); c.drawImage(R.domElement, 0, 0, w, h);
      return true;
    }
    R.compile(scene, ortho); R.compile(scene, persp);
    return { render:render };
  }
  var CanGL = null;
  (function(){
    function go(){
      try { CanGL = buildCanGL(); } catch(err){ CanGL = null; }
      window.__CanGL = CanGL;                                /* review build: lets QA render a can on its own */
      if(CanGL) window.dispatchEvent(new Event('cangl:ready'));
    }
    function later(){ (window.requestIdleCallback || function(f){ return setTimeout(f, 400); })(go, { timeout:1800 }); }
    if(document.readyState === 'complete') later(); else window.addEventListener('load', function(){ setTimeout(later, 250); });
  })();

  function CanLabel(canvas){
    var self = this;
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.phi = 0; this.raf = 0;
    this.img = new Image(); this.img.crossOrigin = 'anonymous'; this.img.onload = function(){ self.size(); };
    this.img.src = (A[canvas.dataset.label] || {}).src || '';
  }
  CanLabel.prototype.size = function(){
    var d = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(1, Math.round(this.c.offsetWidth * d)), h = Math.max(1, Math.round(this.c.offsetHeight * d));
    if(w !== this.c.width || h !== this.c.height){ this.c.width = w; this.c.height = h; }
    this.draw();
  };
  /* brushed aluminium grain, made once: fine streaks running along the can */
  var BRUSH = (function(){
    var w = 96, h = 256, c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'), d = x.createImageData(w, h), col = [];
    for(var i = 0; i < w; i++) col[i] = Math.random();
    for(var yy = 0; yy < h; yy++) for(var xx = 0; xx < w; xx++){
      var v = 110 + col[xx] * 90 + (Math.random() - .5) * 26, p = (yy * w + xx) * 4;
      d.data[p] = d.data[p + 1] = d.data[p + 2] = v; d.data[p + 3] = 255;
    }
    x.putImageData(d, 0, 0); return c;
  })();

  /* The whole can, drawn each frame: silhouette with elliptical ends (a slight overhead view), brushed metal
     at the neck and base, the wrap mapped round the cylinder, seams that follow the curve, then light:
     edge falloff, a core shadow, warm bounce from the desk, one crisp specular and a soft clear-coat reflection.
     The light layers are fixed to the scene, so when the wrap turns the highlights stay where they are. */
  CanLabel.prototype.draw = function(){
    if(CanGL){
      if(this.angle == null){ var host = this.c.closest('[style*="--r"]'); this.angle = host ? parseFloat(getComputedStyle(host).getPropertyValue('--r')) || 0 : 0; }
      if(CanGL.render(this.c, { mode:'top', phi:this.phi, angle:this.angle })) return;
    }
    var img = this.img; if(!img.naturalWidth) return;
    var c = this.ctx, W = this.c.width, H = this.c.height, TAU = Math.PI * 2;
    var cx = W / 2, R = W * .4, e = R * .11;
    var yTop = H * .03, yRim = H * .05, yNeck = H * .108, yL0 = H * .116, yL1 = H * .926, yBase = H * .944, yEnd = H * .964;
    function rad(y){
      if(y < yRim) return R * .665;
      if(y < yNeck){ var t = (y - yRim) / (yNeck - yRim); t = t * t * (3 - 2 * t); return R * (.63 + .37 * t); }
      if(y < yBase) return R;
      return R * (1 - .075 * Math.min(1, (y - yBase) / (yEnd - yBase)));
    }
    function across(stops, alpha, rgb){
      var g = c.createLinearGradient(cx - R, 0, cx + R, 0);
      stops.forEach(function(s){ g.addColorStop(s[0], 'rgba(' + (rgb || '0,0,0') + ',' + (s[1] * (alpha || 1)).toFixed(3) + ')'); });
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    function ring(y, r, style, lw){ c.beginPath(); c.ellipse(cx, y, r, e * r / R, 0, 0, Math.PI, false); c.strokeStyle = style; c.lineWidth = lw; c.stroke(); }

    c.clearRect(0, 0, W, H);
    c.save();
    c.beginPath();
    var n = 80, y, i;
    for(i = 0; i <= n; i++){ y = yTop + (yEnd - yTop) * i / n; c.lineTo(cx - rad(y), y); }
    var rb = rad(yEnd); c.ellipse(cx, yEnd, rb, e * rb / R, 0, Math.PI, 0, true);
    for(i = n; i >= 0; i--){ y = yTop + (yEnd - yTop) * i / n; c.lineTo(cx + rad(y), y); }
    var rt = rad(yTop); c.ellipse(cx, yTop, rt, e * rt / R, 0, 0, Math.PI, true);
    c.closePath(); c.clip();

    /* metal */
    var m = c.createLinearGradient(cx - R, 0, cx + R, 0);
    [[0,'#6f7276'],[.08,'#a9adb2'],[.2,'#dfe2e5'],[.3,'#f4f6f7'],[.42,'#c9cdd1'],[.62,'#aeb2b7'],[.82,'#868a8f'],[.9,'#a5a8ac'],[1,'#606366']].forEach(function(s){ m.addColorStop(s[0], s[1]); });
    c.fillStyle = m; c.fillRect(0, 0, W, H);
    c.globalAlpha = .16; c.globalCompositeOperation = 'overlay'; c.drawImage(BRUSH, 0, 0, W, H);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';

    /* the wrap, round the cylinder; its top and bottom edges follow the ring curve */
    var iw = img.naturalWidth, ih = img.naturalHeight, x0 = Math.floor(cx - R), x1 = Math.ceil(cx + R);
    for(var x = x0; x < x1; x++){
      var nx = Math.max(-.9999, Math.min(.9999, (x + .5 - cx) / R)), s = Math.sqrt(1 - nx * nx), th = Math.asin(nx);
      var u = .5 + (th + this.phi) / TAU; u -= Math.floor(u);
      var sw = Math.min(Math.max(iw / TAU / (R * s), .6), iw * .05), sx = u * iw; if(sx + sw > iw) sx = iw - sw;
      c.drawImage(img, sx, 0, sw, ih, x, yL0 + e * s, 1, yL1 - yL0);
    }

    /* seams and rolled rings */
    var lw = Math.max(1, W * .006);
    ring(yL0, R, 'rgba(0,0,0,.35)', lw); ring(yL0 + lw * 1.4, R, 'rgba(255,255,255,.2)', lw * .8);
    ring(yL1, R, 'rgba(0,0,0,.3)', lw);  ring(yL1 + lw * 1.4, R, 'rgba(255,255,255,.18)', lw * .8);
    [.062, .074, .088, .1].forEach(function(f, k){ var yy = H * f; ring(yy, rad(yy), k % 2 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.18)', lw * .8); });
    ring(yRim, rad(yRim), 'rgba(0,0,0,.35)', lw); ring(yRim - lw, rad(yRim), 'rgba(255,255,255,.55)', lw * .8);
    ring(yBase, R, 'rgba(0,0,0,.28)', lw);

    /* light */
    across([[0,.66],[.05,.34],[.15,.08],[.28,0],[.5,.05],[.66,.18],[.78,.36],[.86,.3],[.92,.38],[1,.72]]);            /* falloff and core shadow */
    across([[.82,0],[.9,.22],[.96,0]], 1, '232,214,186');                                                             /* bounce from the desk */
    c.globalCompositeOperation = 'lighter';
    across([[.08,0],[.24,.1],[.36,.1],[.5,0]], 1, '255,255,255');                                                     /* broad sheen */
    across([[.205,0],[.228,.5],[.238,.92],[.248,.5],[.27,0]], 1, '255,255,255');                                     /* the specular */
    across([[.6,0],[.635,.07],[.67,0]], 1, '255,255,255');                                                            /* clear-coat window */
    c.globalCompositeOperation = 'source-over';
    var v = c.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0, 'rgba(255,255,255,.08)'); v.addColorStop(.3, 'rgba(255,255,255,0)'); v.addColorStop(.85, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.14)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    c.restore();
  };
  CanLabel.prototype.turn = function(phi){
    var self = this; this.phi = phi;
    if(!this.raf) this.raf = requestAnimationFrame(function(){ self.raf = 0; self.draw(); });
  };
  var labels = $$('canvas[data-label]').map(function(c){ return new CanLabel(c); });
  window.addEventListener('cangl:ready', function(){ labels.forEach(function(l){ l.draw(); }); });
  if(window.ResizeObserver){ var ro = new ResizeObserver(function(){ labels.forEach(function(l){ l.size(); }); }); labels.forEach(function(l){ ro.observe(l.c); }); }
  else window.addEventListener('resize', function(){ labels.forEach(function(l){ l.size(); }); });
  function labelIn(el){ var c = $('canvas[data-label]', el); for(var i = 0; i < labels.length; i++) if(labels[i].c === c) return labels[i]; }

  /* (the reel button and its dialog are gone until there is a reel) */

  /* the Wolseley Dragons pack on the homepage desk (special interests): not one of the four, so it never joins the
     Selected Work movement; it just lifts a little, and the card tucked behind it peeks out further */
  (function(){
    var p = $('[data-dpack]'); if(!p) return;
    var pk = $('.dpack__pack', p), cd = $('.dpack__card', p);
    function up(){ if(state.reduce) return; gsap.to(pk, { y:'-5%', rotation:-2, duration:.35, ease:'power3.out' }); gsap.to(cd, { x:'8%', y:'-10%', duration:.4, ease:'power3.out' }); }
    function down(){ gsap.to([pk, cd], { x:0, y:0, rotation:0, duration:.45, ease:'power3.out' }); }
    p.addEventListener('pointerenter', function(e){ if(e.pointerType === 'mouse') up(); });
    p.addEventListener('pointerleave', down);
    p.addEventListener('focus', up); p.addEventListener('blur', down);
  })();

  /* ?motion=full forces the full motion on for review, even with reduced motion switched on */
  function override(){ return /[?&]motion=full/.test(location.search); }


  if(!window.gsap || !window.ScrollTrigger || !window.Draggable){ root.classList.add('is-ready'); return; }
  gsap.registerPlugin(ScrollTrigger, Draggable);

  var desk = $('[data-desk]'), stage = $('[data-stage]'), world = $$('[data-world], [data-world-over]');
  var objs = $$('[data-obj]');
  var forced = root.classList.contains('force-reduce');
  var fullMotion = override();
  var state = { st:null, reduce:false, desktop:false, introDone:false };
  var cq = function(){ return stage.getBoundingClientRect().width / 100; };
  var num = function(el, p){ return parseFloat(getComputedStyle(el).getPropertyValue(p)); };
  var clamp = gsap.utils.clamp(-1, 1);
  var arranged = false, fullOn = [];                      /* Selected Work row formed? (see setArranged) */
  /* scrolling moves the whole desk, so anything open (a book, a fan, an unrolled print, a rolled can) settles back first:
     the desk always travels, and arrives, at rest */
  var lastScroll = 0;
  window.addEventListener('scroll', function(){ lastScroll = performance.now(); if(fullOn.length) fullOn.slice().forEach(function(f){ f(); }); }, { passive:true });
  /* resting and fanned poses of the card stack, bottom → top (percent of card, degrees) */
  var POSE   = [{x:-16,y:10,r:-20},{x:15,y:-9,r:18},{x:-10,y:-8,r:-13},{x:13,y:8,r:12},{x:6,y:6,r:5},{x:-5,y:3,r:-9}];   /* tossed down, not placed: even the top card lands crooked */
  var SPREAD = [{x:-32,y:16,r:-30},{x:28,y:-15,r:26},{x:-20,y:-10,r:-18},{x:21,y:10,r:17},{x:9,y:7,r:8},{x:-4,y:-2,r:-6}];

  /* ---------- Explore work / Work: travel to Selected Work ---------- */
  $$('[data-explore]').forEach(function(a){
    a.addEventListener('click', function(e){
      var target = state.st ? $('[data-sw]') : $('#work');
      if(state.st){
        e.preventDefault();
        window.scrollTo({ top: state.st.end, behavior: state.reduce ? 'auto' : 'smooth' });
        setTimeout(function(){ target.focus({ preventScroll:true }); }, 900);
      } else {
        setTimeout(function(){ target.focus({ preventScroll:true }); }, 50);
      }
    });
  });

  /* =================================================================
     LIFECYCLE
     ================================================================= */
  function safe(name, fn){
    try { return fn(); } catch(err){ window.__deskErr.push(name + ': ' + err.message); if(window.console) console.error(err); return null; }
  }
  gsap.matchMedia().add({
    any:'all',                                   /* always true: mobile matches none of the others */
    desktop:'(min-width: 1024px)',
    fine:'(hover: hover) and (pointer: fine)',
    reduceOS:'(prefers-reduced-motion: reduce)'
  }, function(ctx){
    var c = ctx.conditions, reduce = (c.reduceOS && !fullMotion) || forced;
    state.reduce = reduce; state.desktop = c.desktop;
    root.classList.toggle('is-reduced', reduce);
    root.classList.add('is-ready');              /* before intro, so .from() tweens resolve to visible */
    if(!reduce && !state.introDone) safe('intro', function(){ intro(c.desktop); });
    state.introDone = true;

    var offs = [];
    if(c.desktop){ offs.push(safe('cards', function(){ return cards({ fine:c.fine, reduce:reduce }); }), safe('nav', navStrip)); }
    if(c.desktop && !reduce){ desk.classList.add('is-scene'); state.st = safe('scroll scene', scene); }
    if(c.desktop && c.fine && !reduce){
      offs.push(safe('parallax', parallax), safe('posters', posters), safe('yearbook', book),
                safe('can', roll));
    }

    return function(){
      offs.forEach(function(f){ if(f) f(); });
      if(state.st && state.st.__off) state.st.__off();
      desk.classList.remove('is-scene'); state.st = null;
    };
  });

  /* =================================================================
     1. THE ONE LOAD MOMENT — quiet, no bounce
     ================================================================= */
  function intro(desktop){
    var tl = gsap.timeline({ defaults:{ ease:'power3.out' } });
    tl.from('[data-line]', { yPercent:104, duration:1.1, stagger:.08 })
      .from('[data-fade]', { autoAlpha:0, y:8, duration:.8, stagger:.06 }, .5);
    if(desktop){
      tl.from('.obj', { autoAlpha:0, duration:1, stagger:.07 }, .2)
        .from('.obj__tilt', { y:function(){ return -.5 * cq(); }, scale:1.012, duration:1.2, stagger:.07 }, .2);
    }
  }

  /* =================================================================
     2. HERO → SELECTED WORK (desktop). The camera rises and travels down
        the same table; the work is slid into a new arrangement.
     ================================================================= */
  function scene(){
    /* Selected Work sits on the desk just below the fold. --vb pushes it past any extra desk
       showing under the stage on screens narrower than 3:2, so it is never part of the still hero. */
    var S = .72, vb = 0;
    function setVB(){
      var r = stage.getBoundingClientRect();
      vb = Math.max(0, (innerHeight - r.height) / 2) / (r.width / 100) + 1;
      stage.style.setProperty('--vb', vb.toFixed(2));
    }
    setVB();
    ScrollTrigger.addEventListener('refreshInit', setVB);

    var tl = gsap.timeline({
      defaults:{ ease:'none' },
      scrollTrigger:{ trigger:desk, start:'top top', end:'+=160%', pin:true, scrub:.8, invalidateOnRefresh:true,
                      onUpdate:function(self){ setArranged(self.progress > .5); } }
    });

    /* the camera starts moving at the first pixel of scroll, so Selected Work begins rising immediately */
    tl.to(world, { y:function(){ return (6.6 - S * (67.5 + vb)) * cq(); }, scale:S, duration:.84, ease:'power2.inOut' }, 0)
      .fromTo('[data-hero]', { y:0, scale:1, autoAlpha:1 },   /* the hero block, not its lines: the load intro owns those, so the two never fight */
                          { y:function(){ return -9 * cq(); }, scale:.97, transformOrigin:'0 0', autoAlpha:0, duration:.3, ease:'power1.in', immediateRender:false }, 0);

    objs.forEach(function(li, i){
      var s = li.dataset.set.split(' ').map(Number);
      var cx = num(li,'--cx'), cy = num(li,'--cy'), w = num(li,'--w'), r = num(li,'--r');
      tl.to(li, {
        x:function(){ return (s[0] - cx) * cq(); },
        y:function(){ return (s[1] - cy) * cq(); },
        scale:s[2] / w, rotation:s[3] - r, duration:.72, ease:'power2.inOut'
      }, .1 + i * .03);
    });

    tl.fromTo('[data-setnote]', { autoAlpha:0, clipPath:'inset(-320% 100% -60% -10%)' },
                                { autoAlpha:1, clipPath:'inset(-320% -10% -60% -10%)', duration:.14, stagger:.035, immediateRender:true }, .8)
      .to({}, { duration:.16 });
    tl.scrollTrigger.__off = function(){ ScrollTrigger.removeEventListener('refreshInit', setVB); stage.style.removeProperty('--vb'); setArranged(false); };
    return tl.scrollTrigger;
  }

  /* =================================================================
     3. PREVIEW BEHAVIOURS — touch = playful preview, click = open project.
        Each responds to pointer hover and to keyboard focus on its link.
     ================================================================= */
  /* Once the desk has been scrolled into the Selected Work row, the objects stop doing their tricks:
     a touch just lifts them a little larger. (Homepage objects only; the case-study desks are unaffected.) */
  function mini(li, on){ var t = $('.obj__tilt', li); if(t) gsap.to(t, { scale:on ? 1.05 : 1, duration:on ? .35 : .45, ease:'power3.out' }); }
  function setArranged(a){
    if(a === arranged) return; arranged = a;
    desk.classList.toggle('is-arranged', a);
    if(a){ fullOn.slice().forEach(function(f){ f(); });          /* close anything still open (a book, a fan, an unrolled print) */
      gsap.to($$('[data-obj] .obj__tilt'), { rotationX:0, rotationY:0, duration:.4 }); }
    else $$('[data-obj]').forEach(function(li){ mini(li, false); });
    $$('[data-obj]').forEach(function(li){ var d = li.__dragList && li.__dragList[0]; if(d) a ? d.disable() : d.enable(); });
  }
  function hoverFocus(li, enter, leave, delay){
    var t = null, home = li.classList.contains('obj'), mode = null;
    function stopFull(){ if(t){ t.kill(); t = null; } if(mode === 'full'){ leave(); } mode = null; var k = fullOn.indexOf(stopFull); if(k > -1) fullOn.splice(k, 1); }
    function on(){
      if(home && arranged){ mode = 'mini'; mini(li, true); return; }
      if(t) t.kill(); mode = 'full'; if(fullOn.indexOf(stopFull) < 0) fullOn.push(stopFull);
      t = delay ? gsap.delayedCall(delay, enter) : (enter(), null);
    }
    function off(){ if(mode === 'mini'){ mini(li, false); mode = null; return; } if(t){ t.kill(); t = null; } leave(); mode = null; var k = fullOn.indexOf(stopFull); if(k > -1) fullOn.splice(k, 1); }
    /* only a pointer that actually moves wakes an object; things sliding under a still pointer while the page scrolls don't */
    function enterPtr(){ if(performance.now() - lastScroll > 220) on(); }
    function movePtr(){ if(!mode && performance.now() - lastScroll > 220) on(); }
    function fout(e){ if(!li.contains(e.relatedTarget)) off(); }
    li.addEventListener('pointerenter', enterPtr); li.addEventListener('pointermove', movePtr); li.addEventListener('pointerleave', off);
    li.addEventListener('focusin', on); li.addEventListener('focusout', fout);
    return function(){ off(); li.removeEventListener('pointerenter', enterPtr); li.removeEventListener('pointermove', movePtr); li.removeEventListener('pointerleave', off);
      li.removeEventListener('focusin', on); li.removeEventListener('focusout', fout); };
  }

  /* trading cards: the stack fans; the top card can be nudged and springs back */
  function cards(o){
    var li = $('[data-obj="cards"]'), link = $('.obj__link', li), stack = $$('[data-card]', li), top = stack[stack.length - 1];
    var fanned = false, dragging = false, dragAt = 0, drag = null, offs = [];
    function place(spread, dur){
      stack.forEach(function(el, i){
        if(dragging && el === top) return;
        var p = (spread ? SPREAD : POSE)[i], v = { xPercent:p.x, yPercent:p.y, rotation:p.r };
        if(dur && !o.reduce){ v.duration = dur; v.ease = 'power3.out'; gsap.to(el, v); } else gsap.set(el, v);
      });
    }
    function lift(v, d){ gsap.to(top, { '--lift':v, duration:o.reduce ? 0 : (d || .35), ease:'power2.out' }); }
    place(false);
    if(!o.reduce){
      offs.push(hoverFocus(li, function(){ fanned = true; place(true, .55); lift(.5); },
                               function(){ fanned = false; if(!dragging){ place(false, .6); lift(0); } }));
    }
    function block(e){ if(Date.now() - dragAt < 350){ e.preventDefault(); e.stopPropagation(); } }
    link.addEventListener('click', block, true);
    if(o.fine && !o.reduce){
      drag = li.__dragList = Draggable.create(top, {
        type:'x,y', dragClickables:true, zIndexBoost:false, minimumMovement:6, edgeResistance:.9,
        onPress:function(){ var w = top.offsetWidth, h = top.offsetHeight; this.applyBounds({ minX:-w * .3, maxX:w * .3, minY:-h * .18, maxY:h * .18 }); },
        onDragStart:function(){ dragging = true; lift(.95, .2); },
        onDrag:function(){ gsap.set(top, { rotation:(fanned ? SPREAD : POSE)[5].r + this.x / top.offsetWidth * 8 }); },
        onDragEnd:function(){
          dragging = false; dragAt = Date.now();
          gsap.to(top, { x:0, y:0, rotation:(fanned ? SPREAD : POSE)[5].r, duration:.6, ease:'power3.out' });
          lift(fanned ? .5 : 0, .5);
          if(!fanned) place(false, .6);
        }
      })[0];
    }
    return function(){
      offs.forEach(function(f){ f(); }); if(drag) drag.kill();
      link.removeEventListener('click', block, true);
    };
  }

  /* posters: the top print lies rolled up on the stack; touching it unrolls it flat */
  function posters(){
    var li = $('[data-obj="posters"]'), a = $('[data-poster="a"]', li), tube = $('[data-roll-tube]', li), p = { v:0 };
    function set(){ a.style.setProperty('--p', p.v.toFixed(4)); tube.style.setProperty('--p', p.v.toFixed(4)); }
    var off = hoverFocus(li, function(){
      gsap.to(p, { v:1, duration:1.25, ease:'power2.inOut', overwrite:true, onUpdate:set });
      gsap.to(a, { '--lift':.35, duration:.6, delay:.9 });
    }, function(){
      gsap.to(p, { v:0, duration:1.05, ease:'power2.inOut', overwrite:true, onUpdate:set });
      gsap.to(a, { '--lift':0, duration:.3 });
    }, .08);
    var off2 = lean(li, 1.2);
    return function(){ off(); off2(); p.v = 0; set(); };
  }

  /* yearbook: it lifts slightly and the cover opens far enough to show the first spread */
  function book(){
    var li = $('[data-obj="book"]'), cover = $('[data-cover]', li), bk = $('[data-book]', li), tilt = $('.obj__tilt', li);
    gsap.set(cover, { transformOrigin:'0% 50%' });
    var off = hoverFocus(li, function(){
      li.style.zIndex = 7;
      gsap.to(cover, { rotationY:-180, duration:1.3, ease:'power3.inOut', overwrite:'auto' });
      gsap.to(bk, { '--open':1, duration:.9, ease:'power2.out' });
      gsap.to(tilt, { scale:1.012, duration:.6, ease:'power3.out' });
    }, function(){
      gsap.to(cover, { rotationY:0, duration:1.05, ease:'power3.inOut', overwrite:'auto', onComplete:function(){ li.style.zIndex = ''; } });
      gsap.to(bk, { '--open':0, duration:.7, ease:'power2.inOut' });
      gsap.to(tilt, { scale:1, duration:.6, ease:'power3.out' });
    }, .12);
    var off2 = lean(li, .8);
    return function(){ off(); off2(); li.style.zIndex = ''; };
  }

  /* Hydrobolt on the desk: touched, it rolls north-west up and over the name, turning almost a full
     revolution so the back of the wrap comes round. Distance and turn are locked together (no sliding). */
  function roll(){
    var li = $('[data-obj="can"]'), wrap = $('[data-roll]', li), lab = labelIn(li), p = { t:0 };
    var r = num(li, '--r') * Math.PI / 180, dir = { x:-Math.cos(r), y:-Math.sin(r) };   /* perpendicular to the can's axis */
    var TURN = Math.PI * 2 * .78;                                                              /* ~290°: the back of the wrap comes round */
    function apply(){
      var R = li.offsetWidth * .4, d = p.t * TURN * R;                                          /* printed body = 80% of the box */
      gsap.set(wrap, { x:dir.x * d, y:dir.y * d }); if(lab) lab.turn(p.t * TURN);
    }
    var off = hoverFocus(li, function(){ gsap.to(p, { t:1, duration:2.3, ease:'power2.inOut', overwrite:true, onUpdate:apply }); },
                             function(){ gsap.to(p, { t:0, duration:2, ease:'power2.inOut', overwrite:true, onUpdate:apply }); }, .08);
    return function(){ off(); p.t = 0; apply(); };
  }

  /* Hydrobolt: the cursor turns the can a few degrees; highlight and contact shadow answer */
  function spin(host, tiltToo){
    var lab = labelIn(host), tilt = tiltToo ? $('.obj__tilt', host) : null, p = { s:0 };
    var go = gsap.quickTo(p, 's', { duration:.9, ease:'power3.out', onUpdate:function(){
      host.style.setProperty('--spin', p.s.toFixed(3)); if(lab) lab.turn(p.s * .42); } });
    var rot = tilt ? gsap.quickTo(tilt, 'rotation', { duration:.9, ease:'power3.out' }) : null;
    function move(e){ var b = host.getBoundingClientRect(); var n = clamp((e.clientX - (b.left + b.width / 2)) / (b.width * .7)); go(n); if(rot) rot(n * 1.4); }
    function out(){ go(0); if(rot) rot(0); }
    host.addEventListener('pointermove', move); host.addEventListener('pointerleave', out);
    return function(){ host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', out); host.style.removeProperty('--spin'); if(lab) lab.turn(0); };
  }

  /* =================================================================
     4. SHARED HELPERS
     ================================================================= */
  function parallax(){
    var movers = objs.map(function(li){
      var el = $('.obj__par', li), d = parseFloat(li.dataset.depth) || 0;
      return { d:d, x:gsap.quickTo(el, 'x', { duration:.9, ease:'power3.out' }), y:gsap.quickTo(el, 'y', { duration:.9, ease:'power3.out' }) };
    });
    function move(e){
      var nx = arranged ? 0 : e.clientX / innerWidth * 2 - 1, ny = arranged ? 0 : e.clientY / innerHeight * 2 - 1;
      movers.forEach(function(m){ m.x(nx * m.d * 7); m.y(ny * m.d * 5); });
    }
    window.addEventListener('pointermove', move, { passive:true });
    return function(){ window.removeEventListener('pointermove', move); };
  }

  /* 1–2° lean toward the cursor, shared by posters and book */
  function lean(li, max){
    var t = $('.obj__tilt', li);
    gsap.set(t, { transformPerspective:1400 });
    var rx = gsap.quickTo(t, 'rotationX', { duration:.6, ease:'power3.out' }), ry = gsap.quickTo(t, 'rotationY', { duration:.6, ease:'power3.out' });
    function move(e){ if(arranged) return; var b = li.getBoundingClientRect();
      ry(clamp((e.clientX - b.left) / b.width * 2 - 1) * max); rx(-clamp((e.clientY - b.top) / b.height * 2 - 1) * max); }
    function out(){ rx(0); ry(0); }
    li.addEventListener('pointermove', move); li.addEventListener('pointerleave', out);
    return function(){ li.removeEventListener('pointermove', move); li.removeEventListener('pointerleave', out); };
  }

  function navStrip(){
    var nav = $('.nav');
    var st = ScrollTrigger.create({ trigger:'.colophon', start:'top 70px', end:'max',
      onToggle:function(self){ nav.classList.toggle('is-solid', self.isActive); } });
    return function(){ st.kill(); nav.classList.remove('is-solid'); };
  }

  /* arriving from a case study's "← Selected work" (/#selected): land on the Selected Work row */
  function landSelected(){
    if(location.hash !== '#selected') return;
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      if(state.st){ window.scrollTo(0, state.st.end); ScrollTrigger.update(); }
      else { var t = $('#work'); if(t) t.scrollIntoView(); }
    }); });
  }
  if(document.readyState === 'complete') landSelected(); else window.addEventListener('load', landSelected);
})();
