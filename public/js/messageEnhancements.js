(function(){
'use strict';

const HOLD_MS=650;
const EDIT_MS=60000;
let conversationId=window.__BLOGIFY_CONVERSATION_ID||null;
let selectedMessage=null;
let editingMessageId=null;

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

/*
 * IMPORTANT:
 * Do not depend only on window.io.managers. Some Socket.IO client
 * versions/builds do not expose the connected namespace there.
 * Prefer the application's existing socket, then inspect managers,
 * and finally create/reuse the default Socket.IO connection.
 */
function findSocket(){
  try{
    const candidates=[
      window.__BLOGIFY_SOCKET,
      window.blogifySocket,
      window.chatSocket,
      window.messageSocket,
      window.socket
    ];
    for(const s of candidates){
      if(s&&typeof s.emit==='function'){
        if(s.connected)return s;
        try{s.connect?.();}catch(_){ }
        if(s.connected)return s;
      }
    }

    const managers=window.io?.managers||{};
    for(const key of Object.keys(managers)){
      const manager=managers[key];
      const namespaces=manager?.nsps||{};
      const s=namespaces['/'];
      if(s&&typeof s.emit==='function'){
        if(!s.connected){try{s.connect?.();}catch(_){}}
        if(s.connected)return s;
      }
    }

    if(typeof window.io==='function'){
      const s=window.io();
      if(s&&typeof s.emit==='function'){
        window.__BLOGIFY_SOCKET=s;
        if(!s.connected){try{s.connect();}catch(_){} }
        return s;
      }
    }
  }catch(_){ }
  return null;
}

function emit(event,payload){
  const socket=findSocket();
  if(!socket){toast('Chat connection is unavailable');return false;}
  try{
    socket.emit(event,payload);
    return true;
  }catch(_){
    toast('Chat connection is unavailable');
    return false;
  }
}

async function ensureConversation(){
  if(conversationId)return conversationId;
  const user=new URLSearchParams(location.search).get('user');
  if(!user)return null;
  const r=await fetch('/messages/conversation',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'same-origin',
    body:JSON.stringify({userId:user})
  });
  const d=await r.json();
  if(!r.ok||!d.success)throw Error(d.message||'Unable to open conversation');
  conversationId=String(d.conversationId);
  window.__BLOGIFY_CONVERSATION_ID=conversationId;
  return conversationId;
}

async function getMessage(id){
  await ensureConversation();
  if(!conversationId)throw Error('Conversation unavailable');
  const r=await fetch('/messages/'+encodeURIComponent(conversationId)+'?limit=100',{credentials:'same-origin'});
  const d=await r.json();
  if(!r.ok||!d.success)throw Error(d.message||'Unable to load message');
  return (d.messages||[]).find(m=>sameId(m._id,id))||null;
}

function isMine(m){
  const row=m?._id?document.querySelector('.message-row[data-id="'+CSS.escape(String(m._id))+'"]'):null;
  if(row)return row.classList.contains('sent');
  return sameId(m?.senderId?._id||m?.senderId,window.__BLOGIFY_MY_ID);
}

function canEdit(m){
  return isMine(m)&&!m?.mediaType&&!m?.deleted&&Date.now()-new Date(m.createdAt).getTime()<EDIT_MS;
}

function replyText(r){
  if(!r)return 'Message';
  if(r.deleted)return 'This message was deleted';
  if(r.text)return r.text;
  return ({image:'Photo',video:'Video',audio:'Voice message',profile:'Shared profile'})[r.mediaType]||'Message';
}

function decorateReply(b,m){
  if(!b||!m)return;
  b.querySelector('.blogify-reply-quote')?.remove();
  const r=typeof m.replyTo==='object'?m.replyTo:null;
  if(!r)return;
  const q=document.createElement('div');
  q.className='blogify-reply-quote';
  q.innerHTML='<div class="rq-title">Replying to '+
    (sameId(r.senderId?._id||r.senderId,window.__BLOGIFY_MY_ID)?'your message':'message')+
    '</div><div class="rq-text">'+
    String(replyText(r)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+
    '</div>';
  q.addEventListener('click',e=>{
    e.stopPropagation();
    const target=document.querySelector('.message-row[data-id="'+CSS.escape(String(r._id||''))+'"]');
    if(!target)return;
    target.scrollIntoView({behavior:'smooth',block:'center'});
    const bubble=target.querySelector('.message-bubble');
    bubble?.classList.add('blogify-reply-highlight');
    setTimeout(()=>bubble?.classList.remove('blogify-reply-highlight'),700);
  });
  b.prepend(q);
}

function installStyles(){
  if($('blogify-live-actions-style'))return;
  const s=document.createElement('style');
  s.id='blogify-live-actions-style';
  s.textContent=`
    .message-bubble.blogify-hold-active{animation:blogifyHoldPulse .18s ease-out;box-shadow:0 0 0 3px rgba(55,151,240,.24)!important}
    .blogify-reply-quote{display:block;margin:-3px -3px 7px;padding:6px 8px;border-left:3px solid rgba(255,255,255,.8);border-radius:7px;background:rgba(0,0,0,.08);text-align:left;cursor:pointer;max-width:100%;overflow:hidden}
    .received .blogify-reply-quote{border-left-color:#3797f0;background:rgba(55,151,240,.08)}
    .blogify-reply-quote .rq-title{font-size:9px;font-weight:800;opacity:.8;margin-bottom:2px}
    .blogify-reply-quote .rq-text{font-size:10px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .blogify-reply-highlight{animation:blogifyReplyHighlight .7s ease-out!important}
    @keyframes blogifyHoldPulse{from{transform:scale(.985)}to{transform:scale(1)}}
    @keyframes blogifyReplyHighlight{0%,100%{box-shadow:0 0 0 0 rgba(55,151,240,0)}40%{box-shadow:0 0 0 5px rgba(55,151,240,.35)}}
  `;
  document.head.appendChild(s);
}

function configureSelected(m){
  selectedMessage=m;
  window.__BLOGIFY_SELECTED_MESSAGE=m;
  const mine=isMine(m);
  const set=(id,show)=>{const e=$(id);if(e)e.style.display=show?'flex':'none'};
  set('deleteForMeAction',!m?.deleted);
  set('unsendAction',mine&&!m?.deleted);
  set('editAction',canEdit(m));
  set('replyAction',!m?.deleted);
  set('copyAction',!!m?.text);
}

function openMessageMenu(b){
  const id=b?.dataset?.messageId;
  if(!id)return;
  getMessage(id).then(m=>{
    if(!m)return toast('Message is no longer available');
    configureSelected(m);
    b.dataset.blogifyForceOpen='1';
    b.click();
    setTimeout(()=>configureSelected(m),0);
  }).catch(err=>toast(err.message||'Unable to open message'));
}

function bindAction(id,handler){
  const b=$(id);
  if(!b||b.dataset.blogifyFixedBound)return;
  b.dataset.blogifyFixedBound='1';
  b.addEventListener('click',async e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    await handler(e);
  },true);
}

function bindActions(){
  bindAction('unsendAction',async()=>{
    const m=selectedMessage;
    if(!m)return;
    const cid=await ensureConversation();
    if(!cid)return toast('Conversation unavailable');
    if(!confirm('Unsend this message for everyone?'))return;
    if(emit('message:unsend',{conversationId:cid,messageId:m._id})){
      document.querySelector('.message-row[data-id="'+CSS.escape(String(m._id))+'"]')?.remove();
      closeSheet();
    }
  });

  bindAction('deleteForMeAction',async()=>{
    const m=selectedMessage;
    if(!m)return;
    const cid=await ensureConversation();
    if(!cid)return toast('Conversation unavailable');
    if(!confirm('Delete this message for you?'))return;
    if(emit('message:deleteForMe',{conversationId:cid,messageId:m._id})){
      document.querySelector('.message-row[data-id="'+CSS.escape(String(m._id))+'"]')?.remove();
      closeSheet();
    }
  });

  bindAction('editAction',async()=>{
    const m=selectedMessage;
    if(!canEdit(m))return toast('Edit is available for only 1 minute.');
    editingMessageId=String(m._id);
    const input=$('messageInput');
    if(!input)return;
    input.value=m.text||'';
    input.focus();
    input.classList.add('blogify-editing');
    closeSheet();
    toast('Editing message — press send to save');
  });
}

function closeSheet(){
  $('overlay')?.classList.remove('open');
  $('actionSheet')?.classList.remove('open');
  selectedMessage=null;
  window.__BLOGIFY_SELECTED_MESSAGE=null;
}

function bindEditSubmit(){
  const form=$('composer'),input=$('messageInput');
  if(!form||form.dataset.blogifyFixedEdit)return;
  form.dataset.blogifyFixedEdit='1';
  form.addEventListener('submit',async e=>{
    if(!editingMessageId)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const text=input.value.trim();
    if(!text)return toast('Enter a message');
    const cid=await ensureConversation();
    if(!cid)return toast('Conversation unavailable');
    if(emit('message:edit',{conversationId:cid,messageId:editingMessageId,text})){
      editingMessageId=null;
      input.classList.remove('blogify-editing');
      input.value='';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      toast('Message updated');
    }
  },true);
}

function bindInteractions(){
  const area=$('messagesArea');
  if(!area)return;
  area.querySelectorAll('.message-bubble[data-message-id]').forEach(b=>{
    if(b.dataset.blogifyFixedInteraction)return;
    b.dataset.blogifyFixedInteraction='1';
    let timer=null;
    let startX=0,startY=0;
    b.addEventListener('contextmenu',e=>e.preventDefault(),true);
    b.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      startX=e.clientX;startY=e.clientY;
      clearTimeout(timer);
      timer=setTimeout(()=>{
        timer=null;
        b.classList.add('blogify-hold-active');
        navigator.vibrate?.(12);
        openMessageMenu(b);
        setTimeout(()=>b.classList.remove('blogify-hold-active'),250);
      },HOLD_MS);
    },true);
    b.addEventListener('pointermove',e=>{
      if(Math.hypot(e.clientX-startX,e.clientY-startY)>12){clearTimeout(timer);timer=null;}
    },true);
    b.addEventListener('pointerup',e=>{
      clearTimeout(timer);timer=null;
      if(e.pointerType==='mouse'&&e.button===0)openMessageMenu(b);
    },true);
    b.addEventListener('pointercancel',()=>{clearTimeout(timer);timer=null},true);
  });
}

