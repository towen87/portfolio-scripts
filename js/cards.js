/* =====================================================================
   Trading Cards: the desk page (Webflow build)
   Needs GSAP (loaded before this file) and css/site.css.
   Images load from this repository, worked out from where this file was loaded.
   ===================================================================== */
(function(){
  'use strict';
  var me = document.currentScript;
  var ROOT = window.DESK_ROOT || (me && me.src ? me.src.replace(/js\/cards(\.min)?\.js.*$/, '') : '');
  var $  = function(s, c){ return (c || document).querySelector(s); };
  var $$ = function(s, c){ return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function start(){
    if(!window.gsap){ console.error('cards.js: GSAP is not loaded'); return; }
    var el = $('[data-case="cards"]'); if(!el) return;
    var root = document.documentElement;
    var state = {
      reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      desktop: window.matchMedia('(min-width: 1024px)').matches
    };
    var cq = function(){ return $('.case__stage', el).getBoundingClientRect().width / 100; };
    var live = $('[data-live]') || { textContent:'' };
    function fineNow(){ return window.matchMedia('(hover: hover) and (pointer: fine)').matches; }
    function img(n, side){ return ROOT + 'img/cards/card-' + n + '-' + side + '.webp'; }
    function totalRot(n, stop){ var a = 0; for(; n && n !== stop; n = n.parentElement){ var t = getComputedStyle(n).transform; if(t && t !== 'none'){ var m = new DOMMatrixReadOnly(t); a += Math.atan2(m.b, m.a) * 180 / Math.PI; } } return a; }
    function hoverFocus(li, enter, leave){
      var on = false;
      function go(){ if(!on){ on = true; enter(); } }
      function stop(){ if(on){ on = false; leave(); } }
      li.addEventListener('pointerenter', go); li.addEventListener('pointerleave', stop);
      li.addEventListener('focusin', go); li.addEventListener('focusout', function(e){ if(!li.contains(e.relatedTarget)) stop(); });
    }

    /* on its own page the desk is simply open */
    el.hidden = false; root.classList.add('case-open'); gsap.set(el, { autoAlpha:1 });

    var CARDS = [
      { n:'01', name:'Thomas Howard',  meta:'#35, goalie, Red Deer U18 AAA, 2025–26',             note:'Prism Series: the red crystal field runs behind the player and the number panel.' },
      { n:'02', name:'Riley Stone',    meta:'#8, forward, Royal Heritage Grizzlies U14, 2024–25', note:'Spotlight Series: a lit frame with a chrome border and a signature name.' },
      { n:'03', name:'Chase Anderson', meta:'#9, right wing, Blackwood Vipers U18, 2024–25',      note:'Gameday Series, limited edition: the team colour carries the stat panel on the back.' },
      { n:'04', name:'Kieran Wolf',    meta:'#14, forward, Steel City Reapers Junior A, 2024–25', note:'Gold Series, all-star: foil stars and an ornate gold frame.' },
      { n:'05', name:'Naomi Park',     meta:'#1, goalie, Pine Valley Yetis U16, 2025–26',         note:'Modern Series: holographic rings around the number and the team mark.' },
      { n:'06', name:'Mateo Cruz',     meta:'#15, left wing, Silver Creek Phantoms U19, 2024–25', note:'Chrome Series: a machined chrome frame with the team colour inset.' }
    ];

    /* one pile: every visible card lifts a little under the pointer or keyboard focus; a click picks it up */
    $$('.pcard', el).forEach(function(b){
      b.addEventListener('click', function(){ openCard(+b.dataset.ci, b); });
      if(!(state.desktop && fineNow() && !state.reduce)) return;
      var face = $('.ccard', b), tilt = +b.dataset.r >= 0 ? 1.4 : -1.4;
      hoverFocus(b, function(){ gsap.to(face, { y:-.35 * cq(), scale:1.025, rotation:tilt, '--lift':.65, duration:.35, ease:'power3.out' }); },
                    function(){ gsap.to(face, { y:0, scale:1, rotation:0, '--lift':0, duration:.45, ease:'power3.out' }); });
    });
    /* the cards settle into the pile: each drops a short way, slides a hair past its place and eases back */
    function settle(){
      if(state.reduce) return;
      var u = cq();
      $$('.pcard', el).forEach(function(c, i){
        var r = +c.dataset.r, sx = (i % 2 ? 1 : -1) * (.6 + (i * 37 % 10) / 14), dy = 2.2 + (i * 53 % 10) / 7, dr = (i % 3 - 1) * 6 + (r > 0 ? 4 : -4);
        gsap.timeline({ delay:.12 + i * .055 })
          .fromTo(c, { x:sx * u, y:-dy * u, rotation:r + dr, scale:1.05, autoAlpha:0 },
                     { x:-sx * .07 * u, y:.08 * u, rotation:r - dr * .08, scale:1, autoAlpha:1, duration:.55, ease:'power3.out' })
          .to(c, { x:0, y:0, rotation:r, duration:.45, ease:'power2.out' });
      });
    }

    /* inspection: the card large, turned over with a click or the arrow keys; previous/next runs through all six */
    var cinsp = $('[data-cinsp]'), cStage = $('.cinsp__stage', cinsp), cCard = $('[data-cinsp-card]', cinsp), cInner = $('.cinsp__inner', cinsp);
    var cFront = $('.cinsp__face--front', cinsp), cBack = $('.cinsp__face--back', cinsp), cTurn = $('[data-cinsp-turn]', cinsp);
    var cPrev = $('[data-cinsp-prev]', cinsp), cNext = $('[data-cinsp-next]', cinsp), cClose = $('[data-cinsp-close]', cinsp);
    var cOpen = false, ci = 0, cShowBack = false, cBusy = false, cSrc = null, cHidden = null, cFrom = null, cStart = 0;
    function setCard(i){
      ci = i; var c = CARDS[i];
      cFront.src = img(c.n, 'front'); cBack.src = img(c.n, 'back');
      cShowBack = false; gsap.set(cInner, { rotationY:0 }); cinsp.classList.remove('is-back'); cTurn.setAttribute('aria-pressed', 'false');
      $('#cinsp-title', cinsp).textContent = c.name; $('.insp__meta', cinsp).textContent = c.meta; $('.insp__note', cinsp).textContent = c.note;
      $('[data-cinsp-count]', cinsp).textContent = ('0' + (i + 1)).slice(-2) + ' / ' + ('0' + CARDS.length).slice(-2);
      cCard.setAttribute('aria-label', c.name + ', front showing. Turn the card over');
    }
    function turnCard(){
      cShowBack = !cShowBack;
      cinsp.classList.toggle('is-back', cShowBack); cTurn.setAttribute('aria-pressed', String(cShowBack));
      cCard.setAttribute('aria-label', CARDS[ci].name + ', ' + (cShowBack ? 'back' : 'front') + ' showing. Turn the card over');
      if(!state.reduce){
        gsap.to(cInner, { rotationY:cShowBack ? 180 : 0, duration:.8, ease:'power3.inOut', transformPerspective:1800 });
        gsap.fromTo(cStage, { scale:1 }, { scale:1.04, duration:.4, yoyo:true, repeat:1, ease:'power2.out' });
      }
      live.textContent = 'Showing the ' + (cShowBack ? 'back' : 'front') + ' of ' + CARDS[ci].name + '.';
    }
    function browse(d){
      if(cBusy) return; var j = (ci + d + CARDS.length) % CARDS.length;
      if(state.reduce){ setCard(j); live.textContent = CARDS[j].name + ', ' + (j + 1) + ' of ' + CARDS.length + '.'; return; }
      cBusy = true;
      gsap.to(cStage, { x:-d * 70, rotation:-d * 3, autoAlpha:0, duration:.22, ease:'power2.in', onComplete:function(){
        setCard(j);
        gsap.fromTo(cStage, { x:d * 70, rotation:d * 3, autoAlpha:0 }, { x:0, rotation:0, autoAlpha:1, duration:.34, ease:'power3.out', onComplete:function(){ cBusy = false; } });
      } });
      live.textContent = CARDS[j].name + ', ' + (j + 1) + ' of ' + CARDS.length + '.';
    }
    function openCard(i, src){
      var vis = src.querySelector('.ccard') || src, down = src.dataset.face === 'back';
      cSrc = src; cHidden = vis; cOpen = true; cStart = i;
      cinsp.hidden = false; cinsp.classList.add('is-open'); setCard(i);
      var st = cStage.getBoundingClientRect(), r = vis.getBoundingClientRect();
      cFrom = { x:(r.left + r.width / 2) - (st.left + st.width / 2), y:(r.top + r.height / 2) - (st.top + st.height / 2),
                scale:vis.offsetWidth / st.width, rotation:totalRot(vis, src.closest('.case__stage')) };
      var rest = $$('.cinsp__bar, .insp__cap, .insp__close', cinsp);
      if(state.reduce){ gsap.fromTo(cinsp, { autoAlpha:0 }, { autoAlpha:1, duration:.2 }); }
      else {
        vis.style.visibility = 'hidden';
        gsap.set(cinsp, { autoAlpha:1 });
        gsap.fromTo($('.insp__scrim', cinsp), { autoAlpha:0 }, { autoAlpha:1, duration:.5 });
        gsap.fromTo(cStage, cFrom, { x:0, y:0, scale:1, rotation:0, duration:.8, ease:'power3.inOut' });
        if(down) gsap.fromTo(cInner, { rotationY:180 }, { rotationY:0, duration:.7, delay:.35, ease:'power3.inOut', transformPerspective:2600 });
        gsap.fromTo(rest, { opacity:0 }, { opacity:1, duration:.4, delay:.5 });
      }
      setTimeout(function(){ cClose.focus({ preventScroll:true }); }, 80);
    }
    function closeCard(){
      if(!cOpen) return; cOpen = false;
      var src = cSrc, vis = cHidden;
      var done = function(){ cinsp.hidden = true; cinsp.classList.remove('is-open', 'is-back'); gsap.set([cinsp, cStage], { clearProps:'all' }); gsap.set(cInner, { rotationY:0, opacity:1 }); if(vis) vis.style.visibility = ''; };
      if(state.reduce){ done(); if(src) src.focus({ preventScroll:true }); return; }
      gsap.to($$('.cinsp__bar, .insp__cap, .insp__close', cinsp), { opacity:0, duration:.2 });
      gsap.to($('.insp__scrim', cinsp), { autoAlpha:0, duration:.5, delay:.15 });
      if(ci !== cStart){ var back0 = cShowBack; gsap.to(cInner, { opacity:0, duration:.14, onComplete:function(){ setCard(cStart); if(back0){ cShowBack = true; gsap.set(cInner, { rotationY:180 }); } gsap.to(cInner, { opacity:1, duration:.22 }); } }); }
      var landBack = src && src.dataset.face === 'back';          /* it goes back the way it was lying */
      if(cShowBack !== landBack) gsap.to(cInner, { rotationY:landBack ? 180 : 0, duration:.55, ease:'power2.inOut', transformPerspective:1800 });
      gsap.to(cStage, { x:cFrom.x, y:cFrom.y, scale:cFrom.scale, rotation:cFrom.rotation, autoAlpha:1, duration:.7, ease:'power3.inOut', onComplete:function(){ done(); src.focus({ preventScroll:true }); } });
    }
    cCard.addEventListener('click', turnCard); cTurn.addEventListener('click', turnCard);
    cPrev.addEventListener('click', function(){ browse(-1); }); cNext.addEventListener('click', function(){ browse(1); });
    cClose.addEventListener('click', function(){ closeCard(); });
    $('[data-cinsp-bg]', cinsp).addEventListener('click', function(){ closeCard(); });
    var csx = null;
    cStage.addEventListener('pointerdown', function(e){ csx = e.clientX; });
    cStage.addEventListener('pointerup', function(e){ if(csx === null) return; var dx = e.clientX - csx; csx = null; if(Math.abs(dx) > 40){ e.preventDefault(); browse(dx < 0 ? 1 : -1); } });
    document.addEventListener('keydown', function(e){
      if(!cOpen) return;
      if(e.key === 'Escape'){ e.preventDefault(); closeCard(); }
      else if(e.key === 'ArrowRight'){ e.preventDefault(); browse(1); }
      else if(e.key === 'ArrowLeft'){ e.preventDefault(); browse(-1); }
      else if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){ e.preventDefault(); turnCard(); }
      else if(e.key === 'Tab'){
        var f = [cClose, cPrev, cTurn, cNext, cCard], k = f.indexOf(document.activeElement);
        e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });

    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(settle);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
