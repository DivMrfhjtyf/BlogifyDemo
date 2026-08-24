(function(){
'use strict';
const EDIT_WINDOW_MS=60000;
const $=id=>document.getElementById(id);
let timer=null,originalSend=null;
function style(){
 if($('blogify-edit-ui-style'))return;
 const s=document.createElement('style');s.id='blogify-edit-ui-style';s.textContent=`
.blogify-edit-bar{min-height:54px!important;padding:8px 12px!important;gap:10px!important;background:var(--surface,#fff)!important;border-top:1px solid var(--line,#e3e3e6)!important;box-shadow:0 -4px 16px rgba(0,0,0,.05)}
.blogify-edit-icon{width:34px!important;height:34px!important;border-radius:11px!important}.blogify-edit-title{font-size:11px!important;letter-spacing:.1px}.blogify-edit-preview{max-width:70vw!important}
.blogify-edit-cancel{height:34px!important;border-radius:10px!important;padding:0 10px!important}.blogify-edit-cancel:hover{background:var(--input,#f2f2f4)}
.blogify-edit-countdown{font-size:9px;color:var(--muted,#737373);margin-left:5px;white-space:nowrap}
.composer.edit-mode .input-box{border-color:#3797f0!important;box-shadow:0 0 0 2px rgba(55,151,240,.10)}
.composer.edit-mode .send-btn{display:grid!important;background:#3797f0!important}.composer.edit-mode .send-btn i{font-size:15px}.composer.edit-mode .composer-btn{opacity:.55}
`;document.head.appendChild(s);
}
function setSend(send,html,title,aria){
 if(!send)return;
 if(send.innerHTML!==html)send.innerHTML=html;
 if(send.title!==title)send.title=title;
 if(aria){if(send.getAttribute('aria-label')!==aria)send.setAttribute('aria-label',aria)}else send.removeAttribute('aria-label');
}
function enhance(){
 const bar=$('blogifyEditBar'),composer=$('composer'),send=$('sendButton');if(!bar||!composer)return;style();
 if(!bar.querySelector('.blogify-edit-countdown')){const title=bar.querySelector('.blogify-edit-title');if(title){const c=document.createElement('span');c.className='blogify-edit-countdown';title.appendChild(c)}}
 const visible=bar.classList.contains('show');composer.classList.toggle('edit-mode',visible);
 if(send){if(!originalSend)originalSend={html:send.innerHTML,title:send.title,aria:send.getAttribute('aria-label')};if(visible)setSend(send,'<i class="fas fa-check"></i>','Update message','Update message');else if(originalSend)setSend(send,originalSend.html,originalSend.title||'Send message',originalSend.aria||null)}
 const countdown=bar.querySelector('.blogify-edit-countdown');
 if(visible){if(!timer)timer=setInterval(()=>{if(!bar.classList.contains('show')){clearInterval(timer);timer=null;return}const started=Number(window.__BLOGIFY_EDIT_STARTED_AT||0),left=Math.max(0,EDIT_WINDOW_MS-(Date.now()-started));if(countdown)countdown.textContent=started?`${Math.ceil(left/1000)}s`:'';if(left<=0){clearInterval(timer);timer=null;if(countdown)countdown.textContent='Expired'}},250)}else if(timer){clearInterval(timer);timer=null}
}
function watch(){style();new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});enhance()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
})();