async function hydrateReplies(){
  try{
    await ensureConversation();
    if(!conversationId)return;
    const r=await fetch('/messages/'+encodeURIComponent(conversationId)+'?limit=100',{credentials:'same-origin'});
    const d=await r.json();
    if(!r.ok||!d.success)return;
    const cache=new Map((d.messages||[]).map(m=>[String(m._id),m]));
    window.__BLOGIFY_MESSAGE_CACHE=cache;
    for(const m of d.messages||[]){
      const b=document.querySelector('.message-bubble[data-message-id="'+CSS.escape(String(m._id))+'"]');
      if(b)decorateReply(b,m);
    }
  }catch(_){ }
}

function bindSocketEvents(){
  const s=findSocket();
  if(!s||s.__blogifyFixedEvents)return;
  s.__blogifyFixedEvents=true;
  s.on('message:deletedForMe',d=>{
    if(d?.messageId)document.querySelector('.message-row[data-id="'+CSS.escape(String(d.messageId))+'"]')?.remove();
  });
  s.on('message:unsent',d=>{
    if(d?.messageId)document.querySelector('.message-row[data-id="'+CSS.escape(String(d.messageId))+'"]')?.remove();
  });
  s.on('message:edited',m=>{
    if(!m?._id)return;
    const row=document.querySelector('.message-row[data-id="'+CSS.escape(String(m._id))+'"]');
    const bubble=row?.querySelector('.message-bubble');
    if(!bubble)return;
    const reply=bubble.querySelector('.blogify-reply-quote');
    bubble.textContent=m.text||'';
    if(reply)bubble.prepend(reply);
    decorateReply(bubble,m);
  });
  s.on('message:action:error',d=>toast(d?.message||'Message action failed'));
  s.on('connect',()=>{
    window.__BLOGIFY_SOCKET=s;
  });
}

function setup(){
  installStyles();
  bindActions();
  bindEditSubmit();
  bindInteractions();
  bindSocketEvents();
  hydrateReplies();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);
else setup();

setInterval(()=>{
  bindActions();
  bindEditSubmit();
  bindInteractions();
  bindSocketEvents();
},1200);

new MutationObserver(()=>{
  bindInteractions();
  bindSocketEvents();
}).observe(document.body,{childList:true,subtree:true});
})();
