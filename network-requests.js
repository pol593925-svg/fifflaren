(function () {
  'use strict';
  let session = null, hooks = null, requestId = null, requestLink = '', sending = false, epoch = 0, accessSequence = 0;
  const $ = id => document.getElementById(id);
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
  async function api(path, init = {}) {
    const cfg = session;
    if (!cfg?.token) throw Error('Войди в приложение заново.');
    const response = await fetch(cfg.server + path, { ...init, headers: { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
    let data; try { data = await response.json(); } catch { throw Error('Для этой функции требуется обновлённый сервер.'); }
    if (cfg !== session) throw Error('Аккаунт изменился. Открой окно заново.');
    if (!response.ok || !data.success) throw Error(data.message || (response.status === 404 ? 'Функция появится после обновления сервера.' : 'Не удалось выполнить запрос.'));
    return data;
  }
  function dialog(id, title) {
    const el = node('dialog', '', 'hub-work-dialog desk-dialog'); el.id = id;
    const heading = node('h2', title); heading.id = id + 'Title'; el.setAttribute('aria-labelledby', heading.id);
    const close = node('button', '×', 'hub-work-close'); close.type = 'button'; close.setAttribute('aria-label', 'Закрыть'); close.onclick = () => el.close();
    el.append(close, heading); document.body.append(el); return el;
  }
  function init() {
    const row = document.querySelector('.desk-call-actions') || document.querySelector('.terra-shift-actions');
    if (!row || $('networkRequestButton')) return;
    const button = node('button', 'Скачать пасы', 'terra-action desk-network-action'); button.id = 'networkRequestButton'; button.type = 'button'; row.append(button);
    const modal = dialog('networkRequestDialog', 'Скачать пасы');
    modal.append(node('p', 'Заявка по сети компании. Вставь ссылку на лог — команда получит её и отметит выполнение.', 'desk-dialog-copy'));
    const form = node('form'), label = node('label', 'Ссылка на лог'), input = node('input');
    input.id = 'networkRequestLink'; input.type = 'url'; input.required = true; input.maxLength = 2048; input.placeholder = 'https://…'; input.autocomplete = 'off'; label.htmlFor = input.id;
    const status = node('p', '', 'desk-form-status'); status.id = 'networkRequestStatus'; status.setAttribute('role', 'status');
    const submit = node('button', 'Отправить заявку', 'desk-primary'); submit.id = 'networkRequestSubmit'; submit.type = 'submit';
    form.append(label, input, status, submit); modal.append(form);
    button.onclick = () => { if (!modal.open) modal.showModal(); input.focus(); };
    modal.addEventListener('close', () => button.focus({ preventScroll: true }));
    input.addEventListener('input', () => { if (!sending) status.textContent = ''; });
    form.onsubmit = async event => {
      event.preventDefault(); if (sending || !form.reportValidity()) return;
      const link = input.value.trim(); let url;
      try { url = new URL(link); } catch {}
      if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) { status.textContent = 'Укажи ссылку HTTP или HTTPS без логина и пароля в адресе.'; input.focus(); return; }
      if (link !== requestLink || !requestId) { requestLink = link; requestId = crypto.randomUUID(); }
      const current = epoch; sending = true; submit.disabled = true; input.readOnly = true; status.textContent = 'Отправляем заявку…';
      try {
        await api('/api/calls/network-requests', { method: 'POST', body: JSON.stringify({ link, requestId }) });
        if (current !== epoch) return;
        requestId = null; requestLink = ''; input.value = ''; status.textContent = 'Заявка отправлена. Статус появится в «Моих коллах».';
        const notice = $('deskRequestNotice'); if (notice) notice.textContent = 'Заявка по сети отправлена · результат — в «Моих коллах».';
        window.HubCalls?.loadMine(); modal.close();
      } catch (error) { if (current === epoch) status.textContent = error.message + ' Ссылка сохранена, можно повторить отправку.'; }
      finally { if (current === epoch) { sending = false; submit.disabled = false; input.readOnly = false; } }
    };
    const notice = node('p', '', 'desk-request-notice'); notice.id = 'deskRequestNotice'; notice.setAttribute('role', 'status'); row.after(notice);

    const toolbar = document.querySelector('#tab-mycalls .calls-toolbar');
    if (!toolbar) return;
    const accessButton = node('button', 'Доступ к коллам', 'template-btn'); accessButton.id = 'teamCallsAccessButton'; accessButton.type = 'button'; accessButton.hidden = true; toolbar.append(accessButton);
    const accessDialog = dialog('teamCallsAccessDialog', 'Доступ к коллам команды');
    accessDialog.append(node('p', 'Выбранные сотрудники смогут просматривать заявки и менять их статусы. Остальные права администратора им не выдаются.', 'desk-dialog-copy'));
    const find = node('input'); find.id = 'teamCallsAccessSearch'; find.type = 'search'; find.placeholder = 'Найти сотрудника'; find.setAttribute('aria-label', 'Найти сотрудника');
    const accessStatus = node('p', '', 'desk-form-status'); accessStatus.id = 'teamCallsAccessStatus'; accessStatus.setAttribute('role', 'status');
    const list = node('div', '', 'desk-access-list'); list.id = 'teamCallsAccessList';
    const refresh = node('button', 'Обновить список', 'template-btn'); refresh.type = 'button'; refresh.id = 'teamCallsAccessRefresh';
    accessDialog.append(find, refresh, accessStatus, list);
    let members = [], generation = 0;
    function renderMembers() {
      list.replaceChildren(); const query = find.value.trim().toLocaleLowerCase('ru');
      for (const member of members.filter(m => m.username.toLocaleLowerCase('ru').includes(query))) {
        const line = node('label', '', 'desk-access-person'), check = node('input'), text = node('span'), name = node('strong', member.username), meta = node('small', member.team || 'Без команды');
        check.type = 'checkbox'; check.checked = member.canReview === true; check.setAttribute('aria-label', 'Доступ к коллам: ' + member.username); text.append(name, meta); line.append(text, check); list.append(line);
        check.onchange = async () => {
          const current = epoch, before = member.canReview === true, enabled = check.checked; check.disabled = true; accessStatus.textContent = 'Сохраняем · ' + member.username;
          try {
            await api('/api/owner/calls-access/' + encodeURIComponent(member.username), { method: 'PATCH', body: JSON.stringify({ enabled }) });
            if (current !== epoch) return; member.canReview = enabled; accessStatus.textContent = (enabled ? 'Доступ выдан · ' : 'Доступ закрыт · ') + member.username;
          } catch (error) { if (current === epoch) { check.checked = before; accessStatus.textContent = error.message; } }
          finally { if (current === epoch) check.disabled = false; }
        };
      }
      if (!list.children.length) list.append(node('p', members.length ? 'Никого не найдено.' : 'Нет доступных сотрудников.'));
    }
    async function loadMembers() {
      const current = ++generation, account = epoch; refresh.disabled = true; accessStatus.textContent = 'Загружаем сотрудников…';
      try { const data = await api('/api/owner/calls-access'); if (current !== generation || account !== epoch) return; members = data.users; renderMembers(); accessStatus.textContent = 'Доступ есть у ' + members.filter(m => m.canReview).length + ' сотрудников.'; }
      catch (error) { if (current === generation && account === epoch) { members = []; list.replaceChildren(); accessStatus.textContent = error.message; } }
      finally { if (current === generation && account === epoch) refresh.disabled = false; }
    }
    find.oninput = renderMembers; refresh.onclick = loadMembers;
    accessButton.onclick = () => { find.value = ''; if (!accessDialog.open) accessDialog.showModal(); loadMembers(); find.focus(); };
    accessDialog.addEventListener('close', () => accessButton.focus({ preventScroll: true }));
  }
  async function refreshAccess() {
    const current = epoch, sequence = ++accessSequence;
    try { const access = await api('/api/calls/access'); if (current === epoch && sequence === accessSequence) { hooks?.access(access); if ($('teamCallsAccessButton')) $('teamCallsAccessButton').hidden = !access.isOwner; } }
    catch (error) { if (current === epoch && sequence === accessSequence) hooks?.accessError?.(error); }
  }
  function start(config, callbacks) {
    epoch++; session = config; hooks = callbacks; sending = false; requestId = null; requestLink = ''; init();
    for (const id of ['networkRequestDialog', 'teamCallsAccessDialog']) if ($(id)?.open) $(id).close();
    if ($('networkRequestLink')) { $('networkRequestLink').value = ''; $('networkRequestLink').readOnly = false; $('networkRequestSubmit').disabled = false; }
    for (const id of ['networkRequestStatus', 'deskRequestNotice', 'teamCallsAccessStatus', 'teamCallsAccessList']) $(id)?.replaceChildren();
    if ($('teamCallsAccessButton')) $('teamCallsAccessButton').hidden = true;
    refreshAccess();
  }
  document.addEventListener('DOMContentLoaded', init);
  window.HubTeamCalls = { start, refreshAccess };
})();
