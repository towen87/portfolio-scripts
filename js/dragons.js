/* =====================================================================
   Wolseley Dragons: the desk page (Webflow build)
   Needs GSAP (loaded before this file) and css/site.css.
   Images load from this repository, worked out from where this file was loaded.
   ===================================================================== */
(function(){
  'use strict';
  var me = document.currentScript;
  var ROOT = window.DESK_ROOT || (me && me.src ? me.src.replace(/js\/dragons(\.min)?\.js.*$/, '') : '');
  var $  = function(s, c){ return (c || document).querySelector(s); };
  var $$ = function(s, c){ return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function start(){
    if(!window.gsap){ console.error('dragons.js: GSAP is not loaded'); return; }
    var el = $('[data-case="dragons"]'); if(!el) return;
    var root = document.documentElement;
    var state = {
      reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      desktop: window.matchMedia('(min-width: 1024px)').matches
    };
    function fineNow(){ return window.matchMedia('(hover: hover) and (pointer: fine)').matches; }
    function img(k, side){ return ROOT + 'img/dragons/dr-' + k + '-' + side + '.webp'; }
    function hoverFocus(li, enter, leave){
      var on = false;
      function go(){ if(!on){ on = true; enter(); } }
      function stop(){ if(on){ on = false; leave(); } }
      li.addEventListener('pointerenter', go); li.addEventListener('pointerleave', stop);
      li.addEventListener('focusin', go); li.addEventListener('focusout', function(e){ if(!li.contains(e.relatedTarget)) stop(); });
    }

    /* on its own page the desk is simply open */
    el.hidden = false; root.classList.add('case-open'); gsap.set(el, { autoAlpha:1 });

    var DR = [
      { k:'sonny',   name:'Sonny',   title:'The Sun Dragon',     move:'Fire Breath',   note:'Lets out a blazing roar, shooting streams of hot flames to scare off enemies and light up the sky.' },
      { k:'chicky',  name:'Chicky',  title:'The Chicken Dragon', move:'Clucknado',     note:'With a mighty squawk, spits out spinning tornadoes that send foes flying like feathers in the wind.' },
      { k:'spark',   name:'Spark',   title:'The Sparkle Dragon', move:'Glitter Gust',  note:'Breathes out dazzling dust that shimmers in the air, and makes anything it touches vanish in a flash.' },
      { k:'windy',   name:'Windy',   title:'The Wind Dragon',    move:'Storm Swirl',   note:'Whips up powerful gusts and swirling storms, steering the air itself to blow away anything in its path.' },
      { k:'splash',  name:'Splash',  title:'The Water Dragon',   move:'Storm Swirl',   note:'Sprays a giant gush of water, soaking everything in sight and sending enemies drifting away like rubber duckies.' },
      { k:'icy',     name:'Icy',     title:'The Ice Dragon',     move:'Frosty Tunes',  note:'Breathes chilly crystals that tinkle like music, turning frozen air into a frosty symphony.' },
      { k:'plancer', name:'Plancer', title:'The Earth Dragon',   move:'Grow Glow',     note:'Breathes out sparkling green energy that makes plants sprout, bloom and grow tall in seconds.' },
      { k:'moon',    name:'Moon',    title:'The Moon Dragon',    move:'Lunar Lullaby', note:'With a wave of its moon wand, sings gentle lullabies that send even the fiercest foes drifting off to sleep.' }
    ];

    var fine = state.desktop && fineNow(), calm = state.reduce;
    $$('button[data-dr]', el).forEach(function(b){ b.addEventListener('click', function(){ openDragon(+b.dataset.dr, b); }); });
    /* the line-up: a card lifts and leans a touch */
    $$('.cobj--dc', el).forEach(function(li){
      var c = $('.dcard', li);
      if(fine && !calm) hoverFocus(li, function(){ gsap.to(c, { y:'-4%', rotation:-1.2, scale:1.03, duration:.35, ease:'power3.out' }); },
                                        function(){ gsap.to(c, { y:0, rotation:0, scale:1, duration:.45, ease:'power3.out' }); });
    });
    /* the torn pack: the card inside slides out of the tear */
    var torn = $('.cobj--dtorn', el), pulled = torn && $('.dtorn__card:not(.dtorn__card--2)', torn);
    if(torn && !calm) hoverFocus(torn, function(){ gsap.to(pulled, { xPercent:22, yPercent:-3, rotation:4, duration:.45, ease:'power3.out' }); },
                                       function(){ gsap.to(pulled, { xPercent:0, yPercent:0, rotation:0, duration:.5, ease:'power3.inOut' }); });
    /* arriving: the line-up is dealt out left to right; everything else is already there */
    function arrive(){
      if(calm) return;
      var row = $$('.cobj--dc .dcard', el);
      gsap.fromTo(row, { x:'-30%', y:'8%', rotation:-6, autoAlpha:0 }, { x:0, y:0, rotation:0, autoAlpha:1, duration:.55, ease:'power3.out', stagger:.07, delay:.25, clearProps:'transform,opacity,visibility' });
      if(pulled) gsap.fromTo(pulled, { xPercent:-14 }, { xPercent:0, duration:.7, ease:'power3.out', delay:.7 });
    }

    /* inspection: front and back side by side; previous/next runs through all eight */
    var dinsp = $('[data-dinsp]'), dPair = $('.dinsp__pair', dinsp), dFront = $('[data-dinsp-front]', dinsp), dBack = $('[data-dinsp-back]', dinsp);
    var dClose = $('[data-dinsp-close]', dinsp), dPrev = $('[data-dinsp-prev]', dinsp), dNext = $('[data-dinsp-next]', dinsp);
    var dOpen = false, di = 0, dSrc = null, dFrom = null;
    function setDragon(i){
      di = (i + DR.length) % DR.length; var d = DR[di];
      dFront.src = img(d.k, 'front'); dBack.src = img(d.k, 'back');
      dFront.alt = d.name + ', ' + d.title.toLowerCase() + ': the front of the card';
      dBack.alt = 'The back of the card: a silhouette, the special move ' + d.move + ', and number ' + (di + 1) + ' of 8';
      $('#dinsp-title', dinsp).textContent = d.name + ', ' + d.title.toLowerCase();
      $('.insp__meta', dinsp).textContent = 'No. ' + (di + 1) + ' of 8 · Special move: ' + d.move;
      $('.insp__note', dinsp).textContent = d.note;
      $('[data-dinsp-count]', dinsp).textContent = '0' + (di + 1) + ' / 08';
    }
    function stepDragon(d){
      if(state.reduce){ setDragon(di + d); return; }
      gsap.to(dPair, { autoAlpha:0, x:-d * 50, duration:.18, ease:'power2.in', onComplete:function(){ setDragon(di + d); gsap.fromTo(dPair, { autoAlpha:0, x:d * 50 }, { autoAlpha:1, x:0, duration:.32, ease:'power3.out' }); } });
    }
    function openDragon(i, src){
      dOpen = true; dSrc = src; setDragon(i);
      dinsp.hidden = false; dinsp.classList.add('is-open');
      var vis = $('img', src), r = vis.getBoundingClientRect(), f = dFront.getBoundingClientRect();
      dFrom = { x:(r.left + r.width / 2) - (f.left + f.width / 2), y:(r.top + r.height / 2) - (f.top + f.height / 2), s:r.width / f.width };
      var rest = $$('.insp__bar, .insp__cap, .insp__close, .dinsp__side figcaption', dinsp);
      if(state.reduce){ gsap.fromTo(dinsp, { autoAlpha:0 }, { autoAlpha:1, duration:.2 }); }
      else {
        gsap.set(dinsp, { autoAlpha:1 });
        gsap.fromTo($('.insp__scrim', dinsp), { autoAlpha:0 }, { autoAlpha:1, duration:.45 });
        gsap.fromTo(dFront.parentNode, { x:dFrom.x, y:dFrom.y, scale:dFrom.s }, { x:0, y:0, scale:1, duration:.7, ease:'power3.inOut' });
        gsap.fromTo(dBack.parentNode, { autoAlpha:0, x:-40 }, { autoAlpha:1, x:0, duration:.45, delay:.45, ease:'power3.out' });
        gsap.fromTo(rest, { opacity:0 }, { opacity:1, duration:.35, delay:.5 });
      }
      setTimeout(function(){ dClose.focus({ preventScroll:true }); }, 80);
    }
    function closeDragon(){
      if(!dOpen) return; dOpen = false;
      var src = dSrc;
      var done = function(){ dinsp.hidden = true; dinsp.classList.remove('is-open'); gsap.set([dinsp, dPair, dFront.parentNode, dBack.parentNode], { clearProps:'all' }); };
      if(state.reduce){ done(); if(src) src.focus({ preventScroll:true }); return; }
      gsap.to($$('.insp__bar, .insp__cap, .insp__close, .dinsp__side figcaption', dinsp), { opacity:0, duration:.18 });
      gsap.to(dBack.parentNode, { autoAlpha:0, duration:.2 });
      gsap.to($('.insp__scrim', dinsp), { autoAlpha:0, duration:.45, delay:.15 });
      gsap.to(dFront.parentNode, { x:dFrom.x, y:dFrom.y, scale:dFrom.s, autoAlpha:0, duration:.55, ease:'power3.inOut', onComplete:function(){ done(); src.focus({ preventScroll:true }); } });
    }
    dClose.addEventListener('click', function(){ closeDragon(); });
    $('[data-dinsp-bg]', dinsp).addEventListener('click', function(){ closeDragon(); });
    dPrev.addEventListener('click', function(){ stepDragon(-1); }); dNext.addEventListener('click', function(){ stepDragon(1); });
    var dsx = null;
    dPair.addEventListener('pointerdown', function(e){ dsx = e.clientX; });
    dPair.addEventListener('pointerup', function(e){ if(dsx !== null && Math.abs(e.clientX - dsx) > 40) stepDragon(e.clientX < dsx ? 1 : -1); dsx = null; });
    document.addEventListener('keydown', function(e){
      if(!dOpen) return;
      if(e.key === 'Escape'){ e.preventDefault(); closeDragon(); }
      else if(e.key === 'ArrowRight'){ e.preventDefault(); stepDragon(1); }
      else if(e.key === 'ArrowLeft'){ e.preventDefault(); stepDragon(-1); }
      else if(e.key === 'Tab'){ var f = [dClose, dPrev, dNext], k = f.indexOf(document.activeElement); e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
    });

    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(arrive);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
