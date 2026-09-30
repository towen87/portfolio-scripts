/* =====================================================================
   Hockey Posters: the desk page (Webflow build)
   Needs GSAP (loaded before this file) and css/site.css.
   Images load from this repository: the address is worked out from where this file was loaded,
   so nothing needs configuring. (window.DESK_ROOT overrides it, if ever needed.)
   ===================================================================== */
(function(){
  'use strict';
  var me = document.currentScript;
  var ROOT = window.DESK_ROOT || (me && me.src ? me.src.replace(/js\/posters(\.min)?\.js.*$/, '') : '');
  var $  = function(s, c){ return (c || document).querySelector(s); };
  var $$ = function(s, c){ return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function start(){
    if(!window.gsap){ console.error('posters.js: GSAP is not loaded'); return; }
    var el = $('[data-case="posters"]'); if(!el) return;
    var root = document.documentElement;
    var state = {
      reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      desktop: window.matchMedia('(min-width: 1024px)').matches
    };
    var clamp = gsap.utils.clamp(-1, 1);
    var num = function(n, p){ return parseFloat(getComputedStyle(n).getPropertyValue(p)); };
    var cq = function(){ return $('.case__stage', el).getBoundingClientRect().width / 100; };
    var live = $('[data-live]');
    function fineNow(){ return window.matchMedia('(hover: hover) and (pointer: fine)').matches; }
    function img(n){ return ROOT + 'img/posters/poster-' + n + '.webp'; }

    /* on its own page the desk is simply open */
    el.hidden = false; root.classList.add('case-open'); gsap.set(el, { autoAlpha:1 });

    /* a touch (pointer or keyboard) wakes an object; only a pointer that actually moves counts */
    function hoverFocus(li, enter, leave){
      var on = false;
      function go(){ if(!on){ on = true; enter(); } }
      function stop(){ if(on){ on = false; leave(); } }
      li.addEventListener('pointerenter', go); li.addEventListener('pointerleave', stop);
      li.addEventListener('focusin', go); li.addEventListener('focusout', function(e){ if(!li.contains(e.relatedTarget)) stop(); });
    }
    /* the print leans a little toward the pointer */
    function lean(li, max){
      var t = $('.obj__tilt', li);
      gsap.set(t, { transformPerspective:1400 });
      var rx = gsap.quickTo(t, 'rotationX', { duration:.6, ease:'power3.out' }), ry = gsap.quickTo(t, 'rotationY', { duration:.6, ease:'power3.out' });
      li.addEventListener('pointermove', function(e){ var b = li.getBoundingClientRect();
        ry(clamp((e.clientX - b.left) / b.width * 2 - 1) * max); rx(-clamp((e.clientY - b.top) / b.height * 2 - 1) * max); });
      li.addEventListener('pointerleave', function(){ rx(0); ry(0); });
    }
    function totalRot(n, stop){ var a = 0; for(; n && n !== stop; n = n.parentElement){ var t = getComputedStyle(n).transform; if(t && t !== 'none'){ var m = new DOMMatrixReadOnly(t); a += Math.atan2(m.b, m.a) * 180 / Math.PI; } } return a; }

    var POSTERS = [
      { n:'01', title:'Eagles, M. Rios',                note:'A gilded frame, broken open: four moments of one player in black and gold.' },
      { n:'02', title:'Gatineau',                       note:'A monochrome arena, with five poses swept around the crest.' },
      { n:'03', title:'Windsor Spitfires, Alex Connor', note:'Red, torn and stamped: the name set huge behind three frames of the player.' },
      { n:'04', title:'Carson Breton',                  note:'A crest-sized C behind the player, with trophies and a stat panel at his feet.' },
      { n:'05', title:'Glasgow Clan',                   note:'A purple collage built around the Challenge Cup and the trophy kiss.' },
      { n:'06', title:'Devils, Matheson 19',            note:'Maroon on white, with the team name running through the grid.' }
    ];

    /* the prints: a small lift under the pointer, a click to inspect */
    var fine = state.desktop && fineNow() && !state.reduce;
    $$('button[data-pi]', el).forEach(function(b){
      b.addEventListener('click', function(){ openPoster(+b.dataset.pi, $('.fp', b), b); });
      if(!fine) return;
      var li = b.closest('.cobj'), tilt = $('.obj__tilt', li), sheet = $('.fp', li);
      lean(li, 1.1);
      hoverFocus(li, function(){ gsap.to(tilt, { scale:1.015, duration:.45, ease:'power3.out' }); gsap.to(sheet, { '--lift':.55, duration:.45 }); },
                     function(){ gsap.to(tilt, { scale:1, duration:.55, ease:'power3.out' }); gsap.to(sheet, { '--lift':0, duration:.55 }); });
    });

    /* the tube: the Glasgow Clan print slides out of it as the page opens; the other prints arrive down and to the left */
    var tube = $('[data-tube]', el), print = $('.tube__print', el), OUT = 8;
    if(print) print.style.backgroundImage = 'url(' + img('05') + ')';
    function arrive(){
      var prints = $$('.cobj[data-pposter]', el);
      if(state.reduce || !state.desktop){ if(tube) tube.style.setProperty('--out', OUT); return; }
      var u = cq();
      if(tube) gsap.fromTo(tube, { '--out':.6 }, { '--out':OUT, duration:1.5, delay:.25, ease:'power2.inOut' });
      prints.forEach(function(p, i){
        gsap.fromTo(p, { x:4.2 * u, y:-3 * u, rotation:4 + i, autoAlpha:0 },
                       { x:0, y:0, rotation:0, autoAlpha:1, duration:.9, delay:.35 + i * .12, ease:'power3.out', clearProps:'transform' });
      });
    }

    /* inspection: one print, large; previous/next runs through all six */
    var pinsp = $('[data-pinsp]'), pStage = $('.pinsp__stage', pinsp), pImg = $('.pinsp__img', pinsp);
    var pClose = $('[data-pinsp-close]', pinsp), pPrev = $('[data-pinsp-prev]', pinsp), pNext = $('[data-pinsp-next]', pinsp);
    var pOpen = false, pi = 0, pBusy = false, pSrc = null, pVis = null, pFrom = null, pStart = 0;
    function setPoster(i){
      pi = i; var q = POSTERS[i];
      pImg.src = img(q.n);
      $('#pinsp-title', pinsp).textContent = q.title; $('.insp__meta', pinsp).textContent = 'Spec poster, 20 × 30 in matte print';
      $('.insp__note', pinsp).textContent = q.note;
      $('[data-pinsp-count]', pinsp).textContent = ('0' + (i + 1)).slice(-2) + ' / ' + ('0' + POSTERS.length).slice(-2);
      pImg.alt = q.title + ' poster';
    }
    function browsePoster(d){
      if(pBusy) return; var j = (pi + d + POSTERS.length) % POSTERS.length;
      if(live) live.textContent = POSTERS[j].title + ', ' + (j + 1) + ' of ' + POSTERS.length + '.';
      if(state.reduce){ setPoster(j); return; }
      pBusy = true;
      gsap.to(pStage, { x:-d * 80, rotation:-d * 2, autoAlpha:0, duration:.22, ease:'power2.in', onComplete:function(){
        setPoster(j);
        gsap.fromTo(pStage, { x:d * 80, rotation:d * 2, autoAlpha:0 }, { x:0, rotation:0, autoAlpha:1, duration:.36, ease:'power3.out', onComplete:function(){ pBusy = false; } });
      } });
    }
    function openPoster(i, vis, src){
      pOpen = true; pSrc = src; pVis = vis; pStart = i;
      pinsp.hidden = false; pinsp.classList.add('is-open'); setPoster(i);
      var st = pStage.getBoundingClientRect(), r = vis.getBoundingClientRect();
      pFrom = { x:(r.left + r.width / 2) - (st.left + st.width / 2), y:(r.top + r.height / 2) - (st.top + st.height / 2),
                scale:vis.offsetWidth / st.width, rotation:totalRot(vis, src.closest('.case__stage')) };
      var rest = $$('.insp__bar, .insp__cap, .insp__close', pinsp);
      if(state.reduce){ gsap.fromTo(pinsp, { autoAlpha:0 }, { autoAlpha:1, duration:.2 }); }
      else {
        vis.style.visibility = 'hidden';
        gsap.set(pinsp, { autoAlpha:1 });
        gsap.fromTo($('.insp__scrim', pinsp), { autoAlpha:0 }, { autoAlpha:1, duration:.55 });
        gsap.fromTo(pStage, pFrom, { x:0, y:0, scale:1, rotation:0, duration:.85, ease:'power3.inOut' });
        gsap.fromTo(rest, { opacity:0 }, { opacity:1, duration:.4, delay:.55 });
      }
      setTimeout(function(){ pClose.focus({ preventScroll:true }); }, 80);
    }
    function closePoster(instant){
      if(!pOpen) return; pOpen = false;
      var src = pSrc, vis = pVis;
      var done = function(){ pinsp.hidden = true; pinsp.classList.remove('is-open'); gsap.set([pinsp, pStage, pImg], { clearProps:'all' }); if(vis) vis.style.visibility = ''; };
      if(instant || state.reduce){ done(); if(!instant && src) src.focus({ preventScroll:true }); return; }
      gsap.to($$('.insp__bar, .insp__cap, .insp__close', pinsp), { opacity:0, duration:.2 });
      gsap.to($('.insp__scrim', pinsp), { autoAlpha:0, duration:.5, delay:.15 });
      if(pi !== pStart) gsap.to(pImg, { opacity:0, duration:.14, onComplete:function(){ setPoster(pStart); gsap.to(pImg, { opacity:1, duration:.22 }); } });
      gsap.to(pStage, { x:pFrom.x, y:pFrom.y, scale:pFrom.scale, rotation:pFrom.rotation, autoAlpha:1, duration:.75, ease:'power3.inOut', onComplete:function(){
        done(); src.focus({ preventScroll:true });
      } });
    }
    pPrev.addEventListener('click', function(){ browsePoster(-1); }); pNext.addEventListener('click', function(){ browsePoster(1); });
    pClose.addEventListener('click', function(){ closePoster(); });
    $('[data-pinsp-bg]', pinsp).addEventListener('click', function(){ closePoster(); });
    var psx = null;
    pStage.addEventListener('pointerdown', function(e){ psx = e.clientX; });
    pStage.addEventListener('pointerup', function(e){ if(psx === null) return; var dx = e.clientX - psx; psx = null; if(Math.abs(dx) > 40) browsePoster(dx < 0 ? 1 : -1); });
    document.addEventListener('keydown', function(e){
      if(!pOpen) return;
      if(e.key === 'Escape'){ e.preventDefault(); closePoster(); }
      else if(e.key === 'ArrowRight'){ e.preventDefault(); browsePoster(1); }
      else if(e.key === 'ArrowLeft'){ e.preventDefault(); browsePoster(-1); }
      else if(e.key === 'Tab'){
        var f = [pClose, pPrev, pNext], k = f.indexOf(document.activeElement);
        e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });

    /* wait for the fonts, so the desk lays out once, then deal the prints */
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(arrive);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
