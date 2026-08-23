(() => {
  'use strict';
  if (!location.pathname.startsWith('/messages')) return;

  const MAX_IMAGE = 10 * 1024 * 1024;
  const MAX_VIDEO = 50 * 1024 * 1024;
  const ALLOWED = new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']);
  const HOLD_MS = 650;
  const EDIT_MS = 60 * 1000;
  const $ = (s, root=document) => root.querySelector(s);
  let selected = null, timer = null, start = null, menu = null;

  const toast = msg => {
    if (typeof window.toast === 'function') return window.toast(msg);
    if (window.notify?.info) return window.notify.info(msg);
    console.info('[Blogify Messages]', msg);
  };
  const sameId = (a,b) => String(a || '') === String(b || '');
  const kind = m => m?.mediaType || 'text';
  const mine = m => {
    const row = m?._id ? document.querySelector('.message-row[data-id="'+CSS.escape(String(m._id))+'"]') : null;
    if (row) return row.classList.contains('sent') || row.classList.contains('mine');
    return sameId(m?.senderId?._id || m?.senderId, window.__BLOGIFY_MY_ID || '');
  };
  const canEdit = m => mine(m) && !m?.mediaType && !m?.deleted && Date.now() - new Date(m.createdAt).getTime() < EDIT_MS;

  function socket(){
    try {
      const managers = window.io?.managers;
      if (!managers) return null;
      for (const key of Object.keys(managers)) {
        const s = managers[key]?.nsps?.['/'];
        if (s?.connected) return s;
      }
    } catch (_) {}
    return null;
  }
  function emit(event,payload){ const s=socket(); if(!s){toast('Chat connection is unavailable');return false;} s.emit(event,payload); return true; }

  function styles(){
    if($('#blogify-message-ux-style'))return;
    const s=document.createElement('style');s.id='blogify-message-ux-style';
    s.textContent=`
      #overlay,#actionSheet{display:none!important}
      .blogify-message-menu-backdrop{position:fixed;inset:0;z-index:2147482000;background:rgba(0,0,0,.18);backdrop-filter:blur(2px);opacity:0;pointer-events:none;transition:opacity .18s ease}.blogify-message-menu-backdrop.open{opacity:1;pointer-events:auto}
      .blogify-message-menu{position:fixed;z-index:2147482001;left:50%;bottom:calc(12px + env(safe-area-inset-bottom,0px));width:min(390px,calc(100vw - 24px));max-height:78vh;overflow:auto;transform:translate(-50%,18px) scale(.98);opacity:0;pointer-events:none;background:var(--surface,#fff);color:var(--text,#111);border:1px solid var(--line,#ddd);border-radius:22px;box-shadow:0 24px 80px rgba(0,0,0,.28);padding:8px;transition:transform .2s cubic-bezier(.2,.8,.2,1),opacity .16s ease}.blogify-message-menu.open{transform:translate(-50%,0) scale(1);opacity:1;pointer-events:auto}
      .blogify-message-menu .grip{width:38px;height:4px;border-radius:99px;background:var(--line,#ddd);margin:3px auto 8px}.blogify-message-menu .preview{display:flex;align-items:center;gap:10px;padding:8px 10px 12px;border-bottom:1px solid var(--line,#ddd);margin-bottom:5px}.blogify-message-menu .preview-copy{min-width:0;flex:1}.blogify-message-menu .preview-title{font-size:11px;font-weight:800;color:var(--muted,#737373);margin-bottom:2px}.blogify-message-menu .preview-body{font-size:13px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.blogify-message-menu .preview-media{width:48px;height:48px;border-radius:10px;object-fit:cover;background:#111;flex:none}
      .blogify-message-menu .action{width:100%;min-height:46px;border:0;border-radius:13px;background:transparent;color:inherit;display:flex;align-items:center;gap:12px;padding:0 12px;text-align:left;font-size:13px;font-weight:650;cursor:pointer;transition:background .14s ease,transform .14s ease}.blogify-message-menu .action:hover{background:var(--input,#f2f2f4)}.blogify-message-menu .action:active{transform:scale(.985)}.blogify-message-menu .action i{width:20px;text-align:center;color:var(--primary,#6366f1)}.blogify-message-menu .action.danger,.blogify-message-menu .action.danger i{color:#ed4956}.blogify-message-menu .sub{margin-left:auto;font-size:10px;color:var(--muted,#737373);font-weight:500}.blogify-message-menu .sep{height:1px;background:var(--line,#ddd);margin:5px 4px}
      .blogify-media-lightbox{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.92);display:none;place-items:center;padding:12px;backdrop-filter:blur(12px)}.blogify-media-lightbox.open{display:grid}.blogify-media-lightbox .stage{max-width:96vw;max-height:92vh;display:grid;place-items:center}.blogify-media-lightbox img,.blogify-media-lightbox video{display:block;max-width:96vw;max-height:88vh;border-radius:16px;object-fit:contain;background:#000;box-shadow:0 20px 70px rgba(0,0,0,.45)}.blogify-media-lightbox button,.blogify-media-lightbox a{position:fixed;top:14px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;display:grid;place-items:center;text-decoration:none;cursor:pointer}.blogify-media-lightbox .close{right:14px;font-size:24px}.blogify-media-lightbox .download{right:66px;font-size:20px}
      .blogify-upload-menu{position:absolute;left:8px;bottom:calc(100% + 8px);width:210px;padding:8px;background:var(--surface,#fff);border:1px solid var(--line,#ddd);border-radius:16px;box-shadow:0 15px 45px rgba(0,0,0,.2);display:none;z-index:200}.blogify-upload-menu.open{display:block}.blogify-upload-menu button{width:100%;min-height:44px;border:0;border-radius:10px;background:transparent;color:var(--text,#111);display:flex;align-items:center;gap:10px;padding:0 12px;text-align:left;cursor:pointer}.blogify-upload-menu button:hover{background:var(--input,#f2f2f4)}.blogify-drop-active{outline:2px dashed #3797f0;outline-offset:-5px;background:rgba(55,151,240,.05)!important}.blogify-media-hint{font-size:10px;color:var(--muted,#737373);padding:0 10px 5px}
      @media(min-width:700px){.blogify-message-menu{left:auto;right:20px;transform:translateY(18px) scale(.98);width:340px}.blogify-message-menu.open{transform:translateY(0) scale(1)}}
      @media(prefers-reduced-motion:reduce){.blogify-message-menu,.blogify-message-menu-backdrop{transition:none!important}}
    `;document.head.appendChild(s);
  }

  function createMenu(){
    if(menu)return menu;
    const back=document.createElement('div');back.className='blogify-message-menu-backdrop';
    const sheet=document.createElement('div');sheet.className='blogify-message-menu';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-label','Message actions');sheet.innerHTML='<div class="grip"></div><div class="preview"></div><div class="actions"></div>';
    document.body.append(back,sheet);back.addEventListener('click',closeMenu);sheet.addEventListener('click',e=>e.stopPropagation());
    menu={back,sheet,preview:$('.preview',sheet),actions:$('.actions',sheet)};return menu;
  }
  function closeMenu(){if(!menu)return;menu.back.classList.remove('open');menu.sheet.classList.remove('open');selected=null}
  function addAction(label,icon,fn,opt={}){const b=document.createElement('button');b.type='button';b.className='action'+(opt.danger?' danger':'');b.innerHTML='<i class="'+icon+'" aria-hidden="true"></i><span>'+label+'</span>'+(opt.sub?'<span class="sub">'+opt.sub+'</span>':'');b.onclick=async e=>{e.preventDefault();e.stopPropagation();try{await fn()}catch(err){toast(err?.message||'Action failed')}};menu.actions.appendChild(b)}
  function preview(m){const text=m?.deleted?'This message was deleted':(m?.text||({image:'Photo',video:'Video',audio:'Voice message',profile:'Shared profile'}[kind(m)]||'Message'));const media=['image','video'].includes(kind(m))&&m?.mediaUrl?'<img class="preview-media" src="'+String(m.mediaUrl).replace(/"/g,'&quot;')+'" alt="">':'';menu.preview.innerHTML=media+'<div class="preview-copy"><div class="preview-title">'+(mine(m)?'Your message':'Message')+'</div><div class="preview-body">'+String(text).replace(/[<>]/g,'')+'</div></div>'}

  async function loadMessage(id){
    let cid=window.__BLOGIFY_CONVERSATION_ID;
    if(!cid){const user=new URLSearchParams(location.search).get('user');const r=await fetch('/messages/conversation',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({userId:user})});const d=await r.json();if(!r.ok||!d.success)throw Error(d.message||'Unable to load conversation');cid=d.conversationId;window.__BLOGIFY_CONVERSATION_ID=cid}
    const r=await fetch('/messages/'+encodeURIComponent(cid)+'?limit=100',{credentials:'same-origin'});const d=await r.json();if(!r.ok||!d.success)throw Error(d.message||'Unable to load message');const m=(d.messages||[]).find(x=>sameId(x._id,id));if(!m)throw Error('Message is no longer available');return m;
  }

  function openMedia(m){if(!m?.mediaUrl)return toast('Media is unavailable');document.querySelector('.blogify-media-lightbox')?.remove();const o=document.createElement('div');o.className='blogify-media-lightbox open';const stage=document.createElement('div');stage.className='stage';const close=document.createElement('button');close.className='close';close.type='button';close.textContent='×';const dl=document.createElement('a');dl.className='download';dl.href=m.mediaUrl;dl.download='blogify-'+kind(m);dl.target='_blank';dl.rel='noopener';dl.textContent='↓';const media=kind(m)==='video'?document.createElement('video'):document.createElement('img');media.src=m.mediaUrl;media.alt=kind(m)==='video'?'Video message':'Photo message';if(media.tagName==='VIDEO'){media.controls=true;media.playsInline=true;media.autoplay=true}stage.appendChild(media);o.append(stage,close,dl);document.body.appendChild(o);document.body.style.overflow='hidden';const hide=()=>{o.remove();document.body.style.overflow=''};close.onclick=hide;o.onclick=e=>{if(e.target===o)hide()}}
  function downloadMedia(m){if(!/^https:\/\//i.test(String(m?.mediaUrl||'')))return toast('Media URL is unavailable');const a=document.createElement('a');a.href=m.mediaUrl;a.download='blogify-'+kind(m);a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();toast('Download started')}

  async function bridge(id){const row=document.querySelector('.message-bubble[data-message-id="'+CSS.escape(String(selected?._id||''))+'"]');if(!row)return toast('Message is unavailable');row.dataset.blogifyForceOpen='1';row.click();await new Promise(r=>setTimeout(r,60));const button=$(id);if(button)button.click();else toast('Action is unavailable');setTimeout(()=>{$('#overlay')?.classList.remove('open');$('#actionSheet')?.classList.remove('open')},100)}

  function build(m){
    createMenu();selected=m;menu.actions.replaceChildren();preview(m);const k=kind(m);
    if(m?.deleted){addAction('Close','fas fa-xmark',closeMenu);menu.back.classList.add('open');menu.sheet.classList.add('open');return}
    addAction('Reply','fas fa-reply',()=>bridge('replyAction'));
    if(k==='image')addAction('View photo','fas fa-image',()=>{openMedia(m);closeMenu()});
    if(k==='video')addAction('Play video','fas fa-play',()=>{openMedia(m);closeMenu()});
    if(k==='audio')addAction('Play voice message','fas fa-play',()=>{const row=document.querySelector('.message-row[data-id="'+CSS.escape(String(m._id))+'"]');const a=row?.querySelector('audio');if(a){a.paused?a.play().catch(()=>{}):a.pause();closeMenu()}else toast('Voice player unavailable')});
    if(k==='profile')addAction('Open profile','fas fa-user',()=>{const id=typeof m.profileShareId==='object'?m.profileShareId?._id:m.profileShareId;if(id)location.href='/profile/'+encodeURIComponent(id)});
    if(m?.text)addAction('Copy','fas fa-copy',()=>bridge('copyAction'));
    addAction('Forward / Share','fas fa-share-nodes',()=>bridge('forwardShareAction'));
    addAction('Save','fas fa-bookmark',()=>bridge('saveAction'));
    if(['image','video','audio'].includes(k))addAction('Download','fas fa-download',()=>{downloadMedia(m);closeMenu()});
    if(mine(m)){
      if(canEdit(m))addAction('Edit','fas fa-pen',()=>bridge('editAction'),{sub:'60s'});
      menu.actions.insertAdjacentHTML('beforeend','<div class="sep"></div>');
      addAction('Delete for me','fas fa-trash-can',()=>bridge('deleteForMeAction'),{danger:true});
      addAction('Unsend for everyone','fas fa-trash',async()=>{if(!confirm('Unsend this message for everyone?'))return;if(emit('message:unsend',{conversationId:window.__BLOGIFY_CONVERSATION_ID,messageId:m._id}))closeMenu()},{danger:true});
    }else{
      menu.actions.insertAdjacentHTML('beforeend','<div class="sep"></div>');
      addAction('Report message','fas fa-flag',()=>{toast('Report flow is not enabled yet');closeMenu()},{danger:true});
    }
    menu.back.classList.add('open');menu.sheet.classList.add('open');
  }

  function open(b){clearTimeout(timer);loadMessage(b.dataset.messageId).then(build).catch(e=>toast(e.message))}
  function setupUnifiedMenu(){
    const area=$('#messagesArea,.messages-area');if(!area||area.dataset.blogifyUnifiedMenu==='1')return;area.dataset.blogifyUnifiedMenu='1';createMenu();
    area.addEventListener('pointerdown',e=>{const b=e.target.closest('.message-bubble[data-message-id]');if(!b)return;start={x:e.clientX,y:e.clientY,b};clearTimeout(timer);timer=setTimeout(()=>{timer=null;navigator.vibrate?.(10);open(b)},HOLD_MS);e.stopPropagation()},true);
    area.addEventListener('pointermove',e=>{if(!start)return;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>12){clearTimeout(timer);timer=null;start=null}e.stopPropagation()},true);
    area.addEventListener('pointerup',e=>{const b=start?.b;clearTimeout(timer);timer=null;start=null;if(b&&e.pointerType==='mouse')open(b);e.stopPropagation()},true);
    area.addEventListener('pointercancel',()=>{clearTimeout(timer);timer=null;start=null},true);
    area.addEventListener('click',e=>{const b=e.target.closest('.message-bubble[data-message-id]');if(!b)return;e.preventDefault();e.stopPropagation();open(b)},true);
    area.addEventListener('contextmenu',e=>{if(e.target.closest('.message-bubble[data-message-id]'))e.preventDefault()},true);
  }

  function setupLightbox(){const area=$('.messages-area');if(!area||area.dataset.blogifyLightbox==='1')return;area.dataset.blogifyLightbox='1';const o=document.createElement('div');o.className='blogify-media-lightbox';o.innerHTML='<div class="stage"></div><button class="close" type="button">×</button><a class="download" target="_blank" rel="noopener">↓</a>';document.body.appendChild(o);const stage=$('.stage',o),close=$('.close',o),dl=$('.download',o),hide=()=>{o.classList.remove('open');stage.replaceChildren();document.body.style.overflow=''};close.onclick=hide;o.onclick=e=>{if(e.target===o)hide()};area.addEventListener('click',e=>{const media=e.target.closest('.message-media');if(!media||e.target.closest('.message-bubble[data-message-id]'))return;const src=media.currentSrc||media.src;if(!src)return;const m=media.tagName==='VIDEO'?document.createElement('video'):document.createElement('img');m.src=src;if(m.tagName==='VIDEO'){m.controls=true;m.playsInline=true}stage.appendChild(m);dl.href=src;dl.download='blogify-media';o.classList.add('open');document.body.style.overflow='hidden'})}

  function validateFile(file){if(!file)return false;if(!ALLOWED.has(file.type)){toast('Unsupported media type. Use JPG, PNG, WebP, GIF, MP4 or WebM.');return false}const limit=file.type.startsWith('video/')?MAX_VIDEO:MAX_IMAGE;if(file.size>limit){toast(`File is too large. Maximum is ${file.type.startsWith('video/')?'50 MB':'10 MB'}.`);return false}return true}
  function setupUploadUX(){const composer=$('.composer'),input=$('#input'),attachment=$('#attachmentButton');if(!composer||!input||!attachment||composer.dataset.blogifyUploadUX==='1')return;composer.dataset.blogifyUploadUX='1';const wrap=attachment.parentElement;if(getComputedStyle(wrap).position==='static')wrap.style.position='relative';const menu=document.createElement('div');menu.className='blogify-upload-menu';menu.innerHTML='<div class="blogify-media-hint">Share something</div><button type="button" data-kind="image"><i class="fas fa-image"></i> Photo</button><button type="button" data-kind="video"><i class="fas fa-video"></i> Video</button>';wrap.appendChild(menu);const fileInput=document.querySelector('input[type="file"]');attachment.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();menu.classList.toggle('open')},true);menu.addEventListener('click',e=>{const b=e.target.closest('button[data-kind]');if(!b||!fileInput)return;menu.classList.remove('open');fileInput.accept=b.dataset.kind==='video'?'video/mp4,video/webm,video/quicktime':'image/jpeg,image/png,image/webp,image/gif';fileInput.click()});document.addEventListener('click',e=>{if(!wrap.contains(e.target))menu.classList.remove('open')});fileInput?.addEventListener('change',()=>{const f=fileInput.files?.[0];if(f&&!validateFile(f))try{fileInput.value=''}catch(_){}})}

  function setup(){styles();setupUnifiedMenu();setupLightbox();setupUploadUX()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
  new MutationObserver(setup).observe(document.body,{childList:true,subtree:true});
})();