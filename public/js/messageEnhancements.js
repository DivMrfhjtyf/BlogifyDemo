(function () {
  'use strict';
  const HOLD_MS=650, MOVE_PX=12, $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let timer=null, running=false;

  function installStyles(){
    if($('blogify-message-ui-style')) return;
    const s=document.createElement('style'); s.id='blogify-message-ui-style';
    s.textContent=`
      .blogify-reply-quote{display:block;width:100%;margin:-2px -2px 8px;padding:7px 9px;border-left:3px solid #3797f0;border-radius:8px;background:rgba(55,151,240,.10);text-align:left;cursor:pointer;overflow:hidden}
      .sent .blogify-reply-quote{border-left-color:rgba(255,255,255,.9);background:rgba(0,0,0,.12)}
      .blogify-reply-quote .rq-title{font-size:10px;line-height:1.25;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .blogify-reply-quote .rq-text{margin-top:2px;font-size:11px;line-height:1.3;opacity:.82;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .blogify-reply-highlight{animation:blogifyReplyHighlight .9s ease-out!important}
      .blogify-hold-active{animation:blogifyHoldPulse .18s ease-out;box-shadow:0 0 0 3px rgba(55,151,240,.24)!important}
      @keyframes blogifyHoldPulse{from{transform:scale(.985)}to{transform:scale(1)}}
      @keyframes blogifyReplyHighlight{0%,100%{box-shadow:0 0 0 0 rgba(55,151,240,0)}40%{box-shadow:0 0 0 6px rgba(55,151,240,.35)}}`;
    document.head.appendChild(s);
  }

  function cid(){return window.__BLOGIFY_CONVERSATION_ID||null;}
  async function getMessages(){
    const id=cid(); if(!id) return [];
    try{const r=await fetch('/messages/'+encodeURIComponent(id)+'?limit=100',{credentials:'same-origin'});const d=await r.json().catch(()=>({}));return r.ok&&d.success&&Array.isArray(d.messages)?d.messages:[];}catch(_){return[];}
  }
  function text(m){if(!m)return'Message';if(m.deleted)return'This message was deleted';if(m.text)return m.text;return({image:'Photo',video:'Video',audio:'Voice message',profile:'Shared profile'})[m.mediaType]||'Message';}
  function row(id){for(const r of document.querySelectorAll('.message-row[data-id]'))if(String(r.dataset.id)===String(id))return r;return null;}
  function decorate(r,m,map){
    const b=r?.querySelector('.message-bubble');if(!b)return;b.querySelector('.blogify-reply-quote')?.remove();if(!m.replyTo)return;
    const q=typeof m.replyTo==='object'?m.replyTo:map.get(String(m.replyTo));const t=text(q||{text:'Message'});const oid=q?._id||m.replyTo;
    const el=document.createElement('div');el.className='blogify-reply-quote';el.setAttribute('role','button');el.tabIndex=0;
    el.innerHTML='<div class="rq-title">Replying &quot;'+esc(t)+'&quot;</div><div class="rq-text">'+esc(t)+'</div>';
    const jump=e=>{e.preventDefault();e.stopPropagation();const o=row(oid);if(!o)return;o.scrollIntoView({behavior:'smooth',block:'center'});const ob=o.querySelector('.message-bubble');ob?.classList.add('blogify-reply-highlight');setTimeout(()=>ob?.classList.remove('blogify-reply-highlight'),900);};
    el.addEventListener('click',jump);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')jump(e);});b.prepend(el);
  }
  async function hydrate(){
    if(running||!$('messagesArea')||!cid())return;running=true;
    try{const ms=await getMessages();const map=new Map(ms.map(m=>[String(m._id),m]));window.__BLOGIFY_MESSAGE_CACHE=map;ms.forEach(m=>{const r=row(m._id);if(r)decorate(r,m,map);});bindLongPress();}finally{running=false;}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(hydrate,180);}
  function openPopup(b){
    /* IMPORTANT: message.ejs owns the authenticated socket and popup actions. */
    b.dataset.blogifyLongPressOpen='1';b.click();setTimeout(()=>delete b.dataset.blogifyLongPressOpen,500);
  }
  function bindLongPress(){
    const a=$('messagesArea');if(!a)return;
    a.querySelectorAll('.message-bubble[data-message-id]').forEach(b=>{
      if(b.dataset.blogifyLongPressBound==='1')return;b.dataset.blogifyLongPressBound='1';
      let hold=null,sx=0,sy=0,triggered=false;
      b.addEventListener('contextmenu',e=>{e.preventDefault();if(!triggered)openPopup(b);},true);
      b.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;sx=e.clientX;sy=e.clientY;triggered=false;clearTimeout(hold);hold=setTimeout(()=>{hold=null;triggered=true;b.classList.add('blogify-hold-active');navigator.vibrate?.(12);openPopup(b);setTimeout(()=>b.classList.remove('blogify-hold-active'),250);},HOLD_MS);},true);
      b.addEventListener('pointermove',e=>{if(Math.hypot(e.clientX-sx,e.clientY-sy)>MOVE_PX){clearTimeout(hold);hold=null;}},true);
      b.addEventListener('pointerup',()=>{clearTimeout(hold);hold=null;},true);b.addEventListener('pointercancel',()=>{clearTimeout(hold);hold=null;},true);
    });
  }
  function start(){
    installStyles();bindLongPress();const a=$('messagesArea');
    if(a&&!a.dataset.blogifyEnhancementObserver){a.dataset.blogifyEnhancementObserver='1';new MutationObserver(schedule).observe(a,{childList:true,subtree:true});}
    schedule();setTimeout(hydrate,700);setTimeout(hydrate,1800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
