(function () {
  'use strict';

  const HOLD_MS = 650;
  const EDIT_MS = 60 * 1000;
  const MOVE_PX = 12;

  let conversationId = window.__BLOGIFY_CONVERSATION_ID || null;
  let selectedMessage = null;
  let editingMessageId = null;
  let socketPromise = null;

  const $ = (id) => document.getElementById(id);
  const sameId = (a, b) => String(a || '') === String(b || '');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el.__blogifyToastTimer);
    el.__blogifyToastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  async function ensureConversation() {
    if (conversationId) return String(conversationId);
    const userId = new URLSearchParams(location.search).get('user');
    if (!userId) throw new Error('Conversation unavailable');

    const response = await fetch('/messages/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ userId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.conversationId) {
      throw new Error(data.message || 'Unable to open conversation');
    }

    conversationId = String(data.conversationId);
    window.__BLOGIFY_CONVERSATION_ID = conversationId;
    return conversationId;
  }

  function getExistingSocket() {
    const candidates = [
      window.__BLOGIFY_SOCKET,
      window.blogifySocket,
      window.chatSocket,
      window.messageSocket,
      window.socket
    ];

    for (const candidate of candidates) {
      if (candidate && typeof candidate.emit === 'function') return candidate;
    }

    try {
      const managers = window.io?.managers || {};
      for (const key of Object.keys(managers)) {
        const manager = managers[key];
        const socket = manager?.nsps?.['/'];
        if (socket && typeof socket.emit === 'function') return socket;
      }
    } catch (_) {}

    return null;
  }

  function createAuthenticatedSocket() {
    if (typeof window.io !== 'function') return null;

    const url = window.__BLOGIFY_SOCKET_URL || undefined;
    const token = window.__BLOGIFY_SOCKET_TOKEN || undefined;

    const socket = window.io(url, {
      withCredentials: true,
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling']
    });

    window.__BLOGIFY_SOCKET = socket;
    return socket;
  }

  async function getSocket() {
    const existing = getExistingSocket();
    if (existing?.connected) return existing;

    if (existing && !existing.connected) {
      try { existing.connect?.(); } catch (_) {}
      if (existing.connected) return existing;
    }

    if (socketPromise) return socketPromise;

    socketPromise = new Promise((resolve, reject) => {
      const socket = getExistingSocket() || createAuthenticatedSocket();
      if (!socket) {
        socketPromise = null;
        reject(new Error('Chat connection is unavailable'));
        return;
      }

      if (socket.connected) {
        window.__BLOGIFY_SOCKET = socket;
        socketPromise = null;
        resolve(socket);
        return;
      }

      let finished = false;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        socket.off?.('connect', onConnect);
        socket.off?.('connect_error', onError);
        socketPromise = null;
        if (error) reject(error); else resolve(socket);
      };
      const onConnect = () => finish(null);
      const onError = () => finish(new Error('Chat connection is unavailable'));
      const timer = setTimeout(() => finish(new Error('Chat connection is unavailable')), 7000);

      socket.once?.('connect', onConnect);
      socket.once?.('connect_error', onError);
      try { socket.connect?.(); } catch (error) { finish(error); }
    });

    return socketPromise;
  }

  async function emit(event, payload) {
    try {
      const socket = await getSocket();
      if (!socket || !socket.connected) throw new Error('Chat connection is unavailable');
      socket.emit(event, payload);
      return true;
    } catch (error) {
      toast(error.message || 'Chat connection is unavailable');
      return false;
    }
  }

  async function joinConversation() {
    const cid = await ensureConversation();
    const socket = await getSocket();
    if (socket && socket.connected) {
      socket.emit('conversation:join', cid);
      socket.emit('conversation:active', cid);
    }
    return cid;
  }

  async function getMessages() {
    const cid = await ensureConversation();
    const response = await fetch('/messages/' + encodeURIComponent(cid) + '?limit=100', {
      credentials: 'same-origin'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load messages');
    return data.messages || [];
  }

  async function getMessage(id) {
    const messages = await getMessages();
    return messages.find((message) => sameId(message._id, id)) || null;
  }

  function isMine(message) {
    const row = message?._id
      ? document.querySelector('.message-row[data-id="' + CSS.escape(String(message._id)) + '"]')
      : null;
    if (row) return row.classList.contains('sent');
    return sameId(message?.senderId?._id || message?.senderId, window.__BLOGIFY_MY_ID);
  }

  function canEdit(message) {
    return isMine(message) && !message?.mediaType && !message?.deleted &&
      Date.now() - new Date(message.createdAt).getTime() < EDIT_MS;
  }

  function replyData(reply) {
    if (!reply) return null;
    if (typeof reply === 'object') return reply;
    const cached = window.__BLOGIFY_MESSAGE_CACHE?.get(String(reply));
    return cached || { _id: reply, text: 'Message' };
  }

  function replyText(message) {
    if (!message) return 'Message';
    if (message.deleted) return 'This message was deleted';
    if (message.text) return message.text;
    return ({ image: 'Photo', video: 'Video', audio: 'Voice message', profile: 'Shared profile' })[message.mediaType] || 'Message';
  }

  function decorateReply(bubble, message) {
    if (!bubble || !message) return;
    bubble.querySelector('.blogify-reply-quote')?.remove();

    const reply = replyData(message.replyTo);
    if (!reply) return;

    const quote = document.createElement('div');
    quote.className = 'blogify-reply-quote';
    quote.innerHTML =
      '<div class="rq-title">Replying "' + esc(replyText(reply)) + '"</div>' +
      '<div class="rq-text">' + esc(replyText(reply)) + '</div>';

    quote.addEventListener('click', (event) => {
      event.stopPropagation();
      const original = document.querySelector('.message-row[data-id="' + CSS.escape(String(reply._id || '')) + '"]');
      if (!original) return;
      original.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const originalBubble = original.querySelector('.message-bubble');
      originalBubble?.classList.add('blogify-reply-highlight');
      setTimeout(() => originalBubble?.classList.remove('blogify-reply-highlight'), 800);
    });

    bubble.prepend(quote);
  }

  function installStyles() {
    if ($('blogify-live-actions-style')) return;
    const style = document.createElement('style');
    style.id = 'blogify-live-actions-style';
    style.textContent = `
      .blogify-reply-quote{display:block;margin:-3px -3px 8px;padding:7px 9px;border-left:3px solid #3797f0;border-radius:8px;background:rgba(55,151,240,.09);text-align:left;cursor:pointer;max-width:100%;overflow:hidden}
      .sent .blogify-reply-quote{border-left-color:rgba(255,255,255,.85);background:rgba(0,0,0,.10)}
      .blogify-reply-quote .rq-title{font-size:9px;font-weight:800;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .blogify-reply-quote .rq-text{font-size:10px;line-height:1.3;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.82}
      .blogify-reply-highlight{animation:blogifyReplyHighlight .8s ease-out!important}
      .blogify-hold-active{animation:blogifyHoldPulse .18s ease-out;box-shadow:0 0 0 3px rgba(55,151,240,.24)!important}
      .blogify-editing{outline:2px solid rgba(55,151,240,.45)!important}
      @keyframes blogifyHoldPulse{from{transform:scale(.985)}to{transform:scale(1)}}
      @keyframes blogifyReplyHighlight{0%,100%{box-shadow:0 0 0 0 rgba(55,151,240,0)}40%{box-shadow:0 0 0 6px rgba(55,151,240,.35)}}
    `;
    document.head.appendChild(style);
  }

  function closeSheet() {
    $('overlay')?.classList.remove('open');
    $('actionSheet')?.classList.remove('open');
    selectedMessage = null;
    window.__BLOGIFY_SELECTED_MESSAGE = null;
  }

  function configureSelected(message) {
    selectedMessage = message;
    window.__BLOGIFY_SELECTED_MESSAGE = message;

    const mine = isMine(message);
    const show = (id, value) => {
      const element = $(id);
      if (element) element.style.display = value ? 'flex' : 'none';
    };

    show('deleteForMeAction', !message?.deleted);
    show('unsendAction', mine && !message?.deleted);
    show('editAction', canEdit(message));
    show('replyAction', !message?.deleted);
    show('copyAction', Boolean(message?.text));
  }

  function openMessageMenu(message) {
    if (!message?._id) return;
    configureSelected(message);
    const bubble = document.querySelector('.message-bubble[data-message-id="' + CSS.escape(String(message._id)) + '"]');
    if (!bubble) return;
    bubble.dataset.blogifyForceOpen = '1';
    bubble.click();
    setTimeout(() => configureSelected(message), 0);
  }

  function bindAction(id, handler) {
    const button = $(id);
    if (!button || button.dataset.blogifyFixedBound) return;
    button.dataset.blogifyFixedBound = '1';
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      await handler(event);
    }, true);
  }

  function bindActions() {
    bindAction('unsendAction', async () => {
      const message = selectedMessage;
      if (!message) return;
      if (!confirm('Unsend this message for everyone?')) return;
      try {
        const cid = await joinConversation();
        const sent = await emit('message:unsend', { conversationId: cid, messageId: message._id });
        if (sent) closeSheet();
      } catch (error) {
        toast(error.message || 'Unable to unsend message');
      }
    });

    bindAction('deleteForMeAction', async () => {
      const message = selectedMessage;
      if (!message) return;
      if (!confirm('Delete this message for you?')) return;
      try {
        const cid = await joinConversation();
        const sent = await emit('message:deleteForMe', { conversationId: cid, messageId: message._id });
        if (sent) closeSheet();
      } catch (error) {
        toast(error.message || 'Unable to delete message');
      }
    });

    bindAction('editAction', async () => {
      const message = selectedMessage;
      if (!canEdit(message)) {
        toast('Edit is available for only 1 minute.');
        return;
      }
      editingMessageId = String(message._id);
      const input = $('messageInput');
      if (!input) return;
      input.value = message.text || '';
      input.focus();
      input.classList.add('blogify-editing');
      closeSheet();
      toast('Editing message — press send to save');
    });
  }

  function bindEditSubmit() {
    const form = $('composer');
    const input = $('messageInput');
    if (!form || !input || form.dataset.blogifyFixedEdit) return;
    form.dataset.blogifyFixedEdit = '1';

    form.addEventListener('submit', async (event) => {
      if (!editingMessageId) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const text = input.value.trim();
      if (!text) return toast('Enter a message');

      try {
        const cid = await joinConversation();
        const sent = await emit('message:edit', {
          conversationId: cid,
          messageId: editingMessageId,
          text
        });
        if (sent) {
          editingMessageId = null;
          input.classList.remove('blogify-editing');
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          toast('Message updated');
        }
      } catch (error) {
        toast(error.message || 'Unable to edit message');
      }
    }, true);
  }

  function bindInteractions() {
    const area = $('messagesArea');
    if (!area) return;

    area.querySelectorAll('.message-bubble[data-message-id]').forEach((bubble) => {
      if (bubble.dataset.blogifyFixedInteraction) return;
      bubble.dataset.blogifyFixedInteraction = '1';

      let timer = null;
      let startX = 0;
      let startY = 0;

      bubble.addEventListener('contextmenu', (event) => event.preventDefault(), true);

      bubble.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        startX = event.clientX;
        startY = event.clientY;
        clearTimeout(timer);
        timer = setTimeout(async () => {
          timer = null;
          bubble.classList.add('blogify-hold-active');
          navigator.vibrate?.(12);
          try {
            const message = await getMessage(bubble.dataset.messageId);
            if (message) openMessageMenu(message);
          } catch (error) {
            toast(error.message || 'Unable to open message');
          }
          setTimeout(() => bubble.classList.remove('blogify-hold-active'), 250);
        }, HOLD_MS);
      }, true);

      bubble.addEventListener('pointermove', (event) => {
        if (Math.hypot(event.clientX - startX, event.clientY - startY) > MOVE_PX) {
          clearTimeout(timer);
          timer = null;
        }
      }, true);

      bubble.addEventListener('pointerup', (event) => {
        clearTimeout(timer);
        timer = null;
        if (event.pointerType === 'mouse' && event.button === 0) {
          getMessage(bubble.dataset.messageId).then((message) => {
            if (message) openMessageMenu(message);
          }).catch((error) => toast(error.message || 'Unable to open message'));
        }
      }, true);

      bubble.addEventListener('pointercancel', () => {
        clearTimeout(timer);
        timer = null;
      }, true);
    });
  }

  async function hydrateReplies() {
    try {
      await ensureConversation();
      const messages = await getMessages();
      const cache = new Map(messages.map((message) => [String(message._id), message]));
      window.__BLOGIFY_MESSAGE_CACHE = cache;

      for (const message of messages) {
        const bubble = document.querySelector('.message-bubble[data-message-id="' + CSS.escape(String(message._id)) + '"]');
        if (bubble) decorateReply(bubble, message);
      }
    } catch (_) {}
  }

  function applyEdited(message) {
    if (!message?._id) return;
    const row = document.querySelector('.message-row[data-id="' + CSS.escape(String(message._id)) + '"]');
    const bubble = row?.querySelector('.message-bubble');
    if (!bubble) return;

    bubble.textContent = message.text || '';
    decorateReply(bubble, message);
    window.__BLOGIFY_MESSAGE_CACHE?.set(String(message._id), message);
  }

  function removeRow(messageId) {
    document.querySelector('.message-row[data-id="' + CSS.escape(String(messageId || '')) + '"]')?.remove();
  }

  function bindSocketEvents() {
    const socket = getExistingSocket();
    if (!socket || socket.__blogifyFixedEvents) return;
    socket.__blogifyFixedEvents = true;
    window.__BLOGIFY_SOCKET = socket;

    socket.on('connect', () => {
      window.__BLOGIFY_SOCKET = socket;
      if (conversationId) {
        socket.emit('conversation:join', String(conversationId));
        socket.emit('conversation:active', String(conversationId));
      }
    });

    socket.on('message:deletedForMe', (data) => removeRow(data?.messageId));
    socket.on('message:unsent', (data) => removeRow(data?.messageId));
    socket.on('message:edited', applyEdited);
    socket.on('message:action:error', (data) => toast(data?.message || 'Message action failed'));

    socket.on('message:new', (message) => {
      if (!sameId(message?.conversationId, conversationId)) return;
      const bubble = document.querySelector('.message-bubble[data-message-id="' + CSS.escape(String(message?._id || '')) + '"]');
      if (!bubble) return;
      const cache = window.__BLOGIFY_MESSAGE_CACHE || new Map();
      const reply = message.replyTo ? cache.get(String(message.replyTo)) : null;
      cache.set(String(message._id), { ...message, replyTo: reply || message.replyTo });
      window.__BLOGIFY_MESSAGE_CACHE = cache;
      decorateReply(bubble, { ...message, replyTo: reply || message.replyTo });
    });
  }

  async function initialiseSocket() {
    try {
      const socket = await getSocket();
      if (!socket) return;
      bindSocketEvents();
      if (conversationId) {
        socket.emit('conversation:join', String(conversationId));
        socket.emit('conversation:active', String(conversationId));
      }
    } catch (_) {
      // The main message page may create its socket slightly later.
    }
  }

  async function setup() {
    installStyles();
    bindActions();
    bindEditSubmit();
    bindInteractions();
    await initialiseSocket();
    await hydrateReplies();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }

  setInterval(() => {
    bindActions();
    bindEditSubmit();
    bindInteractions();
    bindSocketEvents();
  }, 1200);

  new MutationObserver(() => {
    bindInteractions();
    bindSocketEvents();
  }).observe(document.body, { childList: true, subtree: true });
})();
