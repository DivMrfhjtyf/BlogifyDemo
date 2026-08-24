(function(){
  'use strict';
  if (!window.io || window.__BLOGIFY_MESSAGE_SOCKET_BOOTSTRAPPED) return;
  window.__BLOGIFY_MESSAGE_SOCKET_BOOTSTRAPPED = true;
  function findExisting(){
    try{
      if(window.__BLOGIFY_CHAT_SOCKET) return window.__BLOGIFY_CHAT_SOCKET;
      const managers=window.io.managers||{};
      for(const key of Object.keys(managers)){
        const socket=managers[key]?.nsps?.['/'];
        if(socket) return socket;
      }
    }catch(_){ }
    return null;
  }
  function conversationId(){
    return window.__BLOGIFY_CONVERSATION_ID || new URLSearchParams(location.search).get('conversation') || null;
  }
  function attach(socket){
    if(!socket) return null;
    window.__BLOGIFY_CHAT_SOCKET=socket;
    const join=()=>{
      const id=conversationId();
      if(id && socket.connected){
        socket.emit('conversation:join',String(id));
        socket.emit('conversation:active',String(id));
      }
    };
    if(socket.connected) join(); else socket.once('connect',join);
    return socket;
  }
  const socket=findExisting();
  if(socket){ attach(socket); return; }
  setTimeout(()=>{
    if(window.__BLOGIFY_CHAT_SOCKET) return;
    const existing=findExisting();
    if(existing){ attach(existing); return; }
    try{
      const fallback=window.io(window.__BLOGIFY_SOCKET_URL||location.origin,{withCredentials:true,transports:['websocket','polling'],auth:{token:window.__BLOGIFY_SOCKET_TOKEN||undefined}});
      attach(fallback);
      fallback.on('connect_error',err=>console.warn('[Blogify] chat socket:',err?.message||'connection failed'));
    }catch(err){ console.warn('[Blogify] chat socket bootstrap failed:',err?.message||err); }
  },250);
})();
