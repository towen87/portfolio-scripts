/* =====================================================================
   Hydrobolt: the desk page (Webflow build)
   Needs GSAP and Three.js (loaded before this file) and css/site.css.
   Images load from this repository, worked out from where this file was loaded.
   The can is drawn in 2D straight away; once the page has loaded, Three.js takes over and draws it in 3D.
   ===================================================================== */
(function(){
  'use strict';
  var me = document.currentScript;
  var ROOT = window.DESK_ROOT || (me && me.src ? me.src.replace(/js\/hydrobolt(\.min)?\.js.*$/, '') : '');
  var $  = function(s, c){ return (c || document).querySelector(s); };
  var $$ = function(s, c){ return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function start(){
    if(!window.gsap){ console.error('hydrobolt.js: GSAP is not loaded'); return; }
    var el = $('[data-case="hydrobolt"]'); if(!el) return;
    var root = document.documentElement;
    var state = {
      reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      desktop: window.matchMedia('(min-width: 1024px)').matches
    };
    var clamp = gsap.utils.clamp(-1, 1);
    var num = function(n, p){ return parseFloat(getComputedStyle(n).getPropertyValue(p)); };
    function fineNow(){ return window.matchMedia('(hover: hover) and (pointer: fine)').matches; }
    function hoverFocus(li, enter, leave){
      var on = false;
      function go(){ if(!on){ on = true; enter(); } }
      function stop(){ if(on){ on = false; leave(); } }
      li.addEventListener('pointerenter', go); li.addEventListener('pointerleave', stop);
      li.addEventListener('focusin', go); li.addEventListener('focusout', function(e){ if(!li.contains(e.relatedTarget)) stop(); });
    }
    /* the can's wrap, from this repository */
    var A = { 'hb-label': { src: ROOT + 'img/hydrobolt/hb-label.webp' } };

    /* on its own page the desk is simply open */
    el.hidden = false; root.classList.add('case-open'); gsap.set(el, { autoAlpha:1 });

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
      img.crossOrigin = 'anonymous';                          /* the wrap comes from another server: WebGL needs CORS to use it */
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
        if(CanGL) window.dispatchEvent(new Event('cangl:ready'));
      }
      function later(){ (window.requestIdleCallback || function(f){ return setTimeout(f, 400); })(go, { timeout:1800 }); }
      if(document.readyState === 'complete') later(); else window.addEventListener('load', function(){ setTimeout(later, 250); });
    })();


    /* =========================== HYDROBOLT DESK =========================== */
    /* One drawing routine for a standing cylinder seen from a little above: the silhouette with elliptical ends,
       metal or sleeve, the wrap mapped round it, seams on the curve, then light fixed to the room. */
    var TAU = Math.PI * 2;
    function drawCyl(c, o){
      var cx = o.cx, y0 = o.y0, H = o.H, R = o.R, e = o.e, sl = o.sleeve;
      var yN = y0 + H * .06, yL0 = y0 + H * .085, yL1 = y0 + H * .95, yB = y0 + H * .972, yE = y0 + H;
      function rad(y){
        if(y < yN){ var t = (y - y0) / (yN - y0); t = t * t * (3 - 2 * t); return R * (sl ? .95 + .05 * t : .8 + .2 * t); }
        if(y < yB) return R;
        return R * (1 - .07 * Math.min(1, (y - yB) / (yE - yB)));
      }
      var rt = rad(y0), rb = rad(yE), i, y, n = 48;
      c.save(); c.beginPath();
      for(i = 0; i <= n; i++){ y = y0 + (yE - y0) * i / n; c.lineTo(cx - rad(y), y); }
      c.ellipse(cx, yE, rb, e * rb, 0, Math.PI, 0, true);
      for(i = n; i >= 0; i--){ y = y0 + (yE - y0) * i / n; c.lineTo(cx + rad(y), y); }
      c.ellipse(cx, y0, rt, e * rt, 0, 0, Math.PI, true);
      c.closePath(); c.clip();
      var X0 = cx - R - 2, W0 = 2 * R + 4, Y0 = y0 - R, H0 = H + 2 * R;
      var g = c.createLinearGradient(cx - R, 0, cx + R, 0);
      (sl ? [[0,'#050609'],[.25,'#1c1e28'],[.5,'#0b0c11'],[1,'#030305']]
          : [[0,'#6f7276'],[.08,'#a9adb2'],[.2,'#dfe2e5'],[.3,'#f4f6f7'],[.42,'#c9cdd1'],[.62,'#aeb2b7'],[.82,'#868a8f'],[.9,'#a5a8ac'],[1,'#606366']])
        .forEach(function(s){ g.addColorStop(s[0], s[1]); });
      c.fillStyle = g; c.fillRect(X0, Y0, W0, H0);
      if(o.tex){
        var tw = o.tex.naturalWidth || o.tex.width, th = o.tex.naturalHeight || o.tex.height, a0 = sl ? yN : yL0, a1 = sl ? yB : yL1;
        for(var x = Math.floor(cx - R); x < Math.ceil(cx + R); x++){
          var nx = clamp((x + .5 - cx) / R) * .9999, s = Math.sqrt(1 - nx * nx), t = Math.asin(nx);
          var u = .5 + (t + o.phi) / TAU; u -= Math.floor(u);
          var sw = Math.min(Math.max(tw / TAU / (R * s), .6), tw * .05), sx = u * tw; if(sx + sw > tw) sx = tw - sw;
          c.drawImage(o.tex, sx, 0, sw, th, x, a0 + e * R * s, 1, a1 - a0);
        }
      }
      var lw = Math.max(1, R * .012);
      function ring(yy, r, st, w){ c.beginPath(); c.ellipse(cx, yy, r, e * r, 0, 0, Math.PI, false); c.strokeStyle = st; c.lineWidth = w; c.stroke(); }
      if(!sl){
        ring(yL0, R, 'rgba(0,0,0,.35)', lw); ring(yL0 + lw * 1.3, R, 'rgba(255,255,255,.18)', lw * .8);
        ring(yL1, R, 'rgba(0,0,0,.3)', lw); ring(yB, R, 'rgba(0,0,0,.25)', lw);
        [.018, .033, .048].forEach(function(f, k){ var yy = y0 + H * f; ring(yy, rad(yy), k % 2 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.2)', lw * .8); });
      }
      function across(stops, rgb, mode){
        var q = c.createLinearGradient(cx - R, 0, cx + R, 0);
        stops.forEach(function(s){ q.addColorStop(Math.min(1, Math.max(0, s[0])), 'rgba(' + (rgb || '0,0,0') + ',' + s[1] + ')'); });
        c.globalCompositeOperation = mode || 'source-over'; c.fillStyle = q; c.fillRect(X0, Y0, W0, H0); c.globalCompositeOperation = 'source-over';
      }
      var L = o.lx == null ? .26 : o.lx;
      across([[0,.62],[.05,.3],[.15,.06],[.28,0],[.5,.05],[.66,.2],[.78,.38],[.86,.3],[.92,.4],[1,.72]]);
      across([[.82,0],[.9,.2],[.96,0]], '232,214,186');
      across([[L - .18,0],[L - .02,sl ? .06 : .1],[L + .1,sl ? .06 : .1],[L + .24,0]], '255,255,255', 'lighter');
      across([[L - .035,0],[L - .012,sl ? .3 : .5],[L,sl ? .55 : .92],[L + .012,sl ? .3 : .5],[L + .035,0]], '255,255,255', 'lighter');
      across([[.62,0],[.655,.07],[.69,0]], '255,255,255', 'lighter');
      if(o.cool){ across([[.5,0],[.8,.22 * o.cool],[.93,.5 * o.cool],[1,.32 * o.cool]], '95,190,255', 'lighter'); }
      var v = c.createLinearGradient(0, y0, 0, yE + e * R);
      v.addColorStop(0, 'rgba(255,255,255,.06)'); v.addColorStop(.7, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.25)');
      c.fillStyle = v; c.fillRect(X0, Y0, W0, H0);
      c.restore();
      if(!o.noLid) drawLid(c, cx, y0, rt, e, sl);
      return rt;
    }
    function drawLid(c, cx, y, r, e, sl){
      c.save(); c.beginPath(); c.ellipse(cx, y, r, e * r, 0, 0, TAU);
      var g = c.createRadialGradient(cx - r * .3, y - e * r * .4, r * .05, cx, y, r * 1.05);
      if(sl){ g.addColorStop(0, '#2a2d38'); g.addColorStop(.6, '#101218'); g.addColorStop(1, '#050608'); }
      else { g.addColorStop(0, '#f2f4f5'); g.addColorStop(.45, '#b9bdc1'); g.addColorStop(.8, '#8d9195'); g.addColorStop(1, '#5f6367'); }
      c.fillStyle = g; c.fill();
      c.lineWidth = Math.max(1, r * .03); c.strokeStyle = sl ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.7)'; c.stroke();
      if(!sl){
        c.beginPath(); c.ellipse(cx, y + e * r * .04, r * .84, e * r * .84, 0, 0, TAU); c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = Math.max(1, r * .025); c.stroke();
        c.beginPath(); c.ellipse(cx, y + e * r * .06, r * .8, e * r * .8, 0, 0, Math.PI, false); c.strokeStyle = 'rgba(255,255,255,.45)'; c.stroke();
        c.beginPath(); c.ellipse(cx, y - e * r * .28, r * .3, e * r * .24, 0, 0, TAU);
        var tg = c.createLinearGradient(cx - r * .3, 0, cx + r * .3, 0); tg.addColorStop(0, '#9ea2a6'); tg.addColorStop(.4, '#eef0f1'); tg.addColorStop(1, '#80848a');
        c.fillStyle = tg; c.fill();
        c.beginPath(); c.ellipse(cx, y - e * r * .3, r * .15, e * r * .11, 0, 0, TAU); c.fillStyle = 'rgba(40,42,46,.75)'; c.fill();
        c.beginPath(); c.ellipse(cx, y + e * r * .42, r * .26, e * r * .18, 0, 0, TAU); c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = Math.max(1, r * .02); c.stroke();
        c.beginPath(); c.arc(cx, y, Math.max(1, r * .05), 0, TAU); c.fillStyle = 'rgba(60,62,66,.6)'; c.fill();
      } else { c.beginPath(); c.ellipse(cx - r * .25, y - e * r * .3, r * .35, e * r * .2, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,.07)'; c.fill(); }
      c.restore();
    }
    function fitCanvas(cv){
      var d = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(cv.offsetWidth * d), h = Math.round(cv.offsetHeight * d);
      if(w && h && (w !== cv.width || h !== cv.height)){ cv.width = w; cv.height = h; }
    }
    var hbLabel = new Image(), hbReady = [], hbPackTex = null;
    hbLabel.crossOrigin = 'anonymous';
    hbLabel.onload = function(){ buildPackTex(); hbReady.forEach(function(f){ f(); }); };
    hbLabel.src = A['hb-label'].src;

    /* the 4-pack sleeve as wrap textures: the bolt panel faces out on the front can, the pack count on the can beside it */
    function buildPackTex(){
      function tex(){ var t = document.createElement('canvas'); t.width = 1024; t.height = 768; var c = t.getContext('2d'); c.fillStyle = '#07080c'; c.fillRect(0, 0, 1024, 768); return t; }
      var iw = hbLabel.naturalWidth, ih = hbLabel.naturalHeight, sx = iw * .36, sw = iw * .3;
      var F = tex(), S = tex(), B = tex(), c = F.getContext('2d'), dw = Math.round(768 * sw / ih), dx = 594 - dw / 2;
      c.drawImage(hbLabel, sx, 0, sw, ih, dx, 0, dw, 768);
      var fx = c.createLinearGradient(dx, 0, dx + dw, 0);                  /* the blue sinks into the black film at its edges */
      fx.addColorStop(0, 'rgba(7,8,12,1)'); fx.addColorStop(.2, 'rgba(7,8,12,0)'); fx.addColorStop(.8, 'rgba(7,8,12,0)'); fx.addColorStop(1, 'rgba(7,8,12,1)');
      c.fillStyle = fx; c.fillRect(dx, 0, dw, 768);
      var fy = c.createLinearGradient(0, 0, 0, 768);
      fy.addColorStop(0, 'rgba(7,8,12,.9)'); fy.addColorStop(.12, 'rgba(7,8,12,0)'); fy.addColorStop(.9, 'rgba(7,8,12,0)'); fy.addColorStop(1, 'rgba(7,8,12,.85)');
      c.fillStyle = fy; c.fillRect(dx, 0, dw, 768);
      var s = S.getContext('2d'); s.fillStyle = '#f2f4ff'; s.textAlign = 'center';
      s.font = '800 58px Archivo, sans-serif'; s.fillText('4 PACK', 690, 612);
      s.font = '600 24px Archivo, sans-serif'; s.fillText('475 mL EACH', 690, 648);
      s.fillStyle = '#3fc7f4'; s.fillRect(640, 668, 100, 3);
      hbPackTex = { L:F, R:S, B:B };
    }

    function HBCan(cv, inspect){ this.c = cv; this.x = cv.getContext('2d'); this.phi = 0; this.lx = .26; this.inspect = inspect; var me = this; hbReady.push(function(){ me.draw(); }); }
    HBCan.prototype.draw = function(){
      fitCanvas(this.c);
      if(CanGL && this.inspect && CanGL.render(this.c, { mode:'product', phi:this.phi })) return;
      var c = this.x, W = this.c.width, Hc = this.c.height; if(!W || !hbLabel.naturalWidth) return;
      c.clearRect(0, 0, W, Hc);
      var e = .2, R = this.inspect ? Hc * .17 : Math.min(W * .38, Hc * .94 / 4.96), H = R * 4.76, base = this.inspect ? Hc * .9 : Hc * .94;
      drawCyl(c, { cx:W / 2, y0:base - H, H:H, R:R, e:e, phi:this.phi, tex:hbLabel, lx:this.lx, cool:this.cool || 0 });
    };
    function HBPack(cv, inspect){ this.c = cv; this.x = cv.getContext('2d'); this.alpha = .5; this.inspect = inspect; var me = this; hbReady.push(function(){ me.draw(); }); }
    HBPack.prototype.draw = function(){
      fitCanvas(this.c);
      var c = this.x, W = this.c.width, Hc = this.c.height; if(!W || !hbPackTex) return;
      c.clearRect(0, 0, W, Hc);
      var e = .2, R = this.inspect ? Hc * .12 : W * .17, H = R * 4.76, a = this.alpha, gx = W / 2;
      var gBase = (this.inspect ? Hc * .86 : Hc * .9) - 1.414 * R * e;
      var cans = [{ x:-R, z:-R, t:hbPackTex.L }, { x:R, z:-R, t:hbPackTex.R }, { x:-R, z:R, t:hbPackTex.B }, { x:R, z:R, t:hbPackTex.B }];
      cans.forEach(function(k){ k.sx = gx + k.x * Math.cos(a) - k.z * Math.sin(a); k.sz = k.x * Math.sin(a) + k.z * Math.cos(a); k.base = gBase - k.sz * e; k.y0 = k.base - H; });
      c.fillStyle = '#07080c';                                            /* the shrink film across the valleys between cans */
      [[0, 1], [1, 3], [3, 2], [2, 0]].forEach(function(p){ var A1 = cans[p[0]], B1 = cans[p[1]];
        c.beginPath(); c.moveTo(A1.sx, A1.y0 + e * R); c.lineTo(B1.sx, B1.y0 + e * R); c.lineTo(B1.sx, B1.base); c.lineTo(A1.sx, A1.base); c.closePath(); c.fill(); });
      cans.slice().sort(function(p, q){ return q.sz - p.sz; }).forEach(function(k){
        drawCyl(c, { cx:k.sx, y0:k.y0, H:H, R:R, e:e, phi:a, tex:k.t, sleeve:true, noLid:true, lx:.3 });
      });
      c.beginPath(); [0, 1, 3, 2].forEach(function(i2, k2){ var k = cans[i2]; k2 ? c.lineTo(k.sx, k.y0) : c.moveTo(k.sx, k.y0); }); c.closePath();
      c.fillStyle = '#0c0e14'; c.fill();
      cans.forEach(function(k){ drawLid(c, k.sx, k.y0, R * .95, e, true); });
    };

    /* desk renderers: a can lying on its side (seen from above), and the 4-pack lying on its back, torn open, one can gone */
    function LieCan(cv){ this.c = cv; this.x = cv.getContext('2d'); this.phi = 0; var me = this; hbReady.push(function(){ me.draw(); }); window.addEventListener('cangl:ready', function(){ me.draw(); }); }
    LieCan.prototype.draw = function(){
      fitCanvas(this.c);
      if(CanGL){ var li = this.c.closest('.cobj'); if(CanGL.render(this.c, { mode:'top', phi:this.phi, angle:li ? num(li, '--r') : 0 })) return; }
      var c = this.x, W = this.c.width, Hc = this.c.height; if(!W || !hbLabel.naturalWidth) return;
      c.clearRect(0, 0, W, Hc);
      var R = W * .44, H = R * 4.76;
      drawCyl(c, { cx:W / 2, y0:(Hc - H) / 2 + R * .05, H:H, R:R, e:.06, phi:this.phi, tex:hbLabel, lx:.3 });
    };
    function TornPack(cv){ this.c = cv; this.x = cv.getContext('2d'); var me = this; hbReady.push(function(){ me.draw(); }); }
    TornPack.prototype.draw = function(){
      fitCanvas(this.c);
      var c = this.x, W = this.c.width, Hc = this.c.height; if(!W || !hbPackTex) return;
      c.clearRect(0, 0, W, Hc);
      var R = W * .225, H = R * 4.76, y0 = (Hc - H) / 2, e = .06, xl = W * .27, xr = W * .73;
      /* the film holding the pair together */
      c.fillStyle = '#08090d'; c.beginPath(); c.roundRect ? c.roundRect(xl - R * 1.02, y0 - R * .06, xr - xl + R * 2.04, H + R * .12, R * .12) : c.rect(xl - R * 1.02, y0 - R * .06, xr - xl + R * 2.04, H + R * .12); c.fill();
      /* the slot where the hero can was: the can underneath, in shadow */
      drawCyl(c, { cx:xr, y0:y0 + R * .05, H:H * .985, R:R * .96, e:e, phi:.9, tex:hbPackTex.B, sleeve:true, noLid:true, lx:.3 });
      var sh = c.createLinearGradient(xr - R, 0, xr + R, 0); sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(.5, 'rgba(0,0,0,.3)'); sh.addColorStop(1, 'rgba(0,0,0,.5)');
      c.fillStyle = sh; c.fillRect(xr - R, y0, R * 2, H);
      /* the can still in the pack, its printed side up */
      drawCyl(c, { cx:xl, y0:y0, H:H, R:R, e:e, phi:0, tex:hbPackTex.L, sleeve:true, noLid:true, lx:.28 });
      /* torn film: ragged flaps along the empty slot, one carrying a strip of print */
      var rnd = (function(s){ return function(){ s = (s * 9301 + 49297) % 233280; return s / 233280; }; })(11);
      function flap(xa, ya, xb, yb, depth, print){
        c.beginPath(); c.moveTo(xa, ya);
        var n = 14; for(var i2 = 1; i2 < n; i2++){ var t = i2 / n, x = xa + (xb - xa) * t, y = ya + (yb - ya) * t; c.lineTo(x + (rnd() - .5) * R * .12 + depth * (.35 + rnd() * .65), y + (rnd() - .5) * R * .1); }
        c.lineTo(xb, yb); c.closePath();
        c.fillStyle = print ? '#16194a' : '#0b0c11'; c.fill();
        c.strokeStyle = 'rgba(255,255,255,.34)'; c.lineWidth = Math.max(1, R * .025); c.stroke();
      }
      flap(xr - R * .98, y0 + H * .04, xr - R * .98, y0 + H * .96, R * .38, true);           /* the tear along the kept can */
      flap(xr + R * .98, y0 + H * .1, xr + R * .98, y0 + H * .7, -R * .3, false);            /* the far side of the sleeve, ripped */
      c.fillStyle = '#0b0c11';
      c.beginPath(); c.moveTo(xr - R, y0 - R * .06); c.lineTo(xr + R, y0 - R * .06); c.lineTo(xr + R * .6, y0 + H * .05); c.lineTo(xr - R * .2, y0 + H * .09); c.lineTo(xr - R * .7, y0 + H * .03); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(xr - R, y0 + H + R * .06); c.lineTo(xr + R, y0 + H + R * .06); c.lineTo(xr + R * .5, y0 + H * .93); c.lineTo(xr - R * .1, y0 + H * .96); c.closePath(); c.fill();
      /* a soft sheen across the film */
      var g = c.createLinearGradient(0, y0, W, y0 + H); g.addColorStop(0, 'rgba(255,255,255,.05)'); g.addColorStop(.4, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.03)');
      c.fillStyle = g; c.fillRect(xl - R, y0, xr - xl + 2 * R, H);
    };

    var hb = {};
    function wireHB(el){
      var fine = state.desktop && fineNow(), calm = state.reduce;
      var lie = $('.cobj--lie', el), pack = $('.cobj--pack3', el), napkin = $('.napkin', el), logo = $('[data-logo]', el), bolts = $('[data-bolts]', el);
      hb.lie = new LieCan($('[data-liecan]', el));
      if(hbLabel.complete && hbLabel.naturalWidth){ if(!hbPackTex) buildPackTex(); hb.lie.draw(); }
      if(window.ResizeObserver) new ResizeObserver(function(){ hb.lie.draw(); }).observe(lie);
      $$('button[data-hb]', el).forEach(function(b){ b.addEventListener('click', function(){ openHB(+b.dataset.hb, b); }); });

      /* the can lying in its spill: touched, it rocks a hair on its side, rolling without slipping, and settles */
      var roll = $('.lie__roll', lie), rock = { d:0 };
      function applyRock(){ roll.style.transform = 'translateX(' + rock.d.toFixed(3) + '%)'; hb.lie.phi = rock.d / 44 * 2; hb.lie.draw(); }
      if(fine && !calm){
        hoverFocus(lie, function(){
          gsap.timeline({ overwrite:true }).to(rock, { d:4.5, duration:.35, ease:'power2.out', onUpdate:applyRock })
            .to(rock, { d:0, duration:1.1, ease:'elastic.out(1,.45)', onUpdate:applyRock });
        }, function(){});
        hoverFocus(pack, function(){ gsap.to($('.obj__tilt', pack), { y:-5, scale:1.012, duration:.45, ease:'power3.out' }); },
                        function(){ gsap.to($('.obj__tilt', pack), { y:0, scale:1, duration:.55, ease:'power3.out' }); });
      }

      /* the spill spreads out across the napkin from the can's mouth as the desk opens */
      var pud = [$('.sk__pud', napkin)].concat($$('.sk__pudclip, .sk__pudclip-follow', napkin)), ORG = '49 181';
      hb.spread = function(){
        if(calm){ gsap.set(pud, { scale:1, svgOrigin:ORG }); return; }
        gsap.fromTo(pud, { scale:.14, svgOrigin:ORG }, { scale:1, svgOrigin:ORG, duration:2.4, delay:.3, ease:'power2.out' });
      };

      /* the lockup: touched, lightning cracks out from behind it for a moment, the way it does on the can */
      var cx2 = bolts.getContext('2d'), flashing = false;
      function arcs(seed){
        var d = Math.min(window.devicePixelRatio || 1, 2), W = bolts.width = Math.round(bolts.offsetWidth * d), H = bolts.height = Math.round(bolts.offsetHeight * d);
        var s = seed; function r(){ s = (s * 9301 + 49297) % 233280; return s / 233280; }
        cx2.clearRect(0, 0, W, H); cx2.lineCap = 'round'; cx2.lineJoin = 'round';
        var ox = W * .5, oy = H * .52;
        function bolt(x, y, ang, len, w, depth){
          var pts = [[x, y]], n = 16, px = x, py = y;
          for(var i2 = 1; i2 <= n; i2++){
            var t = len / n; ang += (r() - .5) * 1.1;
            px += Math.cos(ang) * t; py += Math.sin(ang) * t; pts.push([px, py]);
            if(depth < 3 && r() < .22) bolt(px, py, ang + (r() - .5) * 1.8, len * (.3 + r() * .3), w * .6, depth + 1);
          }
          [[w * 6, 'rgba(60,110,245,.12)'], [w * 2.6, 'rgba(90,190,255,.45)'], [w, 'rgba(240,252,255,.95)']].forEach(function(p){
            cx2.beginPath(); pts.forEach(function(q, k2){ k2 ? cx2.lineTo(q[0], q[1]) : cx2.moveTo(q[0], q[1]); });
            cx2.lineWidth = p[0]; cx2.strokeStyle = p[1]; cx2.stroke();
          });
        }
        var count = 7;
        for(var k3 = 0; k3 < count; k3++){
          var a = (k3 / count) * Math.PI * 2 + r() * .6;
          bolt(ox + Math.cos(a) * W * .06, oy + Math.sin(a) * H * .06, a, Math.max(W, H) * (.36 + r() * .22), Math.max(.8, W * .0024), 0);
        }
      }
      function flash(){
        if(flashing) return; flashing = true;
        if(calm){ arcs(3); gsap.fromTo(bolts, { opacity:.6 }, { opacity:0, duration:.3, onComplete:function(){ flashing = false; } }); return; }
        var seed = Math.floor(Math.random() * 9000) + 7;
        gsap.timeline({ onComplete:function(){ flashing = false; cx2.clearRect(0, 0, bolts.width, bolts.height); } })
          .call(function(){ arcs(seed); }).set(bolts, { opacity:1 })
          .to(bolts, { opacity:.25, duration:.06 }, .07)
          .call(function(){ arcs(seed + 31); }, null, .13).set(bolts, { opacity:1 }, .13)
          .to(bolts, { opacity:0, duration:.32, ease:'power2.in' }, .2);
      }
      logo.addEventListener('pointerenter', function(e){ if(e.pointerType === 'mouse') flash(); });
      logo.addEventListener('pointerup', function(e){ if(e.pointerType !== 'mouse') flash(); });
      logo.addEventListener('focus', flash);
    }

    /* packaging inspection: the can or the 4-pack, large; drag, arrows or the buttons turn it */
    var hinsp = $('[data-hinsp]'), hStage = $('.hinsp__stage', hinsp), hCanvas = $('[data-hinsp-canvas]', hinsp);
    var hClose = $('[data-hinsp-close]', hinsp), hPrev = $('[data-hinsp-prev]', hinsp), hNext = $('[data-hinsp-next]', hinsp), hLeft = $('[data-hinsp-left]', hinsp), hRight = $('[data-hinsp-right]', hinsp);
    var HB_ITEMS = [
      { title:'Hydrobolt can', meta:'475 mL, full wrap', note:'The bolt and wordmark on the front; turn it for the Finish Strong panel and the nutrition facts.' },
      { title:'Hydrobolt 4-pack', meta:'Four 475 mL cans in a printed black sleeve', note:'The bolt runs across the two front cans; turn it for the sides and back.' }
    ];
    var hOpen = false, hi = 0, hSrc = null, hFrom = null, hView = { a:0 }, iCan = new HBCan(hCanvas, true), iPack = new HBPack(hCanvas, true);
    function hDraw(){ if(hi === 0){ iCan.phi = hView.a; iCan.draw(); } else { iPack.alpha = hView.a; iPack.draw(); } }
    function setHB(i, a){
      hi = i; hView.a = a; var q = HB_ITEMS[i];
      $('#hinsp-title', hinsp).textContent = q.title; $('.insp__meta', hinsp).textContent = q.meta; $('.insp__note', hinsp).textContent = q.note;
      $('[data-hinsp-count]', hinsp).textContent = '0' + (i + 1) + ' / 02';
      hCanvas.setAttribute('aria-label', q.title + '. Drag, or use the arrow keys, to turn it');
      hDraw();
    }
    function turnHB(d){ gsap.to(hView, { a:hView.a + d * Math.PI / 3, duration:state.reduce ? .01 : .8, ease:'power3.inOut', overwrite:true, onUpdate:hDraw }); }
    function switchHB(d){
      var j = (hi + d + 2) % 2;
      if(state.reduce){ setHB(j, j ? .5 : 0); return; }
      gsap.to(hStage, { autoAlpha:0, x:-d * 60, duration:.2, ease:'power2.in', onComplete:function(){ setHB(j, j ? .5 : 0); gsap.fromTo(hStage, { autoAlpha:0, x:d * 60 }, { autoAlpha:1, x:0, duration:.34, ease:'power3.out' }); } });
    }
    function openHB(i, src){
      hOpen = true; hSrc = src; var vis = $('canvas, img', src);
      hinsp.hidden = false; hinsp.classList.add('is-open');
      setHB(i, i ? .5 : 0);
      var st = hStage.getBoundingClientRect(), r = vis.getBoundingClientRect();
      hFrom = { x:(r.left + r.width / 2) - (st.left + st.width / 2), y:(r.top + r.height / 2) - (st.top + st.height / 2), scale:Math.max(r.width, r.height) / st.width };
      var rest = $$('.insp__bar, .insp__cap, .insp__close', hinsp);
      if(state.reduce){ gsap.fromTo(hinsp, { autoAlpha:0 }, { autoAlpha:1, duration:.2 }); }
      else {
        vis.style.visibility = 'hidden';
        gsap.set(hinsp, { autoAlpha:1 });
        gsap.fromTo($('.insp__scrim', hinsp), { autoAlpha:0 }, { autoAlpha:1, duration:.5 });
        gsap.fromTo(hStage, { x:hFrom.x, y:hFrom.y, scale:hFrom.scale }, { x:0, y:0, scale:1, duration:.8, ease:'power3.inOut' });
        gsap.fromTo(rest, { opacity:0 }, { opacity:1, duration:.4, delay:.5 });
      }
      setTimeout(function(){ hClose.focus({ preventScroll:true }); }, 80);
    }
    function closeHB(instant){
      if(!hOpen) return; hOpen = false;
      var src = hSrc, vis = src && $('canvas, img', src);
      var done = function(){ hinsp.hidden = true; hinsp.classList.remove('is-open'); gsap.set([hinsp, hStage], { clearProps:'all' }); if(vis) vis.style.visibility = ''; };
      if(instant || state.reduce){ done(); if(!instant && src) src.focus({ preventScroll:true }); return; }
      gsap.to($$('.insp__bar, .insp__cap, .insp__close', hinsp), { opacity:0, duration:.2 });
      gsap.to($('.insp__scrim', hinsp), { autoAlpha:0, duration:.45, delay:.15 });
      gsap.to(hStage, { x:hFrom.x, y:hFrom.y, scale:hFrom.scale, autoAlpha:0, duration:.6, ease:'power3.inOut', onComplete:function(){ done(); src.focus({ preventScroll:true }); } });
    }
    hLeft.addEventListener('click', function(){ turnHB(-1); }); hRight.addEventListener('click', function(){ turnHB(1); });
    hPrev.addEventListener('click', function(){ switchHB(-1); }); hNext.addEventListener('click', function(){ switchHB(1); });
    hClose.addEventListener('click', function(){ closeHB(); });
    $('[data-hinsp-bg]', hinsp).addEventListener('click', function(){ closeHB(); });
    var hdx = null;
    hCanvas.addEventListener('pointerdown', function(e){ hdx = e.clientX; hCanvas.setPointerCapture(e.pointerId); gsap.killTweensOf(hView); });
    hCanvas.addEventListener('pointermove', function(e){ if(hdx === null) return; hView.a -= (e.clientX - hdx) * .012; hdx = e.clientX; hDraw(); });
    hCanvas.addEventListener('pointerup', function(){ hdx = null; });
    hCanvas.addEventListener('pointercancel', function(){ hdx = null; });
    document.addEventListener('keydown', function(e){
      if(!hOpen) return;
      if(e.key === 'Escape'){ e.preventDefault(); closeHB(); }
      else if(e.key === 'ArrowRight'){ e.preventDefault(); turnHB(1); }
      else if(e.key === 'ArrowLeft'){ e.preventDefault(); turnHB(-1); }
      else if(e.key === 'Tab'){
        var f = [hClose, hPrev, hLeft, hRight, hNext], k = f.indexOf(document.activeElement);
        e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    window.addEventListener('resize', function(){ if(hOpen) hDraw(); });


    wireHB(el);
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function(){ if(hb.spread) hb.spread(); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
