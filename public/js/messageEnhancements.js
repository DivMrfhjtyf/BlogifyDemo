(function(){
  'use strict';

  const HOLD_MS=650;
  const MOVE_PX=12;
  const EDIT_MS=60*1000;
  let editingMessageId=null;
  let selectedMessage=null;
  let conversationId=null;

  const $=id=>document.getElementById(id);
  const sameId=(a,b)=>String(a||'')===String(b||'');
  const toast=message=>{
    const el=$('toast');
    if(!el)return;
    el.textContent=message;
    el.classList.add('show');
    clearTimeout(el.__blogifyToastTimer);
    el.__blogifyToastTimer=setTimeout(()=>el.classList.remove('show'),2400);
  };

  function styles(){
    if($('blogify-message-actions-style'))return;
    const s=document.createElement('style');
    s.id='blogify-message-actions-style';
    s.textContent=`
      .message-bubble.blogify-hold-active{animation:blogifyHoldPulse .18s ease-out;box-shadow:0 0 0 3px rgba(55,151,240,.24)!important}
      @keyframes blogifyHoldPulse{from{transform:scale(.985)}to{transform:scale(1)}}
      .message-bubble.blogify-media-tap{animation:blogifyMediaTap .22s ease-out}
      @keyframes blogifyMediaTap{0%{transform:scale(.985);filter:brightness(.92)}100%{transform:scale(1);filter:brightness(1)}}
      .blogify-media-viewer{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:22px}
      .blogify-media-viewer img,.blogify-media-viewer video{max-width:96vw;max-height:90vh;object-fit:contain;border-radius:14px;box-shadow:0 20px 70px rgba(0,0,0,.45)}
      .blogify-media-viewer button{position:absolute;top:14px;right:14px;width:42px;height:42px;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:24px;cursor:pointer}
    `;
    document.head.appendChild(s);
  }

  function findSocket(){
    try{
      const managers=window.io&&window.io.managers;
      if(!managers)return null;
      for(const key of Object.keys(managers)){
        const socket=managers[key]?.nsps?.['/'];
        if(socket&&socket.connected)return socket;
      }
    }catch(_){ }
    return null;
  }

  function emit(event,payload){
    const socket=findSocket();
    if(!socket){toast('Chat connection is unavailable');return false;}
    socket.emit(event,payload);
    return true;
  }

  function closeSheet(){
    $('overlay')?.classList.remove('open');
    $('actionSheet')?.classList.remove('open');
    selectedMessage=null;
    window.__BLOGIFY_SELECTED_MESSAGE=null;
  }

  function isMine(m){
    const row=m?._id?document.querySelector('.message-row[data-id="'+CSS.escape(String(m._id))+'"]'):null;
    if(row)return row.classList.contains('sent');
    return sameId(m?.senderId?._id||m?.senderId,window.__BLOGIFY_MY_ID||'');
  }

  function canEdit(m){
    return isMine(m)&&!m?.mediaType&&!m?.deleted&&Date.now()-new Date(m.createdAt).getTime()<EDIT_MS;
  }

  function showMedia(message){
    if(!message?.mediaUrl)return;
    document.querySelector('.blogify-media-viewer')?.remove();
    const viewer=document.createElement('div');
    viewer.className='blogify-media-viewer';
    const close=document.createElement('button');
    close.type='button';
    close.setAttribute('aria-label','Close media viewer');
    close.textContent='×';
    viewer.appendChild(close);
    const media=message.mediaType==='video'?document.createElement('video'):document.createElement('img');
    media.src=message.mediaUrl;
    media.alt=message.mediaType==='video'?'Video message':'Photo message';
    if(message.mediaType==='video'){media.controls=true;media.playsInline=true;media.autoplay=true;}
    viewer.appendChild(media);
    const done=()=>viewer.remove();
    close.addEventListener('click',done);
    viewer.addEventListener('click',e=>{if(e.target===viewer)done()});
    document.addEventListener('keydown',function esc(e){if(e.key==='Escape'){done();document.removeEventListener('keydown',esc)}});
    document.body.appendChild(viewer);
  }

  function messageType(m){return m?.mediaType||'text';}

  function downloadMedia(url,filename){
    if(!/^https:\/\//i.test(String(url||'')))return toast('Media URL is unavailable');
    const a=document.createElement('a');
    a.href=url;a.download=filename;a.rel='noopener';a.target='_blank';
    document.body.appendChild(a);a.click();a.remove();
    toast('Download started');
  }

  async function getMessageById(id){
    if(!id)throw Error('Message unavailable');
    let cid=conversationId||window.__BLOGIFY_CONVERSATION_ID;
    if(!cid){
      const user=new URLSearchParams(location.search).get('user');
      const c=await fetch('/messages/conversation',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({userId:user})});
      const cd=await c.json();
      if(!c.ok||!cd.success)throw Error(cd.message||'Unable to load conversation');
      cid=String(cd.conversationId);
    }
    conversationId=String(cid);
    window.__BLOGIFY_CONVERSATION_ID=conversationId;
    const r=await fetch('/messages/'+encodeURIComponent(conversationId)+'?limit=100',{credentials:'same-origin'});
    const d=await r.json();
    if(!r.ok||!d.success)throw Error(d.message||'Unable to load message');
    const m=(d.messages||[]).find(x=>sameId(x._id,id));
    if(!m)throw Error('Message is no longer available');
    return m;
  }

  function ensureButton(id,label,icon,beforeId){
    let b=$(id);
    if(b)return b;
    b=document.createElement('button');
    b.className='sheet-btn';
    b.id=id;
    b.type='button';
    b.innerHTML='<i class="'+icon+'" aria-hidden="true"></i><span>'+label+'</span>';
    const before=beforeId?$(beforeId):null;
    if(before?.parentNode)before.parentNode.insertBefore(b,before);else $('actionSheet')?.appendChild(b);
    return b;
  }

  function setupSheet(){
    const sheet=$('actionSheet');
    if(!sheet||sheet.dataset.blogifyEnhanced)return;
    sheet.dataset.blogifyEnhanced='1';

    const deleteForMe=ensureButton('deleteForMeAction','Delete for me','fas fa-trash-alt','unsendAction');
    const forward=ensureButton('forwardShareAction','Forward / Share','fas fa-share','replyAction');
    const save=ensureButton('saveAction','Save','fas fa-bookmark','forwardShareAction');
    const view=ensureButton('viewMediaAction','View photo','fas fa-image','replyAction');
    const playVideo=ensureButton('playVideoAction','Play video','fas fa-play','replyAction');
    const playAudio=ensureButton('playAudioAction','Play voice message','fas fa-play','replyAction');
    const download=ensureButton('downloadMediaAction','Download','fas fa-download','replyAction');
    const openProfile=ensureButton('openProfileAction','Open profile','fas fa-user','replyAction');
    const copyProfile=ensureButton('copyProfileAction','Copy profile link','fas fa-link','replyAction');
    const unsend=$('unsendAction');
    if(unsend)unsend.innerHTML='<i class="fas fa-trash" aria-hidden="true"></i><span>Unsend for everyone</span>';

    const bind=(id,fn)=>{
      const b=$(id);
      if(!b||b.dataset.blogifyBound)return;
      b.dataset.blogifyBound='1';
      b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fn()});
    };

    bind('deleteForMeAction',()=>{
      const m=selectedMessage;
      if(!m||!conversationId)return;
      if(!confirm('Delete this message for you?'))return;
      if(emit('message:deleteForMe',{conversationId,messageId:m._id}))closeSheet();
    });

    if(unsend&&!unsend.dataset.blogifyConfirmBound){
      unsend.dataset.blogifyConfirmBound='1';
      unsend.addEventListener('click',e=>{
        e.preventDefault();
        e.stopImmediatePropagation();
        const m=selectedMessage;
        if(!m||!conversationId)return;
        if(!confirm('Unsend this message for everyone?'))return;
        if(emit('message:unsend',{conversationId,messageId:m._id}))closeSheet();
      },true);
    }

    bind('forwardShareAction',async()=>{
      const m=selectedMessage;
      if(!m)return;
      const text=m.text||(
        m.mediaType==='audio'?'Voice message':
        m.mediaType==='video'?'Video message':
        m.mediaType==='image'?'Photo message':
        m.mediaType==='profile'?'Shared profile':'Message'
      );
      const shareData={title:'Blogify message',text};
      if(m.mediaUrl&&/^https:\/\//i.test(m.mediaUrl))shareData.url=m.mediaUrl;
      else if(m.mediaType==='profile'&&m.profileShareId?._id)shareData.url=location.origin+'/profile/'+encodeURIComponent(m.profileShareId._id);
      try{
        if(navigator.share){await navigator.share(shareData);toast('Share opened');}
        else if(navigator.clipboard){await navigator.clipboard.writeText([text,shareData.url].filter(Boolean).join('\n'));toast('Message copied for sharing');}
        else toast('Sharing is not supported on this browser');
      }catch(e){if(e?.name!=='AbortError')toast('Unable to share message');}
      closeSheet();
    });

    bind('saveAction',()=>{
      const m=selectedMessage;
      if(m&&conversationId&&emit('message:save',{conversationId,messageId:m._id}))closeSheet();
    });

    bind('viewMediaAction',()=>{showMedia(selectedMessage);closeSheet()});
    bind('playVideoAction',()=>{showMedia(selectedMessage);closeSheet()});
    bind('playAudioAction',()=>{
      const m=selectedMessage;
      const row=document.querySelector('.message-row[data-id="'+CSS.escape(String(m?._id||''))+'"]');
      const audio=row?.querySelector('audio');
      if(audio)audio.paused?audio.play().catch(()=>{}):audio.pause();
      closeSheet();
    });
    bind('downloadMediaAction',()=>{
      const m=selectedMessage;
      const type=messageType(m);
      const ext=type==='image'?'jpg':type==='video'?'mp4':'webm';
      downloadMedia(m?.mediaUrl,'blogify-'+type+'-'+String(m?._id||'message')+'.'+ext);
      closeSheet();
    });
    bind('openProfileAction',()=>{
      const m=selectedMessage;
      const id=typeof m?.profileShareId==='object'?m.profileShareId?._id:m?.profileShareId;
      if(id)location.href='/profile/'+encodeURIComponent(id);
    });
    bind('copyProfileAction',async()=>{
      const m=selectedMessage;
      const id=typeof m?.profileShareId==='object'?m.profileShareId?._id:m?.profileShareId;
      if(!id)return toast('Profile unavailable');
      try{await navigator.clipboard.writeText(location.origin+'/profile/'+id);toast('Profile link copied')}catch(_){toast('Unable to copy profile link')}
      closeSheet();
    });

    const edit=$('editAction');
    if(edit&&!edit.dataset.blogifyEnhancedEdit){
      edit.dataset.blogifyEnhancedEdit='1';
      edit.addEventListener('click',e=>{
        const m=selectedMessage;
        e.preventDefault();
        e.stopImmediatePropagation();
        if(!canEdit(m))return toast('Edit is available for only 1 minute.');
        editingMessageId=String(m._id);
        $('messageInput').value=m.text||'';
        $('messageInput').focus();
        closeSheet();
        toast('Editing message — send to save changes');
      },true);
    }
  }

  function configure(m){
    selectedMessage=m;
    window.__BLOGIFY_SELECTED_MESSAGE=m;
    const mine=isMine(m);
    const deleteForMe=$('deleteForMeAction');
    const unsend=$('unsendAction');
    const edit=$('editAction');
    const reply=$('replyAction');
    const copy=$('copyAction');
    const forward=$('forwardShareAction');
    const save=$('saveAction');
    const view=$('viewMediaAction');
    const playVideo=$('playVideoAction');
    const playAudio=$('playAudioAction');
    const download=$('downloadMediaAction');
    const openProfile=$('openProfileAction');
    const copyProfile=$('copyProfileAction');
    if(deleteForMe)deleteForMe.style.display=m?.deleted?'none':'flex';
    if(unsend)unsend.style.display=mine&&!m?.deleted?'flex':'none';
    if(edit)edit.style.display=canEdit(m)?'flex':'none';
    if(reply)reply.style.display=m?.deleted?'none':'flex';
    if(copy)copy.style.display=m?.text?'flex':'none';
    if(forward)forward.style.display=m?.deleted?'none':'flex';
    if(save)save.style.display=m?.deleted?'none':'flex';
    if(view)view.style.display=m?.mediaType==='image'?'flex':'none';
    if(playVideo)playVideo.style.display=m?.mediaType==='video'?'flex':'none';
    if(playAudio)playAudio.style.display=m?.mediaType==='audio'?'flex':'none';
    if(download)download.style.display=['image','video','audio'].includes(m?.mediaType)?'flex':'none';
    if(openProfile)openProfile.style.display=m?.mediaType==='profile'?'flex':'none';
    if(copyProfile)copyProfile.style.display=m?.mediaType==='profile'?'flex':'none';
  }

  function openUnified(b){
    const id=b.dataset.messageId;
    getMessageById(id).then(m=>{
      configure(m);
      b.dataset.blogifyForceOpen='1';
      b.click();
      setTimeout(()=>configure(m),0);
    }).catch(e=>toast(e.message));
  }

  function installEditSubmit(){
    const form=$('composer'),input=$('messageInput');
    if(!form||form.dataset.blogifyEditSubmit)return;
    form.dataset.blogifyEditSubmit='1';
    form.addEventListener('submit',e=>{
      if(!editingMessageId)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const text=input.value.trim();
      if(!text)return toast('Enter a message');
      if(!conversationId)return toast('Chat connection is unavailable');
      if(emit('message:edit',{conversationId,messageId:editingMessageId,text})){
        editingMessageId=null;
        input.value='';
        input.dispatchEvent(new Event('input',{bubbles:true}));
        toast('Message updated');
      }
    },true);
  }

  function attachInteractions(){
    const area=$('messagesArea');
    if(!area)return;
    area.querySelectorAll('.message-bubble[data-message-id]').forEach(b=>{
      if(b.dataset.blogifyInteraction)return;
      b.dataset.blogifyInteraction='1';
      let timer=null,x=0,y=0,longPressed=false;
      const cancel=()=>{if(timer)clearTimeout(timer);timer=null};
      b.addEventListener('contextmenu',e=>e.preventDefault(),true);
      b.addEventListener('pointerdown',e=>{
        if(e.pointerType==='mouse'&&e.button!==0)return;
        x=e.clientX;y=e.clientY;longPressed=false;cancel();
        timer=setTimeout(()=>{
          timer=null;longPressed=true;
          b.classList.add('blogify-hold-active');
          navigator.vibrate?.(12);
          openUnified(b);
          setTimeout(()=>b.classList.remove('blogify-hold-active'),260);
        },HOLD_MS);
      },{passive:true});
      b.addEventListener('pointermove',e=>{if(Math.hypot(e.clientX-x,e.clientY-y)>MOVE_PX)cancel()},{passive:true});
      ['pointerup','pointercancel','pointerleave'].forEach(t=>b.addEventListener(t,cancel,{passive:true}));
      b.addEventListener('click',e=>{
        if(b.dataset.blogifyForceOpen==='1'){b.dataset.blogifyForceOpen='';return;}
        if(e.target.closest('audio,video')){cancel();e.stopImmediatePropagation();return;}
        const img=e.target.closest('img.message-media');
        if(img){
          if(longPressed){longPressed=false;e.preventDefault();e.stopImmediatePropagation();return;}
          e.stopImmediatePropagation();
          getMessageById(b.dataset.messageId).then(m=>{configure(m);showMedia(m)}).catch(err=>toast(err.message));
          return;
        }
        if(longPressed){e.preventDefault();e.stopImmediatePropagation();longPressed=false;return;}
        getMessageById(b.dataset.messageId).then(m=>configure(m)).catch(()=>{});
      },true);
    });
  }

  function removeMessageRow(messageId){
    const id=String(messageId||'');
    if(!id)return;
    document.querySelectorAll('.message-row[data-id]').forEach(row=>{
      if(String(row.dataset.id)===id)row.remove();
    });
    if(selectedMessage&&sameId(selectedMessage._id,id))closeSheet();
  }

  function applyEditedMessage(m){
    if(!m?._id)return;
    const row=document.querySelector('.message-row[data-id="'+CSS.escape(String(m._id))+'"]');
    if(!row)return;
    const bubble=row.querySelector('.message-bubble');
    if(!bubble)return;
    bubble.classList.remove('deleted');
    bubble.innerHTML='';
    bubble.textContent=m.text||'';
    const meta=row.querySelector('.message-meta');
    if(meta){
      let edited=meta.querySelector('.edited');
      if(!edited){edited=document.createElement('span');edited.className='edited';meta.insertBefore(edited,meta.querySelector('.read-status')||null)}
      edited.textContent='· edited';
    }
  }

  function installRealtime(){
    const managers=window.io?.managers;
    if(!managers||window.__BLOGIFY_MESSAGE_ACTION_EVENTS)return;
    window.__BLOGIFY_MESSAGE_ACTION_EVENTS=true;
    for(const key of Object.keys(managers)){
      const s=managers[key]?.nsps?.['/'];
      if(!s)continue;
      s.on('message:deletedForMe',d=>removeMessageRow(d?.messageId));
      s.on('message:unsent',d=>removeMessageRow(d?.messageId));
      s.on('message:edited',m=>applyEditedMessage(m));
      s.on('message:action:error',d=>toast(d?.message||'Action failed'));
    }
  }

  function exposeConversation(){
    if(window.__BLOGIFY_FETCH_WRAPPED)return;
    window.__BLOGIFY_FETCH_WRAPPED=true;
    const original=window.fetch;
    window.fetch=function(input,init){
      return original.apply(this,arguments).then(response=>{
        try{
          const url=typeof input==='string'?input:input?.url||'';
          if(url.includes('/messages/conversation')&&response.ok){
            response.clone().json().then(d=>{
              if(d?.conversationId){conversationId=String(d.conversationId);window.__BLOGIFY_CONVERSATION_ID=conversationId;}
            }).catch(()=>{});
          }
        }catch(_){ }
        return response;
      });
    };
  }

  function boot(){
    styles();
    setupSheet();
    installEditSubmit();
    exposeConversation();
    attachInteractions();
    installRealtime();
    const area=$('messagesArea');
    if(area&&!area.__blogifyObserver){
      area.__blogifyObserver=true;
      new MutationObserver(()=>{setupSheet();attachInteractions()}).observe(area,{childList:true,subtree:true});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
