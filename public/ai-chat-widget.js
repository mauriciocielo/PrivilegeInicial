(function () {
  if (window.__privilegeAiWidgetLoaded) return;
  window.__privilegeAiWidgetLoaded = true;

  var scriptEl = document.currentScript;
  var origin = scriptEl && scriptEl.src ? new URL(scriptEl.src).origin : window.location.origin;
  var title = (scriptEl && scriptEl.getAttribute('data-title')) || 'Privilege AI · Assistente 360º';
  var accent = (scriptEl && scriptEl.getAttribute('data-color')) || '#600000';
  var apiEndpoint = (scriptEl && scriptEl.getAttribute('data-endpoint')) || origin + '/api/chat-widget';

  var wrap = document.createElement('div');
  wrap.id = 'privilege-ai-chat-widget';
  wrap.style.cssText = 'position:fixed;bottom:22px;right:22px;z-index:99999;font-family:system-ui,-apple-system,sans-serif;';

  var btn = document.createElement('button');
  btn.innerHTML = '💬';
  btn.title = title;
  btn.style.cssText =
    'width:56px;height:56px;border-radius:50%;border:none;background:' +
    accent +
    ';color:#fff;font-size:24px;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,0.28);';

  var box = document.createElement('div');
  box.style.cssText =
    'display:none;width:360px;max-width:calc(100vw - 32px);height:480px;background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,0.24);margin-bottom:12px;flex-direction:column;overflow:hidden;border:1px solid #e5e5e5;';

  box.innerHTML =
    '<div style="padding:14px 16px;background:' +
    accent +
    ';color:#fff;display:flex;justify-content:space-between;align-items:center;">' +
    '<div><div style="font-weight:700;font-size:14px;">' +
    title +
    '</div><div style="font-size:11px;opacity:0.85;">Gemini + Claude · Inteligência 360º</div></div>' +
    '<button id="pw-close" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">✕</button></div>' +
    '<div id="pw-msgs" style="flex:1;padding:14px;overflow-y:auto;background:#f7f7f8;display:flex;flex-direction:column;gap:10px;font-size:13px;">' +
    '<div style="background:#fff;padding:10px 12px;border-radius:10px;border:1px solid #e5e5e5;">Olá! Posso analisar as informações desta página ou tirar dúvidas sobre a Privilege Contabilidade e Consultoria. Como posso ajudar?</div>' +
    '</div>' +
    '<form id="pw-form" style="display:flex;gap:8px;padding:10px;background:#fff;border-top:1px solid #e5e5e5;">' +
    '<input id="pw-input" type="text" placeholder="Digite sua pergunta..." style="flex:1;padding:9px 12px;border-radius:999px;border:1px solid #d4d4d4;font-size:13px;outline:none;" />' +
    '<button type="submit" style="padding:0 14px;border-radius:999px;border:none;background:' +
    accent +
    ';color:#fff;font-weight:700;cursor:pointer;">Enviar</button></form>';

  wrap.appendChild(box);
  wrap.appendChild(btn);
  document.body.appendChild(wrap);

  var history = [];
  var msgsEl = box.querySelector('#pw-msgs');
  var formEl = box.querySelector('#pw-form');
  var inputEl = box.querySelector('#pw-input');

  btn.onclick = function () {
    box.style.display = box.style.display === 'none' ? 'flex' : 'none';
  };
  box.querySelector('#pw-close').onclick = function () {
    box.style.display = 'none';
  };

  function addMsg(text, isUser) {
    var d = document.createElement('div');
    d.style.cssText = isUser
      ? 'align-self:flex-end;background:' + accent + ';color:#fff;padding:9px 12px;border-radius:10px;max-width:85%;white-space:pre-line;'
      : 'align-self:flex-start;background:#fff;color:#171717;padding:9px 12px;border-radius:10px;border:1px solid #e5e5e5;max-width:85%;white-space:pre-line;';
    d.textContent = text;
    msgsEl.appendChild(d);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  formEl.onsubmit = function (e) {
    e.preventDefault();
    var val = (inputEl.value || '').trim();
    if (!val) return;
    inputEl.value = '';
    addMsg(val, true);

    var pageContext = (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 2200);
    fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: val,
        history: history,
        pageTitle: document.title,
        pageUrl: window.location.href,
        pageContext: pageContext,
      }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        var reply = d && d.reply ? d.reply : 'Não consegui responder agora.';
        history.push({ role: 'user', text: val });
        history.push({ role: 'model', text: reply });
        addMsg(reply, false);
      })
      .catch(function () {
        addMsg('Erro de conexão ao consultar a IA.', false);
      });
  };
})();
