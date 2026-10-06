(function(){
  var LANGS=['en','sv','el'];
  function pick(){
    var q=new URLSearchParams(location.search).get('lng');
    if(LANGS.indexOf(q)>=0) return q;
    try{var s=localStorage.getItem('eduLang'); if(LANGS.indexOf(s)>=0) return s;}catch(e){}
    var n=(navigator.language||'en').slice(0,2); return LANGS.indexOf(n)>=0?n:'en';
  }
  function apply(l){
    document.documentElement.setAttribute('data-lang',l); document.documentElement.lang=l;
    try{localStorage.setItem('eduLang',l);}catch(e){}
    document.querySelectorAll('.langs button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.lang===l?'true':'false');});
    document.querySelectorAll('a[data-lng-link]').forEach(function(a){
      var u=a.getAttribute('data-lng-link'); a.href=u+(u.indexOf('?')>=0?'&':'?')+'lng='+l;
    });
    document.querySelectorAll('[data-lng-src]').forEach(function(img){img.src=img.getAttribute('data-lng-src').replace('{lang}',l);});
    var t=document.querySelector('title[data-tpl]'); if(t){var m=document.querySelector('meta[name="titles"]'); if(m){try{var o=JSON.parse(m.content); if(o[l]) document.title=o[l];}catch(e){}}}
  }
  window.eduSetLang=apply;
  document.addEventListener('DOMContentLoaded',function(){
    apply(pick());
    document.querySelectorAll('.langs button').forEach(function(b){b.addEventListener('click',function(){apply(b.dataset.lang);});});
  });
})();
