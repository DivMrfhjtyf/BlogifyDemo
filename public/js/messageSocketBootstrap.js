(function(){
  'use strict';
  if (!window.io || window.__BLOGIFY_MESSAGE_SOCKET_BOOTSTRAPPED) return;
  window.__BLOGIFY_MESSAGE_SOCKET_BOOTSTRAPPED = true;

  function findConnected(){
    try{
      if(window.__BLOGIFY_CHAT_SOCKET?.connected) return window.__BLOGIFY_CHAT_SOCKET;
      const managers=window.io.managers||{};
      for(const key of Object.keys(managers)){
        const socket=managers[key]?.nsps?.['/'];
        if(socket?.connected) return socket;
      }
    }catch(_){ }
    return null;
  }

  function conversationId(){
    if(window.__BLOGIFY_CONVERSATION_ID) return String(window.__BLOGIFY_CONVERSATION_ID);
    const params=new URLSearchParams(location.search);
    return params.get('conversation') || null;
  }

  async function resolveConversation(){
    const direct=conversationId();
    if(direct) return direct;
    const user=new URLSearchParams(location.search).get('user');
    if(!user) return null;
    try{
      const response=await fetch('/messages/conversation',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'same-origin',
        body:JSON.stringify({userId:user})
      });
      const data=await response.json();
      if(response.ok&&data.success&&data.conversationId){
        window.__BLOGIFY_CONVERSATION_ID=String(data.conversationId);
        return String(data.conversationId);
      }
    }catch(_){ }
    return null;
  }

  function attach(socket){
    if(!socket) return null;
    window.__BLOGIFY_CHAT_SOCKET=socket;
    const join=async()=>{
      const id=await resolveConversation();
      if(id && socket.connected){
        socket.emit('conversation:join',id);
        socket.emit('conversation:active',id);
      }
    };
    if(socket.connected) join();
    else socket.once('connect',join);
    return socket;
  }

  let socket=findConnected();
  if(socket){ attach(socket); return; }

  try{
    const url=window.__BLOGIFY_SOCKET_URL||location.origin;
    socket=window.io(url,{
      withCredentials:true,
      transports:['websocket','polling'],
      auth:{token:window.__BLOGIFY_SOCKET_TOKEN||undefined}
    });
    attach(socket);
    socket.on('connect_error',err=>console.warn('[Blogify] chat socket:',err?.message||'connection failed'));
  }catch(err){
    console.warn('[Blogify] chat socket bootstrap failed:',err?.message||err);
  }
})();
