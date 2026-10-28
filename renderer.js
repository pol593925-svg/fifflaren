// ==================== SUPPORT HUB v3 ====================
// ⚠️ АДРЕС НОВОГО СЕРВЕРА (Render) — меняется здесь
const SERVER_API_URL = "https://support-hub-server-v3.onrender.com";
// Google-таблица (дублирование параллельно)
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby1q1rhdewBwtjCGPQ9g7g_HaruhPYxovLQRbAuXQyV8GIyNY5suZpxXn_hJSrRoLbt/exec";

const fs = require('fs');
const path = require('path');
const { ipcRenderer, desktopCapturer } = require('electron');
const { io } = require("socket.io-client");
ipcRenderer.on('open-calls',(_event,date)=>HubCalls.open(date));
ipcRenderer.on('calls-tick',()=>HubCalls.checkDigest());

const notesFilePath = path.join(process.cwd(), 'notes.txt');

let socket = null;
let currentUser = "";      // ник текущего пользователя
let currentRole = "user";  // 'admin' или 'user'
let exchangeEntries = null;
let onlineNicks = [];      // кто онлайн в чате (для точек в Штабе)
let tlTeam = "";           // название команды, если текущий пользователь — ТЛ
const tlSound = new Audio('alert.wav');

// Состояние смены
let timerInterval = null, startTimeMs = null, startTimeStr = "", count = 0, isWorking = false;

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ==================== АВТОРИЗАЦИЯ ====================
document.addEventListener("DOMContentLoaded", () => {
  const authScreen = document.getElementById("authScreen");
  const authTitle = document.getElementById("authTitle");
  const authSubtitle = document.getElementById("authSubtitle");
  const authUsername = document.getElementById("authUsername");
  const authPassword = document.getElementById("authPassword");
  const authSubmitBtn = document.getElementById("authSubmitBtn");
  const authErrorMsg = document.getElementById("authErrorMsg");
  const authSwitchMode = document.getElementById("authSwitchMode");

  let isRegisterMode = false;

  // Вход при КАЖДОМ запуске — авто-входа нет намеренно
  if (authScreen) authScreen.style.display = "flex";

  if (authSwitchMode) {
    authSwitchMode.addEventListener("click", (e) => {
      e.preventDefault();
      isRegisterMode = !isRegisterMode;
      if (isRegisterMode) {
        authTitle.innerText = "📝 Регистрация в Support Hub";
        authSubtitle.innerText = "Создайте новый аккаунт:";
        authSubmitBtn.innerText = "Зарегистрироваться";
        authSwitchMode.innerText = "Уже есть аккаунт? Войти";
      } else {
        authTitle.innerText = "👤 Вход в Support Hub";
        authSubtitle.innerText = "Введите данные для входа в систему:";
        authSubmitBtn.innerText = "Войти";
        authSwitchMode.innerText = "Нет аккаунта? Зарегистрироваться";
      }
      authErrorMsg.innerText = "";
    });
  }

  if (authSubmitBtn) {
    authSubmitBtn.addEventListener("click", async () => {
      const username = authUsername.value.trim();
      const password = authPassword.value.trim();
      const teamSelect = document.getElementById("authTeam");
      const team = teamSelect && teamSelect.style.display !== "none" ? (teamSelect.value || "") : "";

      if (!username || !password) {
        authErrorMsg.innerText = "Заполните все поля!";
        return;
      }
      if (teamSelect && teamSelect.style.display !== "none" && !team) {
        authErrorMsg.innerText = "Выбери команду!";
        return;
      }

      const endpoint = isRegisterMode ? `${SERVER_API_URL}/api/register` : `${SERVER_API_URL}/api/login`;

      authErrorMsg.innerText = "Сервер «просыпается», подождите (до 30 сек)...";
      authSubmitBtn.disabled = true;

      // Ретраи для бесплатного Render (засыпает после простоя)
      const makeAuthRequest = async (retries = 4) => {
        for (let i = 0; i < retries; i++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(isRegisterMode ? { username, password, team } : { username, password }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            return await response.json();
          } catch (err) {
            console.warn(`Попытка ${i + 1} не удалась:`, err.message);
            if (i === retries - 1) throw err;
            authErrorMsg.innerText = `Подключение к БД (попытка ${i + 2}/4)... Сервер просыпается.`;
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      };

      try {
        const data = await makeAuthRequest(4);

        if (!data || !data.success) {
          authErrorMsg.innerText = data?.message || "Ошибка авторизации!";
          authSubmitBtn.disabled = false;
          return;
        }

        if (isRegisterMode) {
          alert("Регистрация успешна! Теперь войдите.");
          isRegisterMode = false;
          authTitle.innerText = "👤 Вход в Support Hub";
          authSubtitle.innerText = "Введите данные для входа в систему:";
          authSubmitBtn.innerText = "Войти";
          authSwitchMode.innerText = "Нет аккаунта? Зарегистрироваться";
          authPassword.value = "";
          authErrorMsg.innerText = "";
          authSubmitBtn.disabled = false;
          return;
        }

        currentUser = data.username;
        currentRole = data.role || 'user';
        HubCalls.start({username:data.username,token:data.callsToken,server:SERVER_API_URL,notify:payload=>ipcRenderer.send('call-notification',payload)});
      HubVoxels.configure({username:data.username,token:data.callsToken,server:SERVER_API_URL,io});
        localStorage.setItem('global_worker_nick', data.username);
        localStorage.setItem('support_hub_user', data.username);
        // 3.12.0: «Оставаться в системе»
        const rememberBox = document.getElementById("authRemember");
        if (rememberBox && rememberBox.checked) {
          localStorage.setItem('sh_auth', JSON.stringify({ u: username, p: password }));
        } else {
          localStorage.removeItem('sh_auth');
        }

        if (authScreen) authScreen.style.display = "none";
        authSubmitBtn.disabled = false;

        applyNickToApp(data.username);
        loadHQRoster();
        if (currentRole === 'admin') setupAdminPanel();
        checkTLStatus();
        initSocketConnection(data.username);
      } catch (err) {
        console.error("Ошибка связи с сервером авторизации:", err);
        authErrorMsg.innerText = "База данных " + (err.name === 'AbortError' ? "не ответила вовремя (таймаут)." : "недоступна. Попробуйте еще раз через минуту.");
        authSubmitBtn.disabled = false;
      }
    });
  }

  // --- НАВИГАЦИЯ ПО ВКЛАДКАМ ---
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".content");

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const tabName = button.getAttribute("data-tab");

      tabButtons.forEach(btn => btn.classList.remove("active"));
      tabContents.forEach(el => { el.classList.remove("active"); el.style.display = "none"; });

      button.classList.add("active");
      const targetTab = document.getElementById("tab-" + tabName);
      if (targetTab) { targetTab.classList.add("active"); targetTab.style.display = "flex"; }

      if (tabName === 'admin') refreshAdminPanel();
      if (tabName === 'hq') loadHQRoster();
      if (tabName === 'tlpanel') loadTlToday();
      if (tabName === 'tasks') loadTasks();
      if (tabName === 'salary') loadSalary();
      if (tabName === 'mycalls') HubCalls.load();
      if (tabName === 'casino') casinoEnter();
      if (tabName === 'feed') loadFeed();
      if (tabName === 'pm') { loadPmInbox(); loadPmChat(); }
      if (tabName === 'swipe') loadSwipeQueue();
      if (tabName === 'tops') loadTops();
      if (tabName === 'battleship') bsTabOpen();
      if (tabName === 'voxel') HubVoxels.open();
      if (tabName === 'cs16' && typeof window.__cs16Open === 'function') window.__cs16Open(currentUser);
      if (tabName === 'support2' && typeof window.__s2Open === 'function') window.__s2Open(currentUser);
    });
  });

  // --- ЗАМЕТКИ (загрузка) ---
  try {
    if (fs.existsSync(notesFilePath)) {
      const savedNotes = fs.readFileSync(notesFilePath, 'utf8');
      const userNotesEl = document.getElementById("userNotes");
      if (userNotesEl) userNotesEl.value = savedNotes;
    }
  } catch (err) {
    console.error("Ошибка чтения файла заметок:", err);
  }

  HubExchanges.configure({isAdmin:()=>currentRole==='admin',save:async(row,website,logo)=>{
    const res=await fetch(SERVER_API_URL+'/api/admin/exchanges/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminUsername:currentUser,section:row.section,name:row.name,condition:row.condition||'',website,logo})});
    const data=await res.json();if(!res.ok||!data.success)throw Error(data.message||'Не удалось сохранить сайт');
  }});
  loadShiftState();
  initChatUI();
  loadExchangesFromServer(); // подменяет статику справочника данными с сервера
  loadTeamsForAuth();        // список команд для регистрации
  renderExchangeLists();

  // Дата по умолчанию в админке
  const evDate = document.getElementById("adminEventsDate");
  if (evDate) evDate.value = localDateStr();
  const stDate = document.getElementById("adminStatsDate");
  if (stDate) stDate.value = localDateStr();
  const tlDate = document.getElementById("tlEventsDate");
  if (tlDate) tlDate.value = localDateStr();
  // Месяц по умолчанию в ЗП (3.3.0)
  const curMonth = localDateStr().slice(0, 7);
  const salMonth = document.getElementById("salaryMonth");
  if (salMonth) salMonth.value = curMonth;
  const tlSalMonth = document.getElementById("tlSalaryMonth");
  if (tlSalMonth) tlSalMonth.value = curMonth;

  // --- ПРИВЯЗКА КНОПОК ---

  bindClick("templateBtn", insertTruffleTemplate);
  bindClick("sendBugBtn", sendBugReport);
  bindClick("checkTrufflesBtn", checkTruffles);
  bindClick("startBtn", toggleShift);
  bindClick("stopBtn", finishShift);
  bindClick("addOneBtn", () => addCountWithLog(1));
  bindClick("addFiveBtn", () => addCount(5));
  bindClick("subOneBtn", () => addCount(-1));
  bindClick("resetShiftBtn", resetShift);
  bindClick("copyBtn", copyReport);
  bindClick("sendOvertimeBtn", sendOvertime);
  bindClick("sendCallBtn", sendCallEntry);
  bindClick("sendLeaveBtn", sendLeave);
  bindClick("openExplorerBtn", openExplorer);
  bindClick("saveNotesBtn", saveNotes);
  bindClick("adminNotifySendBtn", () => sendAdminNotification());
  bindClick("adminForceRestartBtn", sendForceRestart);
  bindClick("adminScareBtn", sendScare);
  bindScarePicker();
  bindClick("adminImageSendBtn", sendAdminImage);
  bindAdminImagePicker();
  bindClick("tlEventsLoadBtn", () => loadTlHistory());
  // 3.1.0
  bindClick("feedSendBtn", sendFeedItem);
  bindFeedPicker();
  bindClick("feedSearchBtn", loadFeed);
  bindClick("adminTaskAddBtn", addAdminTask);
  bindClick("profCloseBtn", closeProfile);
  bindClick("profChangeAvatarBtn", () => document.getElementById("profAvatarFile")?.click());
  const profAvatarFile = document.getElementById("profAvatarFile");
  if (profAvatarFile) profAvatarFile.addEventListener("change", changeOwnAvatar);
  const themeBtn = document.getElementById("themeToggleBtn");
  if (themeBtn) themeBtn.addEventListener("click", () => applyTheme(!document.body.classList.contains('light')));
  applyTheme(localStorage.getItem('sh_theme') === 'light');
  // 3.2.0
  bindClick("pmSendBtn", sendPm);
  const pmInput = document.getElementById("pmInput");
  if (pmInput) pmInput.addEventListener("keypress", (e) => { if (e.key === 'Enter') sendPm(); });
  bindClick("soundToggleBtn", () => { soundOn = !soundOn; applySoundBtn(); });
  applySoundBtn();
  bindClick("swipeLikeBtn", () => swipeVote('like'));
  bindClick("swipeDislikeBtn", () => swipeVote('dislike'));
  bindClick("swipeResultsLink", loadSwipeResults);
  bindClick("casinoSpinBtn", casinoSpin);
  bindClick("bet5Btn", () => casinoSetBet(5));
  bindClick("bet10Btn", () => casinoSetBet(10));
  bindClick("casinoDailyBtn", casinoDaily);
  bindClick("pwdModalOk", pwdModalConfirm);
  bindClick("pwdModalCancel", pwdModalClose);
  const pwdInput = document.getElementById("pwdModalInput");
  if (pwdInput) pwdInput.addEventListener("keypress", (e) => { if (e.key === 'Enter') pwdModalConfirm(); });
  bindClick("profWriteBtn", () => { if (lastProfileNick) openPmWith(lastProfileNick); });
  bindSwipeDrag();
  bindClick("adminQuickRabotayBtn", () => sendAdminNotification("РАБОТАЙ СУКА", "all", true));
  bindClick("adminEventsLoadBtn", loadAdminEvents);
  bindClick("adminStatsLoadBtn", loadAdminStats);
  bindClick("adminTeamAddBtn", addAdminTeam);
  bindClick("adminExAddBtn", addAdminExchange);
  // 3.3.0: ЗП, уведомления ТЛ, открытие ссылок
  bindClick("salaryLoadBtn", loadSalary);
  bindClick("tlSalaryLoadBtn", loadTlSalary);
  bindClick("tlNotifySendBtn", tlSendNotify);
  bindClick("adminLinkSendBtn", sendAdminLink);

  const exchangeSearchInput = document.getElementById("exchangeSearchInput");
  if (exchangeSearchInput) exchangeSearchInput.addEventListener("input", handleExchangeSearch);

  // Баннер обновления
  ipcRenderer.on('update_downloaded', () => {
    const banner = document.getElementById("updateNotification");
    if (banner) banner.style.display = "flex";
  });
  bindClick("downloadUpdateBtn", () => ipcRenderer.send('restart_to_update'));

  setInterval(updateHQStatusDots, 15000);
});

function bindClick(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", fn);
}

// ==================== КОМАНДЫ (ШТАБ) И СПРАВОЧНИК С СЕРВЕРА ====================

// Список команд для формы регистрации
async function loadTeamsForAuth() {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/teams`);
    const data = await res.json();
    const teams = (data.teams || []).map(t => t.name);
    const sel = document.getElementById("authTeam");
    if (!sel) return;
    if (teams.length > 0) {
      sel.innerHTML = '<option value="">— Выбери команду —</option>' +
        teams.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
      sel.style.display = "block";
    } else {
      sel.style.display = "none";
    }
  } catch (e) {
    // сервер недоступен — команды скроются, регистрация без команды
    const sel = document.getElementById("authTeam");
    if (sel) sel.style.display = "none";
  }
}

// Состав Штаба с сервера
async function loadHQRoster() {
  const box = document.getElementById("hqContainer");
  if (!box) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/teams`);
    const data = await res.json();
    const teams = data.teams || [];

    if (!teams.length) {
      box.innerHTML = '<p style="color:#777; font-size:12px;">Команд пока нет. Админ добавляет их в 👑 Админка → «Команды».</p>';
      return;
    }

    box.innerHTML = "";
    // Карма недели (3.7.0)
    let karmaTotals = {};
    try {
      const kres = await fetch(`${SERVER_API_URL}/api/karma?voter=${encodeURIComponent(currentUser)}`);
      const kdata = await kres.json();
      (kdata.totals || []).forEach(t => { karmaTotals[t.username] = t.total; });
    } catch (e) {}
    teams.forEach(t => {
      const col = document.createElement("div");
      col.className = "team-column";
      col.style.flex = "1";
      const usersHtml = t.users.length
        ? t.users.map(u => {
            const k = karmaTotals[u] || 0;
            const kbadge = k !== 0
              ? ` <span style="font-size:10px; color:${k > 0 ? '#ffc107' : '#ff6b6b'};" title="Карма недели">${k > 0 ? '🔥+' + k : '👎' + k}</span>`
              : '';
            return `<li data-nick="${escapeHtml(u)}">${escapeHtml(u)}${kbadge} <span class="status-dot"></span>
              <span style="float:right; font-size:11px; letter-spacing:2px;">
                <span style="cursor:pointer;" title="Похвалить" onclick="event.stopPropagation(); karmaVote('${escapeHtml(u)}', 1)">👍</span>
                <span style="cursor:pointer;" title="Пожарить" onclick="event.stopPropagation(); karmaVote('${escapeHtml(u)}', -1)">👎</span>
              </span></li>`;
          }).join('')
        : '<li style="color:#666;">пусто</li>';
      col.innerHTML = `<h4 style="color:#4da6ff;">🏴 ${escapeHtml(t.name)}</h4><ul class="team-list">${usersHtml}</ul>`;
      box.appendChild(col);
    });
    // Итоги недели по карме
    const karmaSorted = Object.entries(karmaTotals).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
    if (karmaSorted.length) {
      const kbox = document.createElement("div");
      kbox.style.cssText = "width:100%; margin-top:12px; font-size:12px; border-top:1px solid #333; padding-top:8px;";
      kbox.innerHTML = '<b style="color:#ffc107;">🔥 Итоги недели:</b> ' + karmaSorted.map(([n, v]) =>
        `<span style="margin-right:10px;">${escapeHtml(n)} <b style="color:${v > 0 ? '#ffc107' : '#ff6b6b'};">${v > 0 ? '+' + v : v}</b></span>`
      ).join('');
      box.appendChild(kbox);
    }
    updateHQStatusDots();
    // Клик по нику — мини-профиль
    box.querySelectorAll('.team-list li[data-nick]').forEach(li => {
      li.addEventListener('click', () => openProfile(li.getAttribute('data-nick')));
    });
  } catch (e) {
    box.innerHTML = '<p style="color:#777; font-size:12px;">Не удалось загрузить состав (нет соединения).</p>';
  }
}

// Справочник бирж с сервера (fallback — статика из кода, если сервер не ответил)
async function loadExchangesFromServer() {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/exchanges`);
    const data = await res.json();
    if (!data.success || !data.exchanges || !data.exchanges.length) return; // оставляем статику

    exchangeEntries = data.exchanges;
    exchangesYes = data.exchanges.filter(e => e.section === 'yes').map(e => e.name);
    exchangesCondition = data.exchanges.filter(e => e.section === 'condition').map(e => ({ name: e.name, condition: e.condition }));
    exchangesNo = data.exchanges.filter(e => e.section === 'no').map(e => e.name);
    renderExchangeLists();
  } catch (e) {
    console.warn("Справочник с сервера недоступен, используется локальная копия");
  }
}

// ==================== SOCKET.IO, ЧАТ, УВЕДОМЛЕНИЯ ====================
function initSocketConnection(username) {
  if (socket) socket.disconnect();

  socket = io(SERVER_API_URL, { reconnectionAttempts: Infinity });

  socket.on('connect', () => {
    console.log("Подключено к серверу чата");
    socket.emit('join_chat', username);
    HubCalls.subscribe(socket);

  });

  // 3.6.0: запросы скринов + оповещения о покупках
  bindScreenshotRequest();
  // 3.7.0: краш + дуэль
  bindCasinoGameHandlers();
  // 3.8.0: морской бой
  bindBattleshipHandlers();
  // 3.9.0: опционы
  bindOptionsHandlers();
  // 3.13.0: русская рулетка
  bindRaceRrHandlers();

  socket.on('chat_message', (msgData) => appendMessageToChatUI(msgData));

  socket.on('chat_error', (data) => alert(data.message || "Ошибка чата"));

  socket.on('update_chat_users', (users) => {
    onlineNicks = users || [];
    const onlineList = document.getElementById("chatOnlineList");
    if (onlineList) {
      onlineList.innerHTML = "";
      users.forEach(u => {
        const li = document.createElement("li");
        li.textContent = u;
        onlineList.appendChild(li);
      });
    }
    updateHQStatusDots();
  });

  // Уведомление поверх окон (новый формат)
  socket.on('show_notification', (payload) => {
    ipcRenderer.send('show-notification', payload);
  });

  // Событие от сотрудника команды — для ТЛ-панели (лента + звук)
  socket.on('tl_event', (payload) => {
    handleTlEvent(payload);
  });

  // Фото от админа — открываем в отдельном окне поверх остальных
  socket.on('show_image', (payload) => {
    ipcRenderer.send('show-image', payload);
  });

  // Ссылка от админа — открываем в браузере на этом ПК (3.3.0)
  socket.on('open_link', (payload) => {
    if (!payload || !payload.url) return;
    if (payload.from && payload.from.toLowerCase() === currentUser.toLowerCase()) return; // себе не открываем
    ipcRenderer.send('open-url', payload);
  });

  // Старый формат триггера — тоже показываем поверх окон
  socket.on('admin_trigger', (data) => {
    ipcRenderer.send('show-notification', {
      text: data.text,
      from: 'Fifflaren',
      time: new Date().toLocaleTimeString('ru-RU')
    });
  });

  socket.on('user_muted', (data) => {
    if (data.username && data.username.toLowerCase() === currentUser.toLowerCase()) {
      alert("⚠️ Администратор выдал вам мут в чате!");
    }
  });

  socket.on('user_banned', (data) => {
    if (data.username && data.username.toLowerCase() === currentUser.toLowerCase()) {
      alert("❌ Ваш аккаунт заблокирован администратором.");
      localStorage.clear();
      location.reload();
    }
  });
}

function initChatUI() {
  const chatInput = document.getElementById("chatInput");
  const chatSendBtn = document.getElementById("sendChatMessageBtn");
  if (!chatInput) return;

  const sendMessage = () => {
    const text = chatInput.value.trim();
    if (!text) return;
    const nick = currentUser || localStorage.getItem('global_worker_nick') || "Аноним";

    if (socket && socket.connected) {
      socket.emit('chat_message', { username: nick, text });
      chatInput.value = "";
    } else {
      alert("Нет соединения с сервером чата!");
    }
  };

  if (chatSendBtn) chatSendBtn.onclick = sendMessage;
  chatInput.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
  };
}

function appendMessageToChatUI(msgData) {
  const chatContainer = document.getElementById("chatMessages");
  if (!chatContainer) return;

  const div = document.createElement("div");
  div.className = "chat-msg";
  div.innerHTML = `<strong>${escapeHtml(msgData.username || 'Аноним')}:</strong> ${escapeHtml(msgData.text)}`;
  chatContainer.appendChild(div);
  // Анти-лаг: не даём чату расти бесконечно
  while (chatContainer.children.length > 200) chatContainer.removeChild(chatContainer.firstChild);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Точки онлайна в Штабе
function updateHQStatusDots() {
  document.querySelectorAll('.team-list li[data-nick]').forEach(li => {
    const nick = (li.getAttribute('data-nick') || '').toLowerCase();
    const online = onlineNicks.some(n => n.toLowerCase() === nick);
    li.classList.toggle('online', online);
  });
}

// ==================== ОТПРАВКА СОБЫТИЙ: СЕРВЕР + GOOGLE-ТАБЛИЦА ====================
async function sendEventToServer(type, fields) {
  try {
    await fetch(`${SERVER_API_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: currentUser, type, date: localDateStr(), ...fields })
    });
  } catch (err) {
    console.error("Ошибка отправки события на сервер:", err);
  }
}

// Дублирование в Google-таблицу (параллельно, как раньше)
function sendToGoogleSheet(payload) {
  fetch(WEB_APP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => console.error("Ошибка отправки в таблицу:", err));
}

// ==================== ПОДДЕРЖКА (баги, трюфеля) ====================
function insertTruffleTemplate() {
  const desc = document.getElementById("bugDesc");
  if (!desc) return;
  desc.value = "Search- \nID- \nSumma- \nКомментарий по логу- ";
}

function sendBugReport() {
  const type = document.getElementById("bugType")?.value || "";
  const desc = document.getElementById("bugDesc")?.value.trim() || "";
  if (!desc) { alert("Опишите баг!"); return; }

  sendToGoogleSheet({ type: "Логи ошибок", nick: currentUser, bugType: type, desc });
  sendEventToServer('bug', { bugType: type, desc });

  document.getElementById("bugDesc").value = "";
  const msg = document.getElementById("statusMsg");
  if (msg) { msg.innerText = "✅ Отчёт отправлен!"; setTimeout(() => msg.innerText = "", 3000); }
}

async function checkTruffles() {
  const nick = currentUser || localStorage.getItem('global_worker_nick') || "";
  const resultBox = document.getElementById("trufflesResultBox");
  if (!nick) { alert("Сначала войдите в систему!"); return; }

  if (resultBox) {
    resultBox.style.display = "block";
    resultBox.innerHTML = "⏳ Загрузка статистики...";
  }

  try {
    const res = await fetch(`${SERVER_API_URL}/api/stats/mine?username=${encodeURIComponent(nick)}`);
    const data = await res.json();
    if (!resultBox) return;
    if (!data.success) {
      resultBox.innerHTML = `ℹ️ ${data.message || "Данные не найдены."}`;
      return;
    }

    const monthName = d => new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { month: 'long' });
    resultBox.innerHTML = `
      <b>📊 Моя статистика — ${escapeHtml(data.username)}</b>
      <table class="admin-stats-table" style="margin-top:6px;">
        <thead>
          <tr>
            <th></th>
            <th>💎 Трюф.</th>
            <th>✅ Апр.</th>
            <th>⏰ Овертайм</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Неделя</strong><br><span style="font-size:10px;color:#888;">${data.week.from} — ${data.week.to}</span></td>
            <td class="num">${data.week.truffles}</td>
            <td class="num">${data.week.approves}</td>
            <td class="num">${formatOvertime(data.week.overtimeMin)}</td>
          </tr>
          <tr>
            <td><strong>Месяц</strong><br><span style="font-size:10px;color:#888;">с 1 по ${Number(data.month.to.slice(8))} ${monthName(data.month.from)}</span></td>
            <td class="num">${data.month.truffles}</td>
            <td class="num">${data.month.approves}</td>
            <td class="num">${formatOvertime(data.month.overtimeMin)}</td>
          </tr>
        </tbody>
      </table>`;
  } catch (err) {
    if (resultBox) resultBox.innerHTML = "❌ Не удалось получить данные. Проверьте соединение.";
  }
}

// ==================== СМЕНА: ТАЙМЕР, ЛОГИ, ОВЕРТАЙМЫ ====================
function getShiftState() {
  try { return JSON.parse(localStorage.getItem('shift_state') || '{}'); }
  catch { return {}; }
}

function saveShiftState() {
  localStorage.setItem('shift_state', JSON.stringify({
    isWorking, startTimeMs, startTimeStr, count
  }));
}

function loadShiftState() {
  const st = getShiftState();
  if (!st.isWorking || !st.startTimeMs) return;

  isWorking = true;
  startTimeMs = st.startTimeMs;
  startTimeStr = st.startTimeStr || "";
  count = st.count || 0;

  document.getElementById("startBtn").style.display = "none";
  document.getElementById("stopBtn").style.display = "inline-block";
  document.getElementById("counterBox").style.opacity = "1";
  document.getElementById("counterBox").style.pointerEvents = "auto";
  document.getElementById("countDisplay").textContent = count;
  startTimerLoop();
}

function toggleShift() {
  const nick = currentUser || localStorage.getItem('global_worker_nick') || "";
  if (!nick) { alert("Сначала войдите в систему!"); return; }

  if (!isWorking) {
    isWorking = true;
    startTimeMs = Date.now();
    startTimeStr = new Date().toLocaleTimeString('ru-RU');
    count = 0;

    document.getElementById("startBtn").style.display = "none";
    document.getElementById("stopBtn").style.display = "inline-block";
    document.getElementById("counterBox").style.opacity = "1";
    document.getElementById("counterBox").style.pointerEvents = "auto";
    document.getElementById("countDisplay").textContent = "0";

    startTimerLoop();
    saveShiftState();
  }
}

function startTimerLoop() {
  clearInterval(timerInterval);
  const tick = () => {
    const elapsed = Math.floor((Date.now() - startTimeMs) / 1000);
    const hrs = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const mins = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    const timerDisplay = document.getElementById("timerDisplay");
    if (timerDisplay) timerDisplay.textContent = `${hrs}:${mins}:${secs}`;
  };
  tick();
  timerInterval = setInterval(tick, 1000);
}

// +1 лог: уходит в базу сервера и в таблицу (со ссылкой и комментарием)
function addCountWithLog(val) {
  const link = document.getElementById("logLinkInput")?.value.trim() || "";
  const comment = document.getElementById("logCommentInput")?.value.trim() || "";

  addCount(val);

  sendToGoogleSheet({ type: "Логи", nick: currentUser, link, comment });
  sendEventToServer('log', { link, comment });

  const linkInput = document.getElementById("logLinkInput");
  if (linkInput) linkInput.value = "";
}

function addCount(val) {
  count = Math.max(0, count + val);
  const countDisplay = document.getElementById("countDisplay");
  if (countDisplay) countDisplay.textContent = count;
  saveShiftState();
}

function finishShift() {
  if (!isWorking) return;
  clearInterval(timerInterval);
  isWorking = false;

  const endTimeStr = new Date().toLocaleTimeString('ru-RU');
  const elapsedMs = Date.now() - startTimeMs;
  const hrs = Math.floor(elapsedMs / 3600000);
  const mins = Math.floor((elapsedMs % 3600000) / 60000);

  document.getElementById("startBtn").style.display = "inline-block";
  document.getElementById("stopBtn").style.display = "none";

  const report = `📋 Отчёт по смене\nСотрудник: ${currentUser}\nДата: ${localDateStr()}\nНачало: ${startTimeStr}\nКонец: ${endTimeStr}\nДлительность: ${hrs} ч. ${mins} мин.\nОбработано логов: ${count}`;

  // Смена уходит в базу — админ видит её в «События по датам»
  sendEventToServer('shift', { start: startTimeStr, end: endTimeStr, duration: `${hrs} ч. ${mins} мин.`, logs: count });

  const reportBox = document.getElementById("reportBox");
  if (reportBox) { reportBox.textContent = report; reportBox.style.display = "block"; }
  const copyBtn = document.getElementById("copyBtn");
  if (copyBtn) copyBtn.style.display = "inline-block";

  localStorage.removeItem('shift_state');
}

function resetShift() {
  clearInterval(timerInterval);
  isWorking = false;
  count = 0;
  startTimeMs = null;
  startTimeStr = "";
  document.getElementById("countDisplay").textContent = "0";
  document.getElementById("timerDisplay").textContent = "00:00:00";
  const reportBox = document.getElementById("reportBox");
  if (reportBox) reportBox.style.display = "none";
  const copyBtn = document.getElementById("copyBtn");
  if (copyBtn) copyBtn.style.display = "none";
  localStorage.removeItem('shift_state');
}

function copyReport() {
  const reportBox = document.getElementById("reportBox");
  if (!reportBox) return;
  navigator.clipboard.writeText(reportBox.textContent);
  alert("Отчет скопирован в буфер обмена!");
}

function calculateDuration(from, to) {
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  let start = fh * 60 + fm, end = th * 60 + tm;
  if (end < start) end += 24 * 60;
  const diff = end - start;
  const h = Math.floor(diff / 60), m = diff % 60;
  return `${h} ч. ${m > 0 ? m + ' мин.' : ''}`.trim();
}

function sendOvertime() {
  const fromTime = document.getElementById("overtimeFrom")?.value || "";
  const toTime = document.getElementById("overtimeTo")?.value || "";
  if (!fromTime || !toTime) { alert("Укажите время 'От' и 'До'!"); return; }

  const totalDuration = calculateDuration(fromTime, toTime);

  sendToGoogleSheet({ type: "Овертаймы", nick: currentUser, fromTime, toTime, totalDuration });
  sendEventToServer('overtime', { from: fromTime, to: toTime, totalDuration });

  document.getElementById("overtimeFrom").value = "";
  document.getElementById("overtimeTo").value = "";

  const status = document.getElementById("overtimeStatus");
  if (status) { status.innerText = "✅ Овертайм добавлен!"; setTimeout(() => status.innerText = "", 3000); }
}

// ==================== КОЛЫ ====================
async function sendCallEntry() {
  const callType=document.getElementById('callTypeSelect').value,serviceName=document.getElementById('callServiceName').value.trim(),callLink=document.getElementById('callLinkInput').value.trim(),callNote=document.getElementById('callNoteInput').value.trim();
  const status=document.getElementById('callStatus'),button=document.getElementById('sendCallBtn');
  if(!serviceName||!callLink){status.textContent='Укажи название и ссылку.';return;}
  button.disabled=true;status.textContent='Отправляем…';
  try{await HubCalls.submit({callType,serviceName,callLink,callNote});sendToGoogleSheet({type:'Колы',nick:currentUser,callType,serviceName,callLink,callNote});
    for(const id of ['callServiceName','callLinkInput','callNoteInput'])document.getElementById(id).value='';status.textContent='Колл отправлен · В ожидании';
  }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
}

// ==================== ОТПРОСИТЬСЯ ====================
function sendLeave() {
  const reason = document.getElementById("leaveReason")?.value || "";
  const comment = document.getElementById("leaveComment")?.value.trim() || "";
  const date = document.getElementById("leaveDate")?.value || "";
  const from = document.getElementById("leaveTimeFrom")?.value || "";
  const to = document.getElementById("leaveTimeTo")?.value || "";

  if (!date || !from || !to) { alert("Заполните дату и время!"); return; }

  const fullReason = comment ? `${reason} — ${comment}` : reason;

  sendToGoogleSheet({ type: "Отпроситься", nick: currentUser, reason: fullReason, leaveDate: date, from, to });
  sendEventToServer('leave', { reason: fullReason, leaveDate: date, from, to });

  const status = document.getElementById("leaveStatus");
  if (status) { status.innerText = "✅ Запрос отправлен!"; setTimeout(() => status.innerText = "", 3000); }
}

// ==================== КРИПТО ЭКСПЛОРЕР ====================
function openExplorer() {
  const net = document.getElementById("network")?.value || "bsc";
  const raw = document.getElementById("cryptoQuery")?.value.trim() || "";
  if (!raw) { alert("Введите хэш или адрес!"); return; }

  const clean = raw.split("/").pop().split("?")[0].trim();
  let url = "";

  if (net === "arkham") url = "https://platform.arkhamintelligence.com/explorer/address/" + clean;
  else if (net === "pi") url = "https://blockexplorer.minepi.com/mainnet/search?q=" + encodeURIComponent(clean);
  else if (net === "bsc") url = "https://bscscan.com/search?q=" + encodeURIComponent(clean);
  else if (net === "tron") url = "https://tronscan.org/#/search/" + encodeURIComponent(clean);
  else if (net === "eth") url = "https://etherscan.io/search?q=" + encodeURIComponent(clean);
  else if (net === "btc") url = "https://blockchair.com/search?q=" + encodeURIComponent(clean);
  else if (net === "sol") url = "https://solscan.io/account/" + encodeURIComponent(clean);

  window.open(url, "_blank");
}

// ==================== ЗАМЕТКИ ====================
function saveNotes() {
  const notesVal = document.getElementById("userNotes")?.value || "";
  try {
    fs.writeFileSync(notesFilePath, notesVal, 'utf8');
    const status = document.getElementById("notesStatus");
    if (status) { status.innerText = "Сохранено!"; setTimeout(() => status.innerText = "", 2000); }
  } catch (err) {
    alert("Ошибка сохранения: " + err.message);
  }
}

// ==================== ВСПОМОГАТЕЛЬНОЕ ====================
function applyNickToApp(username) {
  const globalNickEl = document.getElementById("globalWorkerNick");
  const shiftNickEl = document.getElementById("userNick");
  if (globalNickEl) globalNickEl.value = username;
  if (shiftNickEl) shiftNickEl.value = username;
}

let exchangesYes = [
  "1xBet", "3commas", "aarman.com", "account.bcx.ba", "ACY.COM", "altex.mn", "app.airtm.com", "app.btcmarkets.net", "app.simplefx.com", "arbitrageth", "ascendex.com", "astekbet.com", "ATX", "axieinfinity.com", "axiom.trade", "bc.game", "betfury.com", "betterx.io", "bikingex.com", "binance.com", "binance.info", "binance.me", "binance.th", "binance.tr", "bingx.com", "bitazza.com", "bitbank.cc", "bitcasino.io", "bitfinex.com", "bitget.com", "bitgo.com", "bitmart.com", "bitmex.com", "bitnet.ge", "bitopro", "bitpanda.com", "bitpoint", "bitqik.com", "bitrue", "bitso.com", "bitstamp.com", "bitstreetx", "bittradex", "bittworld.com", "bitunix.com", "blockchain.com", "blocktrade.com", "blofin.com", "btcc.com", "buda.com", "buenbit.com/", "bull-ex.com", "bybit.com", "bydfi.com", "bytick.com", "ceres-finance.com", "cex.io", "client.bitharvest.io", "coin.z.com", "coinbase.com", "coincheck", "coindepo.com", "coinex.com", "Coinext", "coinhako", "coinhub.mn", "Coinone", "coins.ph", "coinshub.mn", "coinspot.com", "coinstash.com.au", "coinstore.com", "cointree.com", "coinw.com", "Covest.pro", "crypsity.com", "cryptal.com", "crypto.com", "csgoempire.com", "cwallet.com", "decrypto.la", "Deribit", "digifinex", "digitalsurge.com.au", "easicoin", "efsanetr.com", "ether.fi", "exchange.fastex.com", "f2pool.com", "fcxtrade.com", "fiahub.com", "finandy.com", "fiwind.io", "fiybit.com", "flipster.io", "fortunomarkets.com", "fpmarkets.com", "fusionmarkets.com", "gamdom", "gate.io", "gemini.com", "globalprime.com", "hapiapp.com", "hashkey.com", "hata.io", "hotbit.com", "htfx.com", "https://attlas.io/", "https://bitflyer.com", "https://dzhlwk.com", "https://grvt.io/exchange/strategies", "https://hexn.io", "https://kms.kinesis.money/", "https://mycoins.ge/", "https://portal.blueberrymarkets.com", "https://safetrade.com/", "https://swyftx.com/", "https://weex.exchange", "https://www.alchemy.com/", "https://www.btse.com/", "https://www.independentreserve.com/", "https://www.mountainwolf.com", "https://www.zoomex.com/", "https://xpo.ru", "htx.com", "idax.com", "ijex.net/pc/#/home", "indodax.com", "KAST.com", "kraken.com", "kryptex.com", "kucoin.com", "latoken", "lazzaglobal.com", "lbank.com", "lobstr.co", "luno.com", "max.maicoin.com", "maxifyfx.com", "mercadobitcoin", "mercadobitcoin.com.br", "meru.com", "mexc.com", "mobee.io", "MOTFX", "multibankfx.com", "mystake", "nexo.com", "NiceHash", "noones.com", "novadax.com", "okx.com", "One royal", "opensea.io", "optgobroker.com", "orangex.com", "orbixtrade.com", "osl.com", "p2pb2b.com", "paribu", "paxfull", "pdax.ph", "phemex.com", "picnic.com", "Pinetwork", "pintu.co.id", "pionex.com", "pluang.com", "polaris-io.com", "poloniex.com", "polymarket", "portal.fxgt.com/", "Primefort", "primexbt.com", "probit.com", "quickswap.exchange", "redotpay", "reku.id", "remitano.com", "salepoint.io", "solcasino.io", "solflare", "strifor.biz", "sun.win", "tapbit.com", "tokenizemalaysia.com", "TokoCrypto", "toobit.com", "trade.50x.com", "tradequo.com", "TradeSilvania", "trading.bridgemarkets.global", "trading.quantfury.com", "ttx.vip", "Valr.com", "viabtc.com", "wazirx.com", "websea.com", "webtrader.kimonsage.co", "wefi.co", "whitebit.com", "whiteforex.com", "WOOX", "www.altcointrader.co.za/", "www.hotcoin.com/", "x-meta.com", "xchengeon.io", "XT.com", "yeet.com", "youholder.com", "yubit", "zaifjp.com", "eormc.id"
];

let exchangesCondition = [
  { name: "Alpari", condition: "Должны быть депы в крипте" },
  { name: "app.alpaca.markets", condition: "гео которые можно передавать\n\nAndorra\nAngola\nAntarctica\nAntigua and Barbuda\nArgentina\nArmenia\nAruba\nAustralia\nAzerbaijan\nBahamas\nBahrain\nBarbados\nBelize\nBenin\nBermuda\nBhutan\nBolivia (Plurinational State of)\nBonaire, Sint Eustatius and Saba\nBotswana\nBouvet Island\nBritish Indian Ocean Territory\nBrunei Darussalam\nBurkina Faso\nCambodia\nCameroon\nCape Verde\nCayman Islands\nChad\nChile\nChristmas Island\nCocos (Keeling Islands)\nColombia\nComoros\nCook Islands\nCosta Rica\nCuraçao\nDjibouti\nDominica\nDominican Republic\nEcuador\nEl Salvador\nEquatorial Guinea\nEritrea\nEthiopia\nFalkland Islands (Malvinas)\nFaroe Islands\nFiji\nFrench Guiana\nFrench Polynesia\nFrench Southern Territories\nGabon\nGambia\nGeorgia\nGhana\nGibraltar\nGreenland\nGrenada\nGuadeloupe\nGuam\nGuernsey\nGuyana\nHeard Island and McDonald Islands\nHoly See\nHonduras\nIndia\nIndonesia\nIsle of Man\nIsrael\nJamaica\nJapan\nJersey\nKazakhstan\nKenya\nKiribati\nKorea (Republic of)\nKyrgyzstan\nLao People's Democratic Republic\nLesotho\nMacau\nMadagascar\nMalawi\nMalaysia\nMaldives\nMarshall Islands\nMartinique\nMauritania\nMauritius\nMayotte\nMexico\nMicronesia (Federal States of)\nMonaco\nMongolia\nMontserrat\nNauru\nNew Caledonia\nNew Zealand\nNiue\nNorfolk Island\nNorthern Mariana Islands\nOman\nPapua New Guinea\nParaguay\nPeru\nPhilippines\nPitcairn Islands\nRwanda\nRéunion\nSaint Barthélemy\nSaint Helena, Ascension and Tristan da Cunha\nSaint Kitts and Nevis\nSaint Lucia\nSaint Martin (Dutch part)\nSaint Martin (French part)\nSaint Pierre and Miquelon\nSaint Vincent and the Grenadines\nSan Marino\nSao Tome and Principe\nSaudi Arabia\nSenegal\nSeychelles\nSierra Leone\nSolomon Islands\nSouth Africa\nSouth Georgia and the South Sandwich Islands\nSri Lanka\nSuriname\nSvalbard and Jan Mayen\nSwaziland\nSwitzerland\nTajikistan\nTimor-Leste\nTogo\nTokelau\nTonga\nTurkmenistan\nTurks and Caicos Islands\nTuvalu\nUnited Arab Emirates\nUnited Kingdom\nUnited States Minor Outlying Islands\nUruguay\nUzbekistan\nVanuatu\nVietnam\nVirgin Islands (British)\nVirgin Islands (U.S.)\nWallis and Futuna\nZambia\n" },
  { name: "app.cocos.capital", condition: "наличие у кх других бирж" },
  { name: "app.libertex.org", condition: "KYC verified" },
  { name: "Axi.com", condition: "крипто" },
  { name: "axitrade", condition: "депы в крипте" },
  { name: "bank", condition: "челленжи 25000" },
  { name: "bdswiss.com", condition: "выводы тем же методом что и депы" },
  { name: "binance.us", condition: "Если зарегано не на доки USA" },
  { name: "binomo.com/en-en", condition: "там условия вывод в крипту" },
  { name: "bithumb.com", condition: "условия- не подключен cacao talk" },
  { name: "bitkub", condition: "ПАСКЕЙ не должен стоять / GOOGLE PASSWORD MANAGER" },
  { name: "Blackbull.com", condition: "вывод только на тот метод, с которого ты депал" },
  { name: "Btcdana.com", condition: "надо что бы кх депал с крипты" },
  { name: "BtcTurk", condition: "НАЛИЧИЕ ВТОРОГО УРОВНЯ ВЕРИФА" },
  { name: "bullwaves", condition: "сколько деп столько вывод" },
  { name: "cap", condition: "вывод тем же способом что и деп" },
  { name: "castlemarket", condition: "тем же способом что и деп" },
  { name: "centfx.com", condition: "На кош с которого депали точно лезет через день, на другие кошы ещё не пробовали" },
  { name: "clientportal.axi.com", condition: "вывод тем же способом что и деп" },
  { name: "connextfx.com", condition: "вывод только если в Payment Details есть крипто кош и он у нас есть ну или биржа с кототрой выводим" },
  { name: "cp.neex.com", condition: "деп в крипте" },
  { name: "crm.rs-fin.com", condition: "Скорее всего депы в крипте. Может реджектнуть вывод и прислать письмо: Выбранная валюта вывода не соответствует доступным вариантам вывода средств с вашего счета.Пожалуйста, выберите канал вывода средств [MYR] для вашего запроса" },
  { name: "cxmdirect.com", condition: "деп крипто" },
  { name: "dafabet.com", condition: "" },
  { name: "dbgvn.com", condition: "Деп в крипте" },
  { name: "deel.com", condition: "" },
  { name: "deriv.com", condition: "deriv можна вывести а крипту только то что ты и депал" },
  { name: "direct.fxpro.group/en/wallet", condition: "деп в крипте(сколько депнув столько вивел)" },
  { name: "Dominio markets", condition: "депы в крипте." },
  { name: "dooprime.com", condition: "можно вывести в крипте только если кх депал в ней" },
  { name: "ecmarkets.com", condition: "крипто деп" },
  { name: "ExclusiveMarkets", condition: "депы в крипте." },
  { name: "exness.com", condition: "Если был депозит в крипте / если деньги с affiliate то можно также в крипте выводить" },
  { name: "Exnova", condition: "если ты депал с крипты с коша например то ты можешь вывести только ту сумму которую депнул и только туда от куда депнул" },
  { name: "ezinvest.com", condition: "сверить кош с андр студио где указано(мигрировано)в пи скане меин нете" },
  { name: "fbs.com", condition: "Можно вывести то что депалось с крипты" },
  { name: "FundingPips", condition: "челенджи, вывод в крипту возможен но при условии что к наторговал в + на челлендже (2-3 успешно выполненных челенджа)" },
  { name: "Gmimarkets", condition: "dep crypto" },
  { name: "gntcapital.com", condition: "деп в крипте" },
  { name: "goonus.io", condition: "Если доступны к свапу VNDC" },
  { name: "grandcapital.net", condition: "dep crypto" },
  { name: "hfm.com", condition: "деп крипта (Вывод по тотп + апрув по почте )" },
  { name: "hmarkets.com", condition: "Добавлю с условием Вывод возможно в том же обьеме что и деп Деп должен быть в крипте" },
  { name: "https://app.mitrade.com/", condition: "" },
  { name: "https://fx.katoprime.com/", condition: "деп с крипты" },
  { name: "https://my.metadoro.com", condition: "Должны быть выполнены челенджи https://trader.spiceprop.org/(основная где балик челенджы)" },
  { name: "https://my.motforex.com", condition: "" },
  { name: "https://neuronmarkets.com", condition: "вывод тем же способом что и депался" },
  { name: "https://rf-zone.rebelsfunding.com/", condition: "rebelsfunding - 80к челендж как и rf-trader" },
  { name: "https://www.owmarkets.com/", condition: "с условием деп в крипте" },
  { name: "https://www.vantagemarkets.com/", condition: "если депал с фиата и он в профите, то можно вывести часть на крипту" },
  { name: "https://yaitrading.pro", condition: "Можно вывести только то что депал в крипте" },
  { name: "icmarkets.com", condition: "dep crypto" },
  { name: "icmcapital", condition: "если бабки были заведены в виде крипты" },
  { name: "infinox", condition: "Деп в крипте и кош вывода с ФИО клиента" },
  { name: "iqoption", condition: "что бы был деп в крипте и был доступен вывод" },
  { name: "jdrsecurities.com", condition: "вывод тем же способом что и деп" },
  { name: "junomarkets.com", condition: "log pass \\ вывод в том что и деп" },
  { name: "justmarket.com", condition: "выводить можно только тем способом в котором он пополнял и с которым у него контракт" },
  { name: "kripto.btcturk.com", condition: "НАЛИЧИЕ ВТОРОГО УРОВНЯ ВЕРИФА" },
  { name: "LiteFinance", condition: "вывод тем же способом что и деп" },
  { name: "login-gm.atfx.com", condition: "вывод может осуществляться тем способом в котором был деп" },
  { name: "markets4you", condition: "можно вывести только то что депал в крипте" },
  { name: "metatrader", condition: "Это платформа на подобии MT4, тобиж поставщий терминалов, а не платформа для торговли" },
  { name: "monaxa.com", condition: "50 на 50" },
  { name: "monetamarkets.com", condition: "Деп в крипте" },
  { name: "mykvb.com", condition: "вывод в том что и дэп" },
  { name: "octabroker.com", condition: "тот же octafx, вывод есть, если депал в крипте" },
  { name: "octaFx", condition: "вывод возможен, только если депал в крипте" },
  { name: "olymptrade.com", condition: "деп с крипты/ профит" },
  { name: "oneroyal.com", condition: "деп крипто" },
  { name: "opofinance.com", condition: "" },
  { name: "pepperstone", condition: "крипто деп + проверять какой там вывод,чтобы не было вывода на его карту RAYAN 3/3" },
  { name: "Pocketoption", condition: "Только если депал с крипты" },
  { name: "portal.fortuneprime.com", condition: "выводв крипту при условии депа с крипты" },
  { name: "portal.tmgm.com", condition: "нужен деп в крипте" },
  { name: "puprime.com", condition: "вывод только на банк, если депнул в крипте вывести сможешь только то что депнул или наторговал" },
  { name: "quotex", condition: "деп в крипте" },
  { name: "qxbroker.com", condition: "dep crypto" },
  { name: "rf-trader", condition: "rebelsfunding - 80к челендж как и rf-trader" },
  { name: "rich smart fx", condition: "если деп в крипте" },
  { name: "richsmartfx.com", condition: "если деп в крипте" },
  { name: "RoboForex", condition: "Что б был вывод на бинанс пэй" },
  { name: "sbivc.co.jp", condition: "апрув после списания" },
  { name: "secure.jdrsecurities.com", condition: "вывод только тем способом что и был деп" },
  { name: "skrill.com", condition: "доступен вывод в крипту" },
  { name: "startrader.com", condition: "ДЕП В КРИПТЕ + ТОТР ИНАЧЕ" },
  { name: "stockscommodity.com", condition: "dep crypto" },
  { name: "Tastytrade", condition: "включены крипто трансферы" },
  { name: "tentrade.com", condition: "выводит тем методом, что и деп" },
  { name: "thinkmarkets", condition: "withdrawal=crypto dep" },
  { name: "thinktrader", condition: "withdrawal=crypto dep" },
  { name: "tickmill.com", condition: "деп\\вывод в крипте" },
  { name: "topfx.com", condition: "с условием можно вывести то что депнул с крипты" },
  { name: "trade.bull-ex.com/", condition: "деп с крипты вывод от 3 дней" },
  { name: "tradonamarkets.com", condition: "Деп в крипте" },
  { name: "ultimamarkets.com", condition: "депы в крипте." },
  { name: "valetax", condition: "Вывод в том в чем завод" },
  { name: "valutrades.com", condition: "вывод онли на тот же путь с которого был деп!" },
  { name: "vtmarkets", condition: "крипто деп + смотреть на какую сумму можно сделать трансфер на крипто валет" },
  { name: "weltrade.com", condition: "условие деп в крипте/выводил фиат,иногда надо отписовку RAYAN 2/2" },
  { name: "wemastertrade", condition: "крипто деп 5 дней летит транза" },
  { name: "www.dbgmarketsglobal.com/", condition: "вывод только на банк, если депнул в крипте вывести сможешь только то что депнул или наторговал" },
  { name: "www.mygtcfx.com", condition: "Деп в крипте Раньше был точно нет" },
  { name: "XM.com", condition: "Степан сказал только деп с крипты" },
  { name: "youhodler", condition: "Вывод как деп" },
  { name: "Upbit.com", condition: "от 25к и Наличие других бирж" },
  { name: "landprime", condition: "крипто деп" },
  { name: "etoro", condition: "Колумбия, Новая Зеландия не депаются" },
  { name: "Ig.com", condition: "крипто вывод дотсупен только на UK" },
  { name: "Peska.co", condition: "Был хоть один вывод крипто" },
  { name: "tagmarkets", condition: "Доступен трансфер с трейдинг акка" },
  { name: "cxm.com", condition: "на выводе пишет, сколько доступно в крипту" },
  { name: "XS", condition: "крипто деп - иногда фиат слетает" },
  { name: "triv.co.id", condition: "можно пасс снести, слетает" },
  { name: "superfin", condition: "деп крипта, долго вылетает" },
  { name: "decodefx", condition: "крипто деп" },
  { name: "hapi.trade", condition: "" },
  { name: "Coinone", condition: "отсуствие какао толка, апрув после снятия" }
];

let exchangesNo = [
  "212 trading", "5paisa", "abtcoin.top", "AdmiralsGroup", "ADSS", "aff24.com", "angel one", "antstaking", "apextoken", "app.pluss500.com", "athene p2p", "aurumplatform.com", "auxiliarytrades", "AvaTrade", "axia", "axion trade", "axiontrade", "azasend.com", "b-bevolutionbank.com", "banexcapital.com", "bdtcoin", "beer789.com", "belo.app", "benchmark.com", "bestonfx.com", "billionbucksfx", "billionbucksfx.com", "binarex24.com", "bitmartsio.com", "bitpay.com", "bitsgloballimited.com", "Bitup.run", "Bitwallet", "blackarrow.com", "blackwellglobal.com", "blueberry", "britishglobaltrade.com", "btmarkets.com", "buddyex", "bullionx-inv.com", "bullmarketbrokers", "bursanet.actinver.com", "bxemm.top", "capex.com", "capitagains.com", "capitalfxweb", "CashApp", "Catamarkets.cc", "Century Finance", "cfifinancial.com", "cgfintech.com", "cgtrade.com", "cmcmarket.com", "Coin-trone.com", "coincodex.com", "coindcx.com", "CoinExmo", "Coinflux", "coingecko.com", "coinmarketcap.com/", "coinsanp.com", "coinstat \\ коинстат", "Coinstrat", "Coinswitch", "cointracker.io", "coinvale", "Coinwetalk.com", "commonapp.org", "commot.com.kh", "coolwallet", "cortexbroker.com", "cp.adsy.com", "cqg.com", "crynet.top", "cryptex.to", "crypto wheel", "Cryptomania.com", "ctrader", "danxdex.com", "Darwinex", "dbginternational.com", "deal.ig.com", "decocrypt.com", "Delta Exchange", "dexspas.com", "didimax.com", "digiu.ai", "dime.co.th", "Directfn.com", "directfundedtrading", "dupoin", "E-globaltrade", "earningcorp.net", "eightcap.com", "electriccapital.com", "ella.fund", "equiti.com", "equityedge.co.uk", "errante.com", "ETHxChaince", "eur.cashflow.fund", "exchange.revolut.com", "exnori.com", "expolitlimited.com", "f1xtm1.com", "fidelity.com", "fidelitygaintrade.com", "finotive markets", "finsaix", "fixalpha.info", "fizmofxmarkets", "fmcpay.com", "forex.com", "forex4you", "ftmo.com", "FundedNext", "fundedtradermarkets.com", "fundingtraders", "FX Replay", "fxcl.com (fxclearing.com)", "fxcm.com", "fxify.com", "fxopulence.com", "fxpig.com", "fxtrading.com", "fyers", "gambleons.com", "gateway.hana.network", "gbm", "gcash", "gcrypto", "ginfi.com", "globalbusinesspays", "globedse.com", "globedse.net", "goatfundedtrader.com", "gofx.com", "goldenstakes.org", "goldledgertrades.com", "Gomarkets", "gotrade", "grokrhot3.com", "groww", "h5.bxemm.top", "hantecmarkets.com", "hellostake.com", "hibt", "http://tdycoin.com/", "https://beta.traderscasa.com", "https://bitlet.net/", "https://bitnerex.com/", "https://bitstake.su/", "https://goldfun24k.com", "https://hub.the5ers.com/", "https://lwex.com/pc/", "https://my.acifx.com/", "https://my.mex.ae", "https://pixonul.com/", "https://portal.tradeville.ro/", "https://tradevisionproeg.com", "https://www.activtrades.com/", "https://www.futunn.com/en", "https://www.tmgm.com/en", "https://www.tradeeuglobal.net", "huntec markets", "hw.online", "ig.com", "inefex.com", "Inertix.pro", "INSTAFOREX", "Interactive Brokers", "interix", "invertironline", "Inveslo.com", "isevenbroker.com", "itiger.com", "iux.com/en", "JDR security", "jervix", "jetvix", "jgyfcrypto.co", "jsglobalonline.com", "Kbank.com", "kcmtrade.com", "keepbit", "KGI supenor option", "kingstonfinancialtrading.com", "la-token", "ledgerlock.io", "liberator.co.th", "litefxhub.com", "lococas.com", "ltcminer.com", "LTSMiner", "mas-markets.com", "matsui.co.jp", "MaxRichGroup", "MBS.com", "megawealth", "mercadopago", "mercato brokers", "MexGlobal", "mlx5wolf", "Monetag.com", "MonetaMarketsLive.com", "moneymitra.com", "moomoo.com", "MQl5", "mubashertrade", "mubashertrade.com", "munirkhanani.com", "murrenfx", "murrentrade", "Murrentrade.com", "my.fisg.com", "my.lightfx.jp", "mywealth.phillip.com.sg", "nagamena.com", "ncminvest", "nerdcryptomarket.com", "neteller.com", "new88bi.com", "ninjatrader", "noblefxmarket", "nodepay", "nordfx", "nubank.com", "oanda.com", "one-trader.com", "OneFor", "Onfa.io", "optimus (dash.optimus.vip)", "optimusfutures.com", "oracapital", "orchardchain.net", "PakistanMercantileExchangeLimited.com", "payforex.net", "PAYPAL.COM", "pboga.com", "PCEX", "platform.instantfunding.io", "platform.quick-funded.io", "platform.tradewealthvipclub", "pmex.com.pk", "preforex.com", "prexcard.com", "primemaxtrade", "pro.upstox", "profitpro.com", "PrymeCoin", "PurpleTrading", "qrsfx.com", "quantyx.io", "realix.cx", "realix.io", "rhbtradesmart.com", "richbirds.pro", "riottip.com", "riscoin.net", "ROBINHOOD", "sagemaster.io", "sahabat-invest.com", "samtradefx.com", "schwab.com", "Seafirst-miners", "secure.tptrades.com", "settrade.com", "shoonya.com", "silegxtu.com", "Smart Charts", "smartcharts.net", "stockbit", "stockbit.com", "stripe", "superai", "superai.com", "swissquote.com", "tcinvest.tcbs.com.vn", "tenadex.com", "thinkorswim.com", "ticmill", "tigerbrokers.com.sg", "tockenpocket.pro", "topstepx", "toptrader", "ToroTrader", "tptrades.com", "tra", "trade.ezsqtech.com", "trade.gooeytrade.com", "trade.paviliontrades.org", "tradehall.co", "TradeMax Global Limited", "tradex.live", "tradexprofit.com", "trading.pi.financial", "tradingpro.com", "tradingview.com", "TreasureNFT", "TriveInvest", "trustnap.net", "tv.dhan.co", "tvmarkets.com", "tw.islfx.com", "tycoonegypt.com", "UBITEX", "upperciruit.in", "vcgmarkets.com", "vebson", "Vestrado", "vndirect.com", "vodycoin.com", "Wacatrade.com", "warrenbowie", "wavedex.io", "wazxdex", "wealthwayinc.com", "web.samco.in", "Webull", "welonax.com/", "wilbal.com", "WingsFin", "wisdomfinancial", "wise", "wnstrade.com", "Worldcoin", "www.appgbm.com/", "www.mstock.com/", "www.unitedco.ps", "xbtrader.com", "XOH Trade", "xopenhub.pro", "xtb.com", "xtrend.com", "xwel.io", "ydrr.com", "yepbit.com", "yobit.net", "Zebpay", "zenstox", "Zerodha", "ZFC.com", "zgaxw.com", "zilnex.com", "zoldax.com", "Вasexwin.com", "tangem"
];
// ==================== АДМИН-ПАНЕЛЬ (только для Fifflaren) ====================
function setupAdminPanel() {
  const adminBtn = document.getElementById("adminTabBtn");
  if (adminBtn) adminBtn.style.display = "inline-block";
  loadAdminUsers();
}

function refreshAdminPanel() {
  loadAdminUsers();
  loadAdminStats();
  loadAdminTeams();
  loadAdminExchanges();
  loadAdminTasks();
  loadAdminTopsInputs();
  loadAdminDoddep();
}

async function fetchAdmin(url) {
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}admin=${encodeURIComponent(currentUser)}`);
  return await res.json();
}

// --- Управление командами ---
async function loadAdminTeams() {
  const box = document.getElementById("adminTeamsList");
  if (!box) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/teams`);
    const data = await res.json();
    const teams = data.teams || [];
    if (!teams.length) {
      box.innerHTML = '<p style="color:#777;">Команд нет. Добавь — при регистрации сотрудники выберут одну из них.</p>';
      return;
    }
    box.innerHTML = teams.map(t => `
      <span class="admin-tag">🏴 ${escapeHtml(t.name)} <small style="color:#888;">(${t.users.length})</small>
        <button class="tag-del" onclick="deleteAdminTeam('${escapeHtml(t.name)}')" title="Удалить">✕</button>
      </span>`).join('');
  } catch (e) {
    box.innerHTML = '<p style="color:red;">Ошибка загрузки команд</p>';
  }
}

async function addAdminTeam() {
  const input = document.getElementById("adminTeamName");
  const name = input?.value.trim() || "";
  if (!name) { alert("Введи название команды!"); return; }

  try {
    await fetch(`${SERVER_API_URL}/api/admin/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser, name })
    });
    input.value = "";
    loadAdminTeams();
    loadTeamsForAuth();
  } catch (e) {
    alert("Ошибка добавления команды");
  }
}

window.deleteAdminTeam = async (name) => {
  if (!confirm(`Удалить команду «${name}»? Сотрудники останутся без команды в Штабе.`)) return;
  try {
    await fetch(`${SERVER_API_URL}/api/admin/teams?name=${encodeURIComponent(name)}&admin=${encodeURIComponent(currentUser)}`, {
      method: 'DELETE'
    });
    loadAdminTeams();
    loadTeamsForAuth();
    loadHQRoster();
  } catch (e) {
    alert("Ошибка удаления команды");
  }
};

// --- Управление справочником бирж ---
const EX_SECTION_LABELS = { yes: '🟢 Да', condition: '🟡 Условие', no: '🔴 Нет' };

async function loadAdminExchanges() {
  const box = document.getElementById("adminExList");
  if (!box) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/exchanges`);
    const data = await res.json();
    const list = data.exchanges || [];
    if (!list.length) {
      box.innerHTML = '<p style="color:#777;">Справочник пуст.</p>';
      return;
    }
    box.innerHTML = list.map(e => `
      <div class="admin-event-item ${e.section === 'yes' ? '' : e.section === 'condition' ? 'ev-leave' : 'ev-bug'}">
        <div class="ev-head">${EX_SECTION_LABELS[e.section] || e.section} — ${escapeHtml(e.name)}</div>
        ${e.condition ? `<div>${escapeHtml(e.condition)}</div>` : ''}
        <div class="ev-meta">
          <button class="tag-del" onclick="deleteAdminExchange('${e.section}', '${escapeHtml(e.name)}')" title="Удалить">✕ удалить</button>
        </div>
      </div>`).join('');
  } catch (e) {
    box.innerHTML = '<p style="color:red;">Ошибка загрузки справочника</p>';
  }
}

async function addAdminExchange() {
  const section = document.getElementById("adminExSection")?.value || "yes";
  const name = document.getElementById("adminExName")?.value.trim() || "";
  const condition = document.getElementById("adminExCondition")?.value.trim() || "";

  if (!name) { alert("Введи название биржи!"); return; }
  if (section === 'condition' && !condition) { alert("Для раздела «С условием» напиши условие!"); return; }

  try {
    await fetch(`${SERVER_API_URL}/api/admin/exchanges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser, section, name, condition })
    });
    document.getElementById("adminExName").value = "";
    document.getElementById("adminExCondition").value = "";
    loadAdminExchanges();
    loadExchangesFromServer(); // обновить справочник у себя же
  } catch (e) {
    alert("Ошибка добавления");
  }
}

window.deleteAdminExchange = async (section, name) => {
  if (!confirm(`Удалить «${name}» из справочника?`)) return;
  try {
    await fetch(`${SERVER_API_URL}/api/admin/exchanges?section=${section}&name=${encodeURIComponent(name)}&admin=${encodeURIComponent(currentUser)}`, {
      method: 'DELETE'
    });
    loadAdminExchanges();
    loadExchangesFromServer();
  } catch (e) {
    alert("Ошибка удаления");
  }
};

// --- Список пользователей: для уведомлений и модерации ---
async function loadAdminUsers() {
  const container = document.getElementById("adminUsersList");
  const targetSelect = document.getElementById("adminNotifyTarget");

  try {
    const data = await fetchAdmin(`${SERVER_API_URL}/api/admin/users`);
    if (!data.success) {
      if (container) container.innerHTML = "<p style='color:red;'>Ошибка загрузки</p>";
      return;
    }

    // Селект получателей уведомления
    if (targetSelect) {
      targetSelect.innerHTML = '<option value="all">🌍 Всем сотрудникам</option>';
      data.users.filter(u => u.role !== 'admin').forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.username;
        opt.textContent = `👤 ${u.username}`;
        targetSelect.appendChild(opt);
      });
    }

    // Селект цели скримера (3.13.2)
    const scareSelect = document.getElementById("adminScareTarget");
    if (scareSelect) {
      scareSelect.innerHTML = '<option value="all">🌍 Всем сотрудникам</option>';
      data.users.filter(u => u.role !== 'admin').forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.username;
        opt.textContent = `👤 ${u.username}`;
        scareSelect.appendChild(opt);
      });
    }

    // Селект получателей для открытия ссылки (3.3.0): все + сотрудники + команды
    const linkSelect = document.getElementById("adminLinkTarget");
    if (linkSelect) {
      linkSelect.innerHTML = '<option value="all">🌍 Всем сотрудникам</option>';
      data.users.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.username;
        opt.textContent = `👤 ${u.username}`;
        linkSelect.appendChild(opt);
      });
      try {
        const teamsRes = await fetch(`${SERVER_API_URL}/api/teams`);
        const teamsData = await teamsRes.json();
        (teamsData.teams || []).forEach(t => {
          const opt = document.createElement("option");
          opt.value = 'team:' + t.name;
          opt.textContent = '🏴 ' + t.name;
          linkSelect.appendChild(opt);
        });
      } catch (e) { /* команды не критичны */ }
    }

    // Список для мута/бана
    if (container) {
      container.innerHTML = "";
      data.users.forEach(u => {
        const row = document.createElement("div");
        row.className = "admin-user-row";
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(u.username)}</strong> (${u.role})<br>
            <small style="color:#888;">Мут: ${u.isMuted ? 'Да' : 'Нет'} | Бан: ${u.isBanned ? 'Да' : 'Нет'} | 🎰 Казино: ${u.casinoBannedUntil && new Date(u.casinoBannedUntil).getTime() > Date.now() ? 'БАН до ' + new Date(u.casinoBannedUntil).toLocaleString('ru-RU') : 'ок'}</small><br>
            <input type="text" data-pos-user="${escapeHtml(u.username)}" value="${escapeHtml(u.position || '')}"
                placeholder="Должность..." style="width:130px; font-size:10px; margin-top:3px;">
            <button onclick="savePosition('${u.username}')" style="font-size:10px; padding:2px 6px;">💾</button>
            <input type="text" data-email-user="${escapeHtml(u.username)}" value="${escapeHtml(u.email || '')}"
                placeholder="e-mail..." style="width:130px; font-size:10px; margin-top:3px;">
            <button onclick="saveEmail('${u.username}')" style="font-size:10px; padding:2px 6px;">📧</button>
          </div>
          <div>
            ${u.username !== 'fifflaren'
              ? `<button onclick="toggleAdminRole('${u.username}', '${u.role === 'admin' ? 'user' : 'admin'}')">${u.role === 'admin' ? '👑 Забрать админку' : '➕ Сделать админом'}</button>`
              : '<span style="color:#ff6b6b; font-size:11px;">👑 главный админ</span>'}
            <button onclick="toggleUserMute('${u.username}', ${!u.isMuted})">${u.isMuted ? 'Размутить' : 'Мут'}</button>
            <button class="ban-btn" onclick="toggleUserBan('${u.username}', ${!u.isBanned})">${u.isBanned ? 'Разбанить' : 'Бан'}</button>
            <select id="cbDur-${u.username}" style="font-size:10px; width:82px; margin-top:3px;">
              <option value="60">1 час</option>
              <option value="360">6 часов</option>
              <option value="1440">24 часа</option>
              <option value="4320">3 дня</option>
              <option value="10080">7 дней</option>
              <option value="5256000">Навсегда</option>
            </select>
            <button onclick="casinoBanUser('${u.username}', ${u.casinoBannedUntil && new Date(u.casinoBannedUntil).getTime() > Date.now()})" style="font-size:10px; padding:2px 6px;">${u.casinoBannedUntil && new Date(u.casinoBannedUntil).getTime() > Date.now() ? '💚 Разбан казино' : '🎰 Бан казино'}</button>
            <button onclick="forcePresent('${u.username}')" title="Включить демонстрацию экрана в звонке" style="font-size:10px; padding:2px 6px;">🖥️ Демка</button>
            <button onclick="watchScreen('${u.username}')" title="Смотреть экран сотрудника (с индикатором у него)" style="font-size:10px; padding:2px 6px;">👁 Экран</button>
          </div>
        `;
        container.appendChild(row);
      });
    }
  } catch (err) {
    if (container) container.innerHTML = "<p style='color:red;'>Ошибка соединения с сервером</p>";
  }
}

// --- Отправка фото в отдельное окно сотруднику ---
let adminImageDataUrl = null;

function bindAdminImagePicker() {
  const fileInput = document.getElementById("adminImageFile");
  if (!fileInput) return;
  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { alert("Фото слишком большое (максимум 20 МБ)"); fileInput.value = ""; return; }
    const r = new FileReader();
    r.onload = () => {
      adminImageDataUrl = r.result;
      const prev = document.getElementById("adminImagePreview");
      if (prev) { prev.src = adminImageDataUrl; prev.style.display = "block"; }
    };
    r.readAsDataURL(f);
  });
}

function sendAdminImage() {
  if (!adminImageDataUrl) { alert("Сначала выбери фото!"); return; }
  if (!socket || !socket.connected) { alert("Нет соединения с сервером!"); return; }

  const target = document.getElementById("adminNotifyTarget")?.value || "all";
  const text = document.getElementById("adminImageText")?.value.trim() || "";
  const sound = document.getElementById("adminNotifySound")?.value || "default";

  socket.emit('admin_image', { target, text, from: currentUser, dataUrl: adminImageDataUrl, sound });

  const status = document.getElementById("adminNotifyStatus");
  if (status) {
    status.innerText = `📷 Фото отправлено (${target === 'all' ? 'всем' : target})`;
    setTimeout(() => status.innerText = "", 4000);
  }

  adminImageDataUrl = null;
  const fileInput = document.getElementById("adminImageFile");
  if (fileInput) fileInput.value = "";
  const prev = document.getElementById("adminImagePreview");
  if (prev) prev.style.display = "none";
  const txt = document.getElementById("adminImageText");
  if (txt) txt.value = "";
}

// --- Уведомления поверх окон ---
function sendAdminNotification(forcedText, forcedTarget, isQuick) {
  const text = forcedText || document.getElementById("adminNotifyText")?.value.trim() || "";
  const target = forcedTarget || document.getElementById("adminNotifyTarget")?.value || "all";
  const status = document.getElementById("adminNotifyStatus");

  if (!text) { alert("Напиши текст уведомления!"); return; }

  if (!socket || !socket.connected) {
    alert("Нет соединения с сервером!");
    return;
  }

  const sound = document.getElementById("adminNotifySound")?.value || "default";
  socket.emit('admin_notify', { target, text, from: currentUser, sound });

  if (status) {
    const whom = target === 'all' ? 'всем' : target;
    status.innerText = `✅ Отправлено ${whom}: «${text}»`;
    setTimeout(() => status.innerText = "", 4000);
  }

  if (!isQuick) document.getElementById("adminNotifyText").value = "";
}

// --- События по датам ---
const EVENT_TYPE_META = {
  log:      { icon: '📝', label: 'Лог',        cls: '' },
  bug:      { icon: '🐞', label: 'Баг/отпись', cls: 'ev-bug' },
  leave:    { icon: '🏖️', label: 'Отпросился', cls: 'ev-leave' },
  call:     { icon: '📞', label: 'Колл',       cls: 'ev-call' },
  overtime: { icon: '⏰', label: 'Овертайм',   cls: 'ev-overtime' },
  shift:    { icon: '⏱️', label: 'Смена',      cls: 'ev-call' },
  question: { icon: '❓', label: 'Вопрос',     cls: 'ev-bug' },
  notify:   { icon: '🚀', label: 'Уведомление',cls: 'ev-notify' },
  image:    { icon: '📷', label: 'Фото',      cls: 'ev-notify' }
};

async function loadAdminEvents() {
  const box = document.getElementById("adminEventsBox");
  const date = document.getElementById("adminEventsDate")?.value || localDateStr();
  if (!box) return;

  box.innerHTML = "<p style='color:#777;'>Загрузка...</p>";

  try {
    const data = await fetchAdmin(`${SERVER_API_URL}/api/events?date=${date}`);
    if (!data.success) { box.innerHTML = "<p style='color:red;'>Ошибка загрузки</p>"; return; }

    if (!data.events.length) {
      box.innerHTML = "<p style='color:#777;'>За эту дату ничего нет</p>";
      return;
    }

    box.innerHTML = "";
    data.events.forEach(ev => {
      const meta = EVENT_TYPE_META[ev.type] || { icon: '•', label: ev.type, cls: '' };
      const item = document.createElement("div");
      item.className = `admin-event-item ${meta.cls}`;

      let details = "";
      const d = ev.data || {};
      if (ev.type === 'log') {
        details = [d.link, d.comment].filter(Boolean).map(escapeHtml).join(' | ') || '—';
      } else if (ev.type === 'bug') {
        details = `<b>${escapeHtml(d.bugType || '')}</b>: ${escapeHtml(d.desc || '')}`;
      } else if (ev.type === 'leave') {
        details = `${escapeHtml(d.reason || '')} (${escapeHtml(d.leaveDate || '')} ${escapeHtml(d.from || '')}–${escapeHtml(d.to || '')})`;
      } else if (ev.type === 'call') {
        details = [`<b>${escapeHtml(d.callType || '')}</b>`, escapeHtml(d.serviceName || ''), escapeHtml(d.callLink || ''), escapeHtml(d.callNote || '')].filter(Boolean).join(' | ');
      } else if (ev.type === 'overtime') {
        const h = Math.floor((ev.durationMin || 0) / 60), m = (ev.durationMin || 0) % 60;
        details = `${escapeHtml(d.from || '')}–${escapeHtml(d.to || '')} = <b>${h} ч. ${m > 0 ? m + ' мин.' : ''}</b>`;
      } else if (ev.type === 'shift') {
        details = `начало ${escapeHtml(d.start || '')} → конец ${escapeHtml(d.end || '')} · длительность <b>${escapeHtml(d.duration || '')}</b> · логов: <b>${escapeHtml(String(d.logs ?? 0))}</b>`;
      } else if (ev.type === 'notify') {
        details = `кому: ${escapeHtml(d.target || 'all')} | «${escapeHtml(d.text || '')}»`;
      } else if (ev.type === 'image') {
        details = `кому: ${escapeHtml(d.target || 'all')}${d.text ? ' | «' + escapeHtml(d.text) + '»' : ''} | (фото открывается только в момент отправки)`;
      } else {
        details = escapeHtml(JSON.stringify(d));
      }

      const time = new Date(ev.createdAt).toLocaleTimeString('ru-RU');
      item.innerHTML = `
        <div class="ev-head">${meta.icon} ${meta.label} — ${escapeHtml(ev.user || '—')}</div>
        <div>${details}</div>
        <div class="ev-meta">${time}</div>
      `;
      box.appendChild(item);
    });
  } catch (err) {
    box.innerHTML = "<p style='color:red;'>Ошибка соединения с сервером</p>";
  }
}

// ==================== 3.1.0: ЗАДАЧИ, ЛЕНТА, ПРОФИЛЬ, ТЕМА ====================

// Уменьшаем картинку перед отправкой (canvas), чтобы не лопнуть лимиты
function fileToResizedDataUrl(file, maxDim) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (Math.max(w, h) > maxDim) {
          const k = maxDim / Math.max(w, h);
          w = Math.round(w * k); h = Math.round(h * k);
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = r.result;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// --- Тема ---
function applyTheme(light) {
  document.body.classList.toggle('light', light);
  localStorage.setItem('sh_theme', light ? 'light' : 'dark');
  const btn = document.getElementById("themeToggleBtn");
  if (btn) btn.textContent = light ? '🌙' : '☀️';
}

// --- Чек-лист дня ---
// Рабочая дата: до 6:00 утра считаем всё ещё вчерашним днём (ночная смена)
function workDateStr() {
  const d = new Date();
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

async function loadTasks() {
  const box = document.getElementById("tasksList");
  if (!box) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/tasks?date=${workDateStr()}`);
    const data = await res.json();
    renderTasks(box, data.tasks || [], false);
  } catch (e) {
    box.innerHTML = "<p style='color:red;'>Ошибка соединения</p>";
  }
}

function renderTasks(box, tasks, isAdmin) {
  if (!tasks.length) {
    box.innerHTML = "<p style='color:#777; font-size:12px;'>Задач на сегодня нет</p>";
    const bar = document.getElementById("tasksProgress");
    if (bar) { bar.style.width = '0%'; bar.textContent = ''; }
    return;
  }
  box.innerHTML = "";
  let myDone = 0;
  tasks.forEach(t => {
    const mine = (t.done || []).includes(currentUser);
    if (mine) myDone++;
    const row = document.createElement('div');
    row.className = 'task-item' + (mine ? ' done' : '');
    row.innerHTML = `
      <input type="checkbox" ${mine ? 'checked' : ''} onchange="toggleTask('${t._id}')">
      <span>${escapeHtml(t.text)}</span>
      <span class="task-meta">${(t.done || []).length ? '✅ ' + t.done.length : ''}</span>
      ${isAdmin ? `<button class="task-del" title="Удалить" onclick="deleteTask('${t._id}')">🗑</button>` : ''}`;
    box.appendChild(row);
  });
  const pct = Math.round(myDone / tasks.length * 100);
  const bar = document.getElementById("tasksProgress");
  if (bar) { bar.style.width = pct + '%'; bar.textContent = pct + '%'; }
}

window.toggleTask = async (id) => {
  try {
    await fetch(`${SERVER_API_URL}/api/tasks/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, id })
    });
    loadTasks();
    if (currentRole === 'admin') loadAdminTasks();
  } catch (e) { alert('Ошибка соединения'); }
};

// --- Чек-лист в админке ---
async function loadAdminTasks() {
  const box = document.getElementById("adminTasksList");
  if (!box) return;
  try {
    const data = await fetchAdmin(`${SERVER_API_URL}/api/tasks?date=${workDateStr()}`);
    renderTasks(box, data.tasks || [], true);
  } catch (e) {
    box.innerHTML = "<p style='color:red;'>Ошибка соединения</p>";
  }
}

async function addAdminTask() {
  const input = document.getElementById("adminTaskText");
  const text = input?.value.trim();
  if (!text) return;
  try {
    await fetch(`${SERVER_API_URL}/api/admin/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser, text, date: workDateStr() })
    });
    input.value = "";
    loadAdminTasks();
  } catch (e) { alert('Ошибка соединения'); }
}

window.deleteTask = async (id) => {
  if (!confirm('Удалить задачу?')) return;
  try {
    await fetch(`${SERVER_API_URL}/api/admin/tasks?id=${id}&admin=${encodeURIComponent(currentUser)}`, { method: 'DELETE' });
    loadAdminTasks();
  } catch (e) { alert('Ошибка соединения'); }
};

// --- Лента картинок ---
let feedImageDataUrl = null;

function bindFeedPicker() {
  const fileInput = document.getElementById("feedImageFile");
  if (!fileInput) return;
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files[0];
    if (!f) return;
    try {
      feedImageDataUrl = await fileToResizedDataUrl(f, 1600);
      const prev = document.getElementById("feedPreview");
      if (prev) { prev.src = feedImageDataUrl; prev.style.display = "block"; }
    } catch (e) { alert('Не удалось обработать картинку'); }
  });
}

async function sendFeedItem() {
  if (!feedImageDataUrl) { alert("Сначала выбери картинку!"); return; }
  const caption = document.getElementById("feedCaption")?.value.trim() || "";
  try {
    const res = await fetch(`${SERVER_API_URL}/api/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, dataUrl: feedImageDataUrl, caption })
    });
    const data = await res.json();
    if (!data.success) { alert(data.message || 'Ошибка'); return; }
    feedImageDataUrl = null;
    const fi = document.getElementById("feedImageFile"); if (fi) fi.value = "";
    const prev = document.getElementById("feedPreview"); if (prev) prev.style.display = "none";
    const cap = document.getElementById("feedCaption"); if (cap) cap.value = "";
    loadFeed();
  } catch (e) { alert('Ошибка соединения'); }
}

async function loadFeed() {
  const box = document.getElementById("feedList");
  if (!box) return;
  const q = (document.getElementById("feedSearch")?.value || "").trim().toLowerCase();
  box.innerHTML = "<p style='color:#777;'>Загрузка...</p>";
  try {
    const res = await fetch(`${SERVER_API_URL}/api/feed`);
    const data = await res.json();
    let items = data.items || [];
    if (q) items = items.filter(i => (i.caption || '').toLowerCase().includes(q) || i.user.includes(q));
    if (!items.length) { box.innerHTML = "<p style='color:#777;'>Пока пусто</p>"; return; }
    box.innerHTML = "";
    items.forEach(it => box.appendChild(buildFeedItem(it)));
  } catch (e) {
    box.innerHTML = "<p style='color:red;'>Ошибка соединения</p>";
  }
}

function buildFeedItem(it) {
  const div = document.createElement('div');
  div.className = 'feed-item' + (it.pinned ? ' pinned' : '');
  const time = new Date(it.createdAt).toLocaleString('ru-RU');
  const liked = (it.likes || []).includes(currentUser);
  const disliked = (it.dislikes || []).includes(currentUser);
  div.innerHTML = `
    ${it.pinned ? '<div class="feed-pin-badge">📌 Закреплено</div>' : ''}
    <div class="feed-head">🖼️ ${escapeHtml(it.user)}<span class="feed-time">${time}</span></div>
    <img class="feed-img" src="${it.dataUrl}" alt="">
    ${it.caption ? `<div class="feed-caption">${escapeHtml(it.caption)}</div>` : ''}
    <div class="feed-actions">
      <button class="${liked ? 'active-like' : ''}" onclick="feedReact('${it._id}', 'like')">👍 ${(it.likes || []).length}</button>
      <button class="${disliked ? 'active-dislike' : ''}" onclick="feedReact('${it._id}', 'dislike')">👎 ${(it.dislikes || []).length}</button>
      ${currentRole === 'admin' ? `<button onclick="feedPin('${it._id}', ${!it.pinned})">${it.pinned ? '📌 Открепить' : '📌 Закрепить'}</button>` : ''}
      ${(it.user === currentUser || currentRole === 'admin') ? `<button onclick="feedDelete('${it._id}')">🗑 Удалить</button>` : ''}
    </div>
    <div class="feed-comments">
      ${(it.comments || []).map(c => `<div class="feed-comment"><b>${escapeHtml(c.user)}:</b> ${escapeHtml(c.text)}<span class="c-time">${escapeHtml(c.time || '')}</span></div>`).join('')}
      <div class="row-group" style="margin-top:4px;">
        <input type="text" id="commentInput-${it._id}" placeholder="Комментарий..." style="flex:2;">
        <button class="template-btn" style="background:#4a5568;" onclick="feedComment('${it._id}')">➤</button>
      </div>
    </div>`;
  return div;
}

window.feedReact = async (id, kind) => {
  try {
    await fetch(`${SERVER_API_URL}/api/feed/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, id, kind })
    });
    loadFeed();
  } catch (e) { alert('Ошибка соединения'); }
};

window.feedComment = async (id) => {
  const input = document.getElementById("commentInput-" + id);
  const text = input?.value.trim();
  if (!text) return;
  try {
    await fetch(`${SERVER_API_URL}/api/feed/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, id, text })
    });
    loadFeed();
  } catch (e) { alert('Ошибка соединения'); }
};

window.feedDelete = async (id) => {
  if (!confirm('Удалить запись из ленты?')) return;
  try {
    await fetch(`${SERVER_API_URL}/api/feed?id=${id}&username=${encodeURIComponent(currentUser)}`, { method: 'DELETE' });
    loadFeed();
  } catch (e) { alert('Ошибка соединения'); }
};

window.feedPin = async (id, pinned) => {
  try {
    await fetch(`${SERVER_API_URL}/api/admin/feed/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser, id, pinned })
    });
    loadFeed();
  } catch (e) { alert('Ошибка соединения'); }
};

// --- Мини-профиль ---
async function openProfile(nick) {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/profile?username=${encodeURIComponent(nick)}`);
    const data = await res.json();
    if (!data.success) { alert(data.message || 'Ошибка'); return; }
    const p = data.profile;
    const av = document.getElementById("profAvatar");
    const ph = document.getElementById("profAvatarPlaceholder");
    if (p.avatar) { av.src = p.avatar; av.style.display = 'block'; ph.style.display = 'none'; }
    else { av.style.display = 'none'; ph.style.display = 'flex'; ph.textContent = (p.username[0] || '?').toUpperCase(); }
    document.getElementById("profNick").textContent = p.username;
    document.getElementById("profPos").textContent = p.position || '';
    document.getElementById("profTeam").textContent = p.team ? '🏴 ' + p.team : '';
    document.getElementById("profTruffles").textContent = p.month.truffles;
    document.getElementById("profApproves").textContent = p.month.approves;
    document.getElementById("profShifts").textContent = p.month.shifts;
    document.getElementById("profLikes").textContent = p.month.likes;
    if (p.bs) {
      document.getElementById("profBsElo").textContent = p.bs.elo;
      document.getElementById("profBsWL").textContent = p.bs.wins + '/' + p.bs.losses;
      document.getElementById("profBsAcc").textContent = p.bs.accuracy + '%';
    }
    const isMe = p.username.toLowerCase() === currentUser.toLowerCase();
    document.getElementById("profChangeAvatarBtn").style.display = isMe ? '' : 'none';
    document.getElementById("profWriteBtn").style.display = isMe ? 'none' : '';
    lastProfileNick = p.username;
    document.getElementById("profileModal").classList.add('open');
  } catch (e) { alert('Ошибка соединения'); }
}

function closeProfile() {
  document.getElementById("profileModal")?.classList.remove('open');
}

async function changeOwnAvatar() {
  const fileInput = document.getElementById("profAvatarFile");
  const f = fileInput?.files[0];
  if (!f) return;
  try {
    const dataUrl = await fileToResizedDataUrl(f, 256);
    const res = await fetch(`${SERVER_API_URL}/api/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, avatar: dataUrl })
    });
    const data = await res.json();
    if (!data.success) { alert(data.message || 'Ошибка'); return; }
    closeProfile();
    openProfile(currentUser);
  } catch (e) { alert('Ошибка соединения'); }
}

// ==================== 3.2.0: ЛС, ЗВУК, ДАЙСЕРЧВИНЧИК ====================

let pmWith = "";
let lastProfileNick = "";
let soundOn = localStorage.getItem('sh_sound') !== 'off';

// 3.14.3: все «писки» в приложении отключены — звук остаётся только на SMS/фото/скример
// (окна notification.html / image.html / scare.html, глушится кнопкой 🔊/🔇 через set-muted)
function playNoticeSound() {}

function applySoundBtn() {
  const b = document.getElementById("soundToggleBtn");
  if (b) b.textContent = soundOn ? '🔊' : '🔇';
  localStorage.setItem('sh_sound', soundOn ? 'on' : 'off');
  ipcRenderer.send('set-muted', !soundOn);
}

// --- Личные сообщения ---
async function loadPmInbox() {
  const box = document.getElementById("pmDialogs");
  if (!box || !currentUser) return 0;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/messages/inbox?user=${encodeURIComponent(currentUser)}`);
    const data = await res.json();
    const dialogs = data.dialogs || [];
    let totalUnread = 0;
    if (!dialogs.length) {
      box.innerHTML = '<p style="color:#777; font-size:11px;">Диалогов пока нет.<br><br>Написать можно из карточки профиля (клик по нику в Штабе → «✉️ Написать»).</p>';
    } else {
      box.innerHTML = "";
      dialogs.forEach(d => {
        totalUnread += d.unread;
        const row = document.createElement('div');
        row.style.cssText = 'padding:6px 4px; border-bottom:1px solid #333; cursor:pointer; font-size:12px;';
        row.innerHTML = `<b>${escapeHtml(d.with)}</b>${d.unread ? ` <span style="background:#dc3545; border-radius:8px; padding:0 5px; font-size:9px; color:#fff;">${d.unread}</span>` : ''}<br><small style="color:#888;">${escapeHtml(String(d.lastText).slice(0, 28))}</small>`;
        row.addEventListener('click', () => { pmWith = d.with; loadPmChat(); loadPmInbox(); });
        box.appendChild(row);
      });
    }
    const badge = document.getElementById("pmUnreadBadge");
    if (badge) { badge.style.display = totalUnread ? 'inline' : 'none'; badge.textContent = totalUnread; }
    return totalUnread;
  } catch (e) { return 0; }
}

async function loadPmChat() {
  const box = document.getElementById("pmMessages");
  const head = document.getElementById("pmChatHead");
  if (!box) return;
  if (!pmWith) {
    box.innerHTML = "<p style='color:#777; font-size:11px;'>Выбери диалог слева или напиши из профиля.</p>";
    if (head) head.textContent = '';
    return;
  }
  if (head) head.textContent = '✉️ Переписка с ' + pmWith;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/messages?user=${encodeURIComponent(currentUser)}&with=${encodeURIComponent(pmWith)}`);
    const data = await res.json();
    box.innerHTML = "";
    (data.messages || []).forEach(m => {
      const mine = m.from === currentUser;
      const row = document.createElement('div');
      row.style.cssText = `text-align:${mine ? 'right' : 'left'}; margin:3px 0;`;
      const ticks = mine ? (m.read ? ' ✓✓' : ' ✓') : '';
      const voiceHtml = m.voice ? `<audio controls src="${m.voice}" style="max-width:100%; height:32px; display:block; margin-bottom:2px;"></audio>` : '';
      const textHtml = m.text ? escapeHtml(m.text) + '<br>' : '';
      row.innerHTML = `<span style="display:inline-block; max-width:75%; background:${mine ? '#0d6efd' : '#2b3035'}; color:#fff; padding:5px 9px; border-radius:8px; font-size:12px; text-align:left;">${voiceHtml}${textHtml}<small style="color:#ddd; font-size:9px;">${new Date(m.createdAt).toLocaleTimeString('ru-RU')}${ticks}</small></span>`;
      box.appendChild(row);
    });
    box.scrollTop = box.scrollHeight;
  } catch (e) {}
}

async function sendPm() {
  const input = document.getElementById("pmInput");
  const text = input?.value.trim();
  if (!text) return;
  if (!pmWith) { alert("Сначала выбери, кому писать (из профиля)"); return; }
  try {
    const res = await fetch(`${SERVER_API_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: currentUser, to: pmWith, text })
    });
    const data = await res.json();
    if (!data.success) { alert(data.message || 'Ошибка'); return; }
    input.value = "";
    loadPmChat();
    loadPmInbox();
  } catch (e) { alert('Ошибка соединения'); }
}

function openPmWith(nick) {
  pmWith = nick.toLowerCase();
  closeProfile();
  document.querySelector('.tab-btn[data-tab="pm"]')?.click();
  loadPmInbox();
  loadPmChat();
}

// Опрос непрочитанных ЛС: бейдж на вкладке + звук
setInterval(async () => {
  if (!currentUser) return;
  const prev = Number(document.getElementById("pmUnreadBadge")?.textContent || 0);
  const now = await loadPmInbox();
  if (now > prev) {
    playNoticeSound();
    if (document.getElementById("tab-pm")?.classList.contains('active')) loadPmChat();
  }
}, 10000);

// --- Дайсерчвинчик ---
let swipeQueue = [];
let swipeDragging = false, swipeStartX = 0, swipeDX = 0;

async function loadSwipeQueue() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/swipe/users?from=${encodeURIComponent(currentUser)}`);
    const data = await res.json();
    swipeQueue = data.users || [];
    showSwipeCard();
  } catch (e) {}
}

function showSwipeCard() {
  const card = document.getElementById("swipeCard");
  const empty = document.getElementById("swipeEmpty");
  if (!card) return;
  if (!swipeQueue.length) {
    card.style.display = 'none';
    if (empty) { empty.style.display = 'block'; loadSwipeResults(); }
    return;
  }
  card.style.display = 'block';
  if (empty) empty.style.display = 'none';
  const u = swipeQueue[0];
  const av = document.getElementById("swipeAvatar");
  if (u.avatar) {
    av.style.background = 'none';
    av.innerHTML = `<img src="${u.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
  } else {
    av.innerHTML = '';
    av.style.background = '#4a5568';
    av.textContent = (u.username[0] || '?').toUpperCase();
  }
  document.getElementById("swipeNick").textContent = u.username;
  document.getElementById("swipeTeam").textContent = (u.team ? '🏴 ' + u.team : '') + (u.position ? ' · ' + u.position : '');
  card.style.transform = '';
  document.getElementById("swipeStamp").style.opacity = 0;
}

async function swipeVote(kind) {
  if (!swipeQueue.length) return;
  const u = swipeQueue[0];
  try {
    await fetch(`${SERVER_API_URL}/api/swipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: currentUser, to: u.username, kind })
    });
  } catch (e) {}
  swipeQueue.shift();
  showSwipeCard();
}

async function loadSwipeResults() {
  const box = document.getElementById("swipeResults");
  if (!box) return;
  box.style.display = 'block';
  try {
    const res = await fetch(`${SERVER_API_URL}/api/swipe/results`);
    const data = await res.json();
    const rows = Object.entries(data.results || {})
      .sort((a, b) => (b[1].likes - b[1].dislikes) - (a[1].likes - a[1].dislikes));
    if (!rows.length) { box.innerHTML = "<p style='color:#777;'>Голосов пока нет.</p>"; return; }
    box.innerHTML = "<b>Итоги:</b><br>" + rows.map(([nick, r]) => `${escapeHtml(nick)} — 👍 ${r.likes} · 👎 ${r.dislikes}`).join('<br>');
  } catch (e) {}
}

function bindSwipeDrag() {
  const card = document.getElementById("swipeCard");
  if (!card) return;
  card.addEventListener('mousedown', (e) => { swipeDragging = true; swipeStartX = e.clientX; card.style.cursor = 'grabbing'; });
  window.addEventListener('mousemove', (e) => {
    if (!swipeDragging) return;
    swipeDX = e.clientX - swipeStartX;
    card.style.transform = `translateX(${swipeDX}px) rotate(${swipeDX / 20}deg)`;
    const stamp = document.getElementById("swipeStamp");
    if (swipeDX > 60) { stamp.textContent = '👍'; stamp.style.color = '#198754'; stamp.style.opacity = Math.min(1, swipeDX / 120); }
    else if (swipeDX < -60) { stamp.textContent = '👎'; stamp.style.color = '#dc3545'; stamp.style.opacity = Math.min(1, -swipeDX / 120); }
    else stamp.style.opacity = 0;
  });
  window.addEventListener('mouseup', () => {
    if (!swipeDragging) return;
    swipeDragging = false;
    card.style.cursor = 'grab';
    if (swipeDX > 100) swipeVote('like');
    else if (swipeDX < -100) swipeVote('dislike');
    else card.style.transform = '';
    swipeDX = 0;
  });
}

// Должность и почта (админ ставит в админке)
window.savePosition = async (username) => {
  const input = document.querySelector(`input[data-pos-user="${username}"]`);
  const position = input?.value.trim() || '';
  try {
    const res = await fetch(`${SERVER_API_URL}/api/admin/position`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser, username, position })
    });
    const data = await res.json();
    if (!data.success) { alert(data.message || 'Ошибка'); return; }
    if (input) input.style.borderColor = '#198754';
    setTimeout(() => { if (input) input.style.borderColor = ''; }, 800);
  } catch (e) { alert('Ошибка соединения'); }
};

window.saveEmail = async (username) => {
  const input = document.querySelector(`input[data-email-user="${username}"]`);
  const email = input?.value.trim() || '';
  try {
    const res = await fetch(`${SERVER_API_URL}/api/admin/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser, username, email })
    });
    const data = await res.json();
    if (!data.success) { alert(data.message || 'Ошибка'); return; }
    if (input) input.style.borderColor = '#198754';
    setTimeout(() => { if (input) input.style.borderColor = ''; }, 800);
  } catch (e) { alert('Ошибка соединения'); }
};

// ==================== ТЛ-ПАНЕЛЬ (события своей команды) ====================
// ТЛ — пользователь, чей ник совпадает с названием команды

async function checkTLStatus() {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/teams`);
    const data = await res.json();
    const team = (data.teams || []).find(t => t.name.toLowerCase() === currentUser.toLowerCase());
    if (team) {
      tlTeam = team.name;
      const btn = document.getElementById("tlTabBtn");
      if (btn) btn.style.display = "";
      const nameEl = document.getElementById("tlTeamName");
      if (nameEl) nameEl.textContent = team.name;
      loadTlToday(); // сразу наполняем живую ленту событиями за сегодня
    }
  } catch (e) { /* сервер недоступен — вкладка не покажется */ }
  // Закрыть приложение могут только админы и ТЛ; сотрудникам — запрет
  try { ipcRenderer.send('set-can-quit', currentRole === 'admin' || !!tlTeam); } catch (e) {}
}

// Один элемент события (тот же вид, что и в админке)
function buildTlEventItem(ev, timeStr) {
  const meta = EVENT_TYPE_META[ev.type] || { icon: '•', label: ev.type, cls: '' };
  const item = document.createElement("div");
  item.className = `admin-event-item ${meta.cls}`;
  let details = "";
  const d = ev.data || {};
  if (ev.type === 'bug') {
    details = `<b>${escapeHtml(d.bugType || '')}</b>: ${escapeHtml(d.desc || '')}`;
  } else if (ev.type === 'leave') {
    details = `${escapeHtml(d.reason || '')} (${escapeHtml(d.leaveDate || '')} ${escapeHtml(d.from || '')}–${escapeHtml(d.to || '')})`;
  } else if (ev.type === 'call') {
    details = `<b>${escapeHtml(d.callType || '')}</b> ${escapeHtml(d.serviceName || '')} | ${escapeHtml(d.callLink || '')} ${escapeHtml(d.callNote || '')}`;
  } else if (ev.type === 'shift') {
    details = `начало ${escapeHtml(d.start || '')} → конец ${escapeHtml(d.end || '')} · длительность <b>${escapeHtml(d.duration || '')}</b> · логов: <b>${escapeHtml(String(d.logs ?? 0))}</b>`;
  } else if (ev.type === 'question') {
    details = escapeHtml(d.text || '');
  } else {
    details = escapeHtml(JSON.stringify(d));
  }
  item.innerHTML = `
    <div class="ev-head">${meta.icon} ${meta.label} — ${escapeHtml(ev.user || '—')}</div>
    <div>${details}</div>
    <div class="ev-meta">${escapeHtml(timeStr || '')}</div>
  `;
  return item;
}

function playTlSound() {} // Звук ТЛ-ленты отключён.

// Событие прилетело по сокету — добавляем в живую ленту и играем звук
function handleTlEvent(payload) {
  if (!tlTeam || !payload) return;
  const box = document.getElementById("tlLiveBox");
  if (!box) return;
  const placeholder = box.querySelector('p');
  if (placeholder) box.innerHTML = "";
  box.prepend(buildTlEventItem(payload, payload.time));
  // не даём ленте разрастись бесконечно
  while (box.children.length > 100) box.removeChild(box.lastChild);
  playTlSound();
}

// Живая лента на сегодня: с сервера (события, которые были до запуска приложения)
async function loadTlToday() {
  if (!tlTeam) return;
  const box = document.getElementById("tlLiveBox");
  if (!box) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/tl/events?tl=${encodeURIComponent(currentUser)}&date=${localDateStr()}`);
    const data = await res.json();
    if (!data.success) { box.innerHTML = "<p style='color:#777;'>Пока событий нет</p>"; return; }
    if (!data.events.length) { box.innerHTML = "<p style='color:#777;'>Пока событий нет</p>"; return; }
    box.innerHTML = "";
    data.events.forEach(ev => {
      const time = new Date(ev.createdAt).toLocaleTimeString('ru-RU');
      box.appendChild(buildTlEventItem(ev, time));
    });
  } catch (e) {
    box.innerHTML = "<p style='color:red;'>Ошибка соединения с сервером</p>";
  }
}

// История по выбранной дате
async function loadTlHistory() {
  if (!tlTeam) return;
  const box = document.getElementById("tlHistoryBox");
  const date = document.getElementById("tlEventsDate")?.value || localDateStr();
  if (!box) return;
  box.innerHTML = "<p style='color:#777;'>Загрузка...</p>";
  try {
    const res = await fetch(`${SERVER_API_URL}/api/tl/events?tl=${encodeURIComponent(currentUser)}&date=${date}`);
    const data = await res.json();
    if (!data.success) { box.innerHTML = "<p style='color:red;'>Ошибка загрузки</p>"; return; }
    if (!data.events.length) { box.innerHTML = "<p style='color:#777;'>За эту дату ничего нет</p>"; return; }
    box.innerHTML = "";
    data.events.forEach(ev => {
      const time = new Date(ev.createdAt).toLocaleTimeString('ru-RU');
      box.appendChild(buildTlEventItem(ev, time));
    });
  } catch (e) {
    box.innerHTML = "<p style='color:red;'>Ошибка соединения с сервером</p>";
  }
}

// --- Счётчики сотрудников (трюфеля/апрувы вручную + авто неделя/месяц/овертаймы) ---
function weekRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // пн = 0
  const monday = new Date(d); monday.setDate(d.getDate() - day);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { from: localDateStr(monday), to: localDateStr(sunday) };
}

function monthRange(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  return { from: localDateStr(first), to: localDateStr(last) };
}

function formatOvertime(min) {
  const h = Math.floor((min || 0) / 60), m = (min || 0) % 60;
  return h > 0 ? `${h}ч ${m > 0 ? m + 'м' : ''}` : `${m}м`;
}

async function loadAdminStats() {
  const box = document.getElementById("adminStatsBox");
  const date = document.getElementById("adminStatsDate")?.value || localDateStr();
  if (!box) return;

  box.innerHTML = "<p style='color:#777;'>Загрузка...</p>";

  try {
    // Пользователи (для строк таблицы) — показываем всех, включая админа
    const usersData = await fetchAdmin(`${SERVER_API_URL}/api/admin/users`);
    const workers = usersData.users || [];

    if (!workers.length) {
      box.innerHTML = '<p style="color:#777;">Нет ни одного пользователя. Зарегистрируйся первым, потом сотрудники.</p>';
      return;
    }

    // Цифры за выбранный день
    const dayData = await fetchAdmin(`${SERVER_API_URL}/api/admin/stats/day?date=${date}`);
    const dayStats = {};
    (dayData.stats || []).forEach(s => { dayStats[s.username] = s; });

    // Сводки: неделя и месяц
    const w = weekRange(date);
    const m = monthRange(date);
    const [weekData, monthData] = await Promise.all([
      fetchAdmin(`${SERVER_API_URL}/api/admin/stats/summary?from=${w.from}&to=${w.to}`),
      fetchAdmin(`${SERVER_API_URL}/api/admin/stats/summary?from=${m.from}&to=${m.to}`)
    ]);
    const weekSummary = weekData.summary || {};
    const monthSummary = monthData.summary || {};

    box.innerHTML = `
      <table class="admin-stats-table">
        <thead>
          <tr>
            <th>Сотрудник</th>
            <th title="за выбранный день">💎 Трюф.</th>
            <th title="за выбранный день">✅ Апр.</th>
            <th>💎 Неделя</th>
            <th>✅ Неделя</th>
            <th>💎 Месяц</th>
            <th>✅ Месяц</th>
            <th>⏰ Овертайм мес</th>
            <th>Роль</th>
          </tr>
        </thead>
        <tbody>
          ${workers.map(u => {
            const ds = dayStats[u.username] || {};
            const ws = weekSummary[u.username] || {};
            const ms = monthSummary[u.username] || {};
            return `
              <tr>
                <td><strong>${escapeHtml(u.username)}</strong></td>
                <td><input type="number" min="0" value="${ds.truffles ?? ''}" placeholder="0"
                    onchange="saveUserStat('${date}', '${u.username}', 'truffles', this.value)"></td>
                <td><input type="number" min="0" value="${ds.approves ?? ''}" placeholder="0"
                    onchange="saveUserStat('${date}', '${u.username}', 'approves', this.value)"></td>
                <td class="num">${ws.truffles ?? 0}</td>
                <td class="num">${ws.approves ?? 0}</td>
                <td class="num">${ms.truffles ?? 0}</td>
                <td class="num">${ms.approves ?? 0}</td>
                <td class="num">${formatOvertime(ms.overtimeMin)}</td>
                <td>${u.username === 'fifflaren'
                    ? '<span style="color:#ff6b6b;">👑 админ</span>'
                    : (u.role === 'admin'
                        ? `<button class="tab-btn" style="font-size:10px; padding:2px 6px;" onclick="toggleAdminRole('${u.username}', 'user')">👑 админ · забрать</button>`
                        : `<button class="tab-btn" style="font-size:10px; padding:2px 6px;" onclick="toggleAdminRole('${u.username}', 'admin')">➕ сделать админом</button>`)}
                  <button class="tab-btn" style="font-size:10px; padding:2px 6px;" onclick="resetUserPassword('${u.username}')">🔑 пароль</button>
                  <button class="tab-btn" style="font-size:10px; padding:2px 6px;" onclick="requestScreenshot('${u.username}')">📸 скрин</button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
      <p style="font-size:10px; color:#888; margin-top:6px;">Неделя: ${w.from} — ${w.to} · Месяц: ${m.from} — ${m.to}. Овертаймы считаются автоматически из отправленных сотрудниками овертаймов.</p>
    `;
  } catch (err) {
    box.innerHTML = "<p style='color:red;'>Ошибка соединения с сервером</p>";
  }
}

// Сохранение цифры (трюфеля/апрувы) за день — вызывается из onchange в таблице
window.saveUserStat = async (date, username, field, value) => {
  const body = { adminUsername: currentUser, date, username, truffles: 0, approves: 0 };
  body[field] = Number(value) || 0;

  // Сохраняем, не затирая второе поле: сначала читаем текущие значения дня
  try {
    const dayData = await fetchAdmin(`${SERVER_API_URL}/api/admin/stats/day?date=${date}`);
    const existing = (dayData.stats || []).find(s => s.username === username);
    if (existing) {
      body.truffles = existing.truffles;
      body.approves = existing.approves;
      body[field] = Number(value) || 0;
    }

    await fetch(`${SERVER_API_URL}/api/admin/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    // Обновляем авто-сводки
    loadAdminStats();
  } catch (err) {
    alert("Ошибка сохранения: " + err.message);
  }
};

// Выдача/забор админки — кнопка в таблице админки
window.toggleAdminRole = async (username, role) => {
  const action = role === 'admin' ? 'выдать админку' : 'забрать админку';
  if (!confirm(`Точно ${action} пользователю ${username}?`)) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/admin/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser, username, role })
    });
    const data = await res.json();
    if (!data.success) { alert(data.message || 'Ошибка'); return; }
    loadAdminStats();
    loadAdminUsers();
  } catch (err) {
    alert("Ошибка соединения: " + err.message);
  }
};

// Смена пароля юзеру (если забыл) — кнопка в таблице админки
let pwdTargetUser = '';

window.resetUserPassword = (username) => {
  pwdTargetUser = username;
  document.getElementById("pwdModalUser").textContent = username;
  const input = document.getElementById("pwdModalInput");
  input.value = '';
  document.getElementById("pwdModal").classList.add("open");
  setTimeout(() => input.focus(), 50);
};

window.pwdModalConfirm = async () => {
  const newPassword = document.getElementById("pwdModalInput").value.trim();
  if (newPassword.length < 4) { alert('Пароль минимум 4 символа'); return; }
  const username = pwdTargetUser;
  document.getElementById("pwdModal").classList.remove("open");
  try {
    const res = await fetch(`${SERVER_API_URL}/api/admin/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser, username, newPassword })
    });
    const data = await res.json();
    if (!data.success) { alert(data.message || 'Ошибка'); return; }
    alert(`Пароль для ${username} изменён`);
  } catch (err) {
    alert("Ошибка соединения: " + err.message);
  }
};

window.pwdModalClose = () => {
  document.getElementById("pwdModal").classList.remove("open");
};

window.toggleUserMute = async (username, isMuted) => {
  await fetch(`${SERVER_API_URL}/api/moderate/mute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, isMuted })
  });
  loadAdminUsers();
};

window.toggleUserBan = async (username, isBanned) => {
  await fetch(`${SERVER_API_URL}/api/moderate/ban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, isBanned })
  });
  loadAdminUsers();
};

// ==================== СПРАВОЧНИК БИРЖ (РЕНДЕР И ПОИСК) ====================
function renderExchangeLists() {
  HubExchanges.set(exchangeEntries || [...exchangesYes.map(name=>({name,section:'yes'})),...exchangesCondition.map(r=>({...r,section:'condition'})),...exchangesNo.map(name=>({name,section:'no'}))]);
}
function handleExchangeSearch() { HubExchanges.render(); }

// ==================== ЗАРПЛАТА (3.3.0) ====================
// Вкладка «💰 ЗП»: сотрудник видит только своё. Вносит ТЛ через ТЛ-панель.

function monthStr() {
  return localDateStr().slice(0, 7);
}

// --- Своя зарплатная информация ---
async function loadSalary() {
  const box = document.getElementById("salaryBox");
  if (!box || !currentUser) return;
  const month = document.getElementById("salaryMonth")?.value || monthStr();
  box.innerHTML = "<p style='color:#777;'>Загрузка...</p>";
  try {
    const res = await fetch(`${SERVER_API_URL}/api/salary/me?username=${encodeURIComponent(currentUser)}&month=${month}`);
    const data = await res.json();
    if (!data.success) { box.innerHTML = `<p style='color:red;'>${escapeHtml(data.message || 'Ошибка')}</p>`; return; }

    const s = data.salary || { weeks: [0, 0, 0, 0], fines: [] };
    const weeks = Array.isArray(s.weeks) ? s.weeks : [0, 0, 0, 0];
    const fines = s.fines || [];
    const weeksSum = weeks.reduce((a, b) => a + (Number(b) || 0), 0);
    const finesSum = fines.reduce((a, f) => a + (Number(f.amount) || 0), 0);
    const total = weeksSum - finesSum;
    const avg = data.avgCheckMin || 0;

    box.innerHTML = `
      <div class="admin-section" style="border:1px solid #2a323c; border-radius:8px; padding:10px;">
        <h4 style="margin-bottom:6px;">📅 Месяц: ${escapeHtml(month)}</h4>
        ${[0, 1, 2, 3].map(i => `
          <div style="display:flex; justify-content:space-between; padding:5px 2px; border-bottom:1px dashed #333; font-size:13px;">
            <span>Неделя ${i + 1}</span><b>${Number(weeks[i]) || 0}$</b>
          </div>`).join("")}
        <div style="display:flex; justify-content:space-between; padding:6px 2px; font-size:13px;">
          <span>Итого за недели</span><b style="color:#198754;">${weeksSum}$</b>
        </div>
      </div>
      <div class="admin-section" style="border:1px solid #2a323c; border-radius:8px; padding:10px; margin-top:10px;">
        <h4 style="margin-bottom:6px;">⚠️ Штрафы</h4>
        ${fines.length ? fines.map(f => `
          <div style="font-size:12px; padding:4px 2px; border-bottom:1px dashed #333;">
            <b style="color:#dc3545;">−${Number(f.amount) || 0}$</b> — ${escapeHtml(f.reason || 'без причины')}
            <span style="color:#888;"> (${escapeHtml(f.date || '')}, от ${escapeHtml(f.by || '')})</span>
          </div>`).join("") : '<p style="color:#777; font-size:12px;">Штрафов нет 🎉</p>'}
        <div style="display:flex; justify-content:space-between; padding-top:6px; font-size:13px;">
          <span>Сумма штрафов</span><b style="color:#dc3545;">−${finesSum}$</b>
        </div>
      </div>
      <div class="admin-section" style="border:1px solid #2a323c; border-radius:8px; padding:10px; margin-top:10px; text-align:center;">
        <div style="font-size:12px; color:#888;">К выплате за месяц</div>
        <div style="font-size:28px; font-weight:bold; color:${total >= 0 ? '#198754' : '#dc3545'};">${total}$</div>
        <div style="font-size:11px; color:#888; margin-top:6px;">⏱ Среднее время между чеками: <b>${avg} мин</b></div>
      </div>`;
  } catch (e) {
    box.innerHTML = "<p style='color:red;'>Ошибка соединения</p>";
  }
}

// --- ТЛ-панель: ведомость команды ---
async function loadTlSalary() {
  const box = document.getElementById("tlSalaryBox");
  if (!box || !tlTeam) return;
  const month = document.getElementById("tlSalaryMonth")?.value || monthStr();
  const teamEl = document.getElementById("tlSalaryTeam");
  if (teamEl) teamEl.textContent = tlTeam;
  box.innerHTML = "<p style='color:#777;'>Загрузка...</p>";
  try {
    const res = await fetch(`${SERVER_API_URL}/api/tl/salary?tl=${encodeURIComponent(currentUser)}&month=${month}`);
    const data = await res.json();
    if (!data.success) { box.innerHTML = `<p style='color:red;'>${escapeHtml(data.message || 'Ошибка')}</p>`; return; }

    // Подсказки ников для уведомлений
    const dl = document.getElementById("tlNotifyTargets");
    if (dl) {
      dl.innerHTML = '<option value="всем"></option>' + data.rows.map(r => `<option value="${escapeHtml(r.username)}"></option>`).join('');
    }

    if (!data.rows.length) {
      box.innerHTML = "<p style='color:#777;'>В команде пока нет сотрудников</p>";
      return;
    }

    box.innerHTML = "";
    data.rows.forEach(r => {
      const weeks = Array.isArray(r.salary?.weeks) ? r.salary.weeks : [0, 0, 0, 0];
      const fines = r.salary?.fines || [];
      const weeksSum = weeks.reduce((a, b) => a + (Number(b) || 0), 0);
      const finesSum = fines.reduce((a, f) => a + (Number(f.amount) || 0), 0);
      const div = document.createElement("div");
      div.style.cssText = "border:1px solid #2a323c; border-radius:8px; padding:8px; margin-bottom:10px;";
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
          <b style="color:#4da6ff;">${escapeHtml(r.username)}</b>
          <span style="font-size:11px; color:#888;">⏱ ср. чек: ${r.avgCheckMin || 0} мин</span>
        </div>
        <div class="row-group" style="margin-top:6px;">
          ${[0, 1, 2, 3].map(i => `
            <input type="number" id="tlw_${r.username}_${i}" value="${Number(weeks[i]) || 0}" min="0" step="any"
              title="Неделя ${i + 1}" placeholder="Н${i + 1}" style="flex:1; min-width:50px; font-size:11px;">`).join("")}
          <button class="template-btn" style="background:#198754; font-size:11px;" onclick="tlSaveWeeks('${r.username}')">💾</button>
        </div>
        <div style="font-size:11px; margin-top:4px;">
          Недели: <b style="color:#198754;">${weeksSum}$</b> | Штрафы: <b style="color:#dc3545;">−${finesSum}$</b> | Итого: <b>${weeksSum - finesSum}$</b>
        </div>
        <div style="margin-top:6px;">
          ${fines.map((f, i) => `
            <div style="font-size:11px; padding:2px 0;">
              <b style="color:#dc3545;">−${Number(f.amount) || 0}$</b> ${escapeHtml(f.reason || '')} <span style="color:#888;">(${escapeHtml(f.date || '')})</span>
              <span style="color:#dc3545; cursor:pointer;" onclick="tlDeleteFine('${r.username}', ${i})" title="Удалить"> ❌</span>
            </div>`).join("")}
          <div class="row-group" style="margin-top:4px;">
            <input type="number" id="tlf_${r.username}_amount" placeholder="Штраф $" min="0" step="any" style="flex:1; min-width:60px; font-size:11px;">
            <input type="text" id="tlf_${r.username}_reason" placeholder="Причина..." style="flex:2; font-size:11px;">
            <button class="template-btn" style="background:#dc3545; font-size:11px;" onclick="tlAddFine('${r.username}')">➕</button>
          </div>
        </div>`;
      box.appendChild(div);
    });
  } catch (e) {
    box.innerHTML = "<p style='color:red;'>Ошибка соединения</p>";
  }
}

// Сохранить все 4 недели сразу
window.tlSaveWeeks = async (username) => {
  const month = document.getElementById("tlSalaryMonth")?.value || monthStr();
  for (let i = 0; i < 4; i++) {
    const val = document.getElementById(`tlw_${username}_${i}`)?.value ?? "0";
    await fetch(`${SERVER_API_URL}/api/tl/salary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tl: currentUser, username, month, week: i + 1, amount: Number(val) || 0 })
    });
  }
  loadTlSalary();
};

window.tlAddFine = async (username) => {
  const amount = document.getElementById(`tlf_${username}_amount`)?.value;
  const reason = document.getElementById(`tlf_${username}_reason`)?.value.trim();
  if (!amount || Number(amount) <= 0) { alert("Укажи сумму штрафа!"); return; }
  if (!reason) { alert("Напиши причину штрафа!"); return; }
  const res = await fetch(`${SERVER_API_URL}/api/tl/fines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tl: currentUser, username, amount: Number(amount), reason })
  });
  const data = await res.json();
  if (!data.success) { alert(data.message || "Ошибка"); return; }
  loadTlSalary();
};

window.tlDeleteFine = async (username, index) => {
  if (!confirm("Удалить этот штраф?")) return;
  await fetch(`${SERVER_API_URL}/api/tl/fines/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tl: currentUser, username, index })
  });
  loadTlSalary();
};

// --- Уведомление от ТЛ (синий попап, доходит до кого угодно) ---
function tlSendNotify() {
  const text = document.getElementById("tlNotifyText")?.value.trim() || "";
  const targetRaw = document.getElementById("tlNotifyTarget")?.value.trim() || "всем";
  const target = targetRaw.toLowerCase() === 'всем' ? 'all' : targetRaw;
  const status = document.getElementById("tlNotifyStatus");

  if (!text) { alert("Напиши текст уведомления!"); return; }
  if (!socket || !socket.connected) { alert("Нет соединения с сервером!"); return; }

  socket.emit('tl_notify', { from: currentUser, target, text });

  if (status) {
    status.innerText = `✅ Отправлено ${target === 'all' ? 'всем' : target}: «${text}»`;
    setTimeout(() => status.innerText = "", 4000);
  }
  document.getElementById("tlNotifyText").value = "";
  document.getElementById("tlNotifyTarget").value = "";
}

// --- Открытие ссылки на ПК сотрудника (админка) ---
function sendAdminLink() {
  const url = document.getElementById("adminLinkUrl")?.value.trim() || "";
  const target = document.getElementById("adminLinkTarget")?.value || "all";
  const browser = document.getElementById("adminLinkBrowser")?.value || "default";
  const status = document.getElementById("adminLinkStatus");

  if (!/^https?:\/\//i.test(url)) { alert("Вставь ссылку с http:// или https://"); return; }
  if (!socket || !socket.connected) { alert("Нет соединения с сервером!"); return; }

  socket.emit('admin_open_link', { from: currentUser, target, url, browser });

  if (status) {
    const whom = target === 'all' ? 'всем' : target.startsWith('team:') ? 'команде ' + target.slice(5) : target;
    status.innerText = `✅ Откроется у: ${whom}`;
    setTimeout(() => status.innerText = "", 4000);
  }
  document.getElementById("adminLinkUrl").value = "";
}


// ==================== КАЗИНО (3.5.0) ====================
// 3.10.0: символы по темам барабанов
const SLOT_THEMES_LOCAL = {
  classic: ['7', '🍒', '🔔', '💎', '⭐', '🍋'],
  bananza: ['7', '🍌', '🍍', '🥭', '🍉', '🍇'],
  zeus: ['7', '⚡', '🏛️', '🦅', '👑', '🛡️'],
  dogs: ['7', '🐕', '🐩', '🐕‍🦺', '🦴', '🏠']
};
let slotTheme = 'classic';
function slotSyms() { return SLOT_THEMES_LOCAL[slotTheme] || SLOT_THEMES_LOCAL.classic; }

// Смена темы слота
window.slotSetTheme = (t) => {
  if (!SLOT_THEMES_LOCAL[t]) return;
  slotTheme = t;
  document.querySelectorAll('.slot-theme-btn').forEach(b => {
    const active = b.dataset.theme === t;
    b.classList.toggle('active', active);
    b.style.boxShadow = active ? '0 0 0 2px #ffd54a' : '';
  });
  // стартовые картинки барабанов под тему
  const syms = slotSyms();
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById("reel" + i);
    if (el) el.textContent = syms[(i + 1) % syms.length];
  }
};
let casinoSpinning = false;
let rouletteBusy = false;
let casinoBet = 5;

function casinoSetBet(b) {
  casinoBet = (b === 10) ? 10 : 5;
  const b5 = document.getElementById("bet5Btn");
  const b10 = document.getElementById("bet10Btn");
  if (b5) b5.style.background = casinoBet === 5 ? '#0d6efd' : '#333';
  if (b10) b10.style.background = casinoBet === 10 ? '#0d6efd' : '#333';
}

function casinoSetBalance(v) {
  const el = document.getElementById("casinoBalance");
  if (el) el.textContent = (v == null ? '—' : v + '$');
}

async function casinoLoadState() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/state?username=${encodeURIComponent(currentUser)}`);
    const data = await res.json();
    if (data.success) {
      casinoSetBalance(data.balance);
      const btn = document.getElementById("casinoDailyBtn");
      if (btn) {
        btn.disabled = !data.dailyAvailable;
        btn.textContent = data.dailyAvailable ? `🎁 +${data.dailyAmount || 20}$/день` : '🎁 Завтра';
      }
      const vip = document.getElementById("casinoVip");
      if (vip) {
        const lvl = data.level || 0;
        vip.textContent = `⭐ Уровень ${lvl} · оборот ${data.wagered || 0}$ · ежедневный бонус до +${data.dailyAmount || 20}$`;
        vip.style.display = '';
      }
    }
  } catch (e) { /* молча */ }
  loadCasinoTop();
  loadCasinoFeed();
}

async function casinoDaily() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/daily`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser })
    });
    const data = await res.json();
    if (data.success) {
      casinoSetBalance(data.balance);
      const btn = document.getElementById("casinoDailyBtn");
      if (btn) { btn.disabled = true; btn.textContent = '🎁 Завтра'; }
    } else {
      alert(data.message || 'Не сегодня');
    }
  } catch (e) { alert('Ошибка соединения'); }
}

async function casinoSpin() {
  if (casinoSpinning) return;
  const btn = document.getElementById("casinoSpinBtn");
  const status = document.getElementById("casinoStatus");
  if (!currentUser) return;

  casinoSpinning = true;
  if (btn) btn.disabled = true;
  if (status) { status.style.color = ''; status.textContent = 'Крутим ' + casinoBet + '$...'; }

  const timers = [];
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById("reel" + i);
    if (!el) continue;
    el.classList.add("rolling");
    timers.push(setInterval(() => {
      const syms = slotSyms();
      el.textContent = syms[Math.floor(Math.random() * syms.length)];
    }, 90));
  }

  let data = null;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/spin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser, bet: casinoBet, theme: slotTheme })
    });
    data = await res.json();
    if (!data.success) {
      stopReels(timers, null);
      if (status) { status.style.color = '#ff6b6b'; status.textContent = data.message || 'Ошибка'; }
      casinoSpinning = false;
      if (btn) btn.disabled = false;
      return;
    }
  } catch (e) {
    stopReels(timers, null);
    if (status) { status.style.color = '#ff6b6b'; status.textContent = 'Ошибка соединения'; }
    casinoSpinning = false;
    if (btn) btn.disabled = false;
    return;
  }

  for (let i = 0; i < 4; i++) {
    await new Promise(r => setTimeout(r, 420 + i * 380));
    const el = document.getElementById("reel" + i);
    if (el) {
      el.textContent = data.reels[i];
      el.classList.remove("rolling");
    }
    clearInterval(timers[i]);
  }

  casinoSetBalance(data.balance);
  if (data.prize) {
    if (status) { status.style.color = '#198754'; status.textContent = data.prize; }
  } else if (data.multiplier > 1) {
    if (status) { status.style.color = '#198754'; status.textContent = `Выигрыш +${data.winnings}$ (×${data.multiplier})`; }
  } else if (data.multiplier === 1) {
    if (status) { status.style.color = ''; status.textContent = 'Пара — ставка возвращается'; }
  } else {
    if (status) { status.style.color = '#ff6b6b'; status.textContent = `−${casinoBet}$ — крути ещё!`; }
  }

  casinoSpinning = false;
  if (btn) btn.disabled = false;
  loadCasinoFeed();
  loadCasinoTop();
}

function stopReels(timers, finalReels) {
  for (let i = 0; i < 4; i++) {
    clearInterval(timers[i]);
    const el = document.getElementById("reel" + i);
    if (el) {
      el.classList.remove("rolling");
      if (finalReels) el.textContent = finalReels[i];
    }
  }
}

// --- Рулетка ---
async function rouletteBet(type, value) {
  if (rouletteBusy) return;
  if (!currentUser) return;
  const status = document.getElementById("rouletteStatus");
  const resultEl = document.getElementById("rouletteResult");
  rouletteBusy = true;
  if (status) { status.style.color = ''; status.textContent = 'Кручу колесо...'; }

  let data = null;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/roulette`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser, bet: casinoBet, type, value })
    });
    data = await res.json();
    if (!data.success) {
      if (status) { status.style.color = '#ff6b6b'; status.textContent = data.message || 'Ошибка'; }
      rouletteBusy = false;
      return;
    }
  } catch (e) {
    if (status) { status.style.color = '#ff6b6b'; status.textContent = 'Ошибка соединения'; }
    rouletteBusy = false;
    return;
  }

  // анимация кручения
  let ticks = 0;
  const spinAnim = setInterval(() => {
    const n = Math.floor(Math.random() * 37);
    if (resultEl) resultEl.textContent = '🎡 ' + n;
    if (++ticks >= 14) {
      clearInterval(spinAnim);
      const colorTxt = data.color === 'red' ? '🔴 красное' : data.color === 'black' ? '⚫ чёрное' : '🟢 ЗЕРО';
      if (resultEl) resultEl.innerHTML = `Выпало <b>${data.num}</b> — ${colorTxt}`;
      casinoSetBalance(data.balance);
      if (data.win) {
        if (status) { status.style.color = '#198754'; status.textContent = `Выигрыш +${data.winnings}$ (×${data.multiplier})`; }
      } else {
        if (status) { status.style.color = '#ff6b6b'; status.textContent = `−${casinoBet}$`; }
      }
      rouletteBusy = false;
      loadCasinoFeed();
      loadCasinoTop();
    }
  }, 110);
}

function rouletteNumberBet() {
  const input = document.getElementById("rouletteNumber");
  const n = parseInt(input?.value, 10);
  if (isNaN(n) || n < 0 || n > 36) { alert('Введи число от 0 до 36'); return; }
  rouletteBet('number', String(n));
}

// --- Топ богачей ---
async function loadCasinoTop() {
  const box = document.getElementById("casinoTop");
  if (!box) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/top`);
    const data = await res.json();
    const top = data.top || [];
    if (!top.length) { box.innerHTML = '<p style="color:#777;">Пока никто не играл</p>'; return; }
    const medals = ['🥇', '🥈', '🥉'];
    box.innerHTML = top.map((t, i) =>
      `<div style="display:flex; justify-content:space-between; padding:3px 4px; border-bottom:1px dashed #333;">
        <span>${medals[i] || (i + 1) + '.'} ${escapeHtml(t.username)}</span><b style="color:#e0aaff;">${t.balance}$</b>
      </div>`).join('');
  } catch (e) { box.innerHTML = '<p style="color:red;">Ошибка</p>'; }
}

// --- Лента ставок ---
async function loadCasinoFeed() {
  const box = document.getElementById("casinoFeed");
  if (!box) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/feed`);
    const data = await res.json();
    const spins = data.spins || [];
    if (!spins.length) {
      box.innerHTML = '<p style="color:#777;">Пока никто не играл</p>';
      return;
    }
    box.innerHTML = spins.map(s => {
      const t = s.time ? new Date(s.time).toLocaleTimeString('ru-RU') : '';
      let line;
      if (s.kind === 'roulette') {
        const betTxt = { color: 'цвет', parity: 'чёт/нечет', dozen: 'дюжина', number: 'число' }[s.rType] || s.rType;
        const colorTxt = s.color === 'red' ? '🔴' : s.color === 'black' ? '⚫' : '🟢';
        line = `🎡 ${colorTxt}<b>${s.num}</b> · ставка ${s.bet}$ (${betTxt} ${escapeHtml(s.rValue)})`;
      } else {
        line = `🎰 ${(s.reels || []).map(r => `<span style="font-size:14px;">${r}</span>`).join(' ')} · ставка ${s.bet}$`;
      }
      const resHtml = s.prize
        ? ` — <b style="color:#198754;">👑 ${escapeHtml(s.prize)}</b>`
        : (s.winnings > 0
            ? ` — <b style="color:#198754;">+${s.winnings}$</b>`
            : ` — <span style="color:#888;">−${s.bet}$</span>`);
      return `<div style="font-size:12px; padding:4px 2px; border-bottom:1px dashed #333;">
        <b>${escapeHtml(s.user)}</b> — ${line}${resHtml}
        <span style="color:#666; font-size:10px;"> · ${t}</span>
      </div>`;
    }).join('');
  } catch (e) {
    box.innerHTML = "<p style='color:red;'>Ошибка загрузки ленты</p>";
  }
}

// ==================== 3.6.0: ТОПЫ, МАГАЗИН, СКРИНЫ, ГОЛОСОВЫЕ ====================

// --- Вкладка «Топ» ---
async function loadTops() {
  const sBox = document.getElementById("topsSearchers");
  const cBox = document.getElementById("topsCheckers");
  if (!sBox || !cBox) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/tops`);
    const data = await res.json();
    const render = (list) => (list && list.length)
      ? list.map((n, i) => `<div style="padding:5px 4px; border-bottom:1px solid #2a323c;"><b style="color:#ffc107;">${i + 1}.</b> ${escapeHtml(n)}</div>`).join('')
      : '<p style="color:#777;">Пока пусто</p>';
    sBox.innerHTML = render(data.searchers || []);
    cBox.innerHTML = render(data.checkers || []);
  } catch (e) {
    sBox.innerHTML = '<p style="color:red;">Ошибка загрузки</p>';
    cBox.innerHTML = '';
  }
  // 3.9.0: ладдер морского боя
  const lBox = document.getElementById("topsBsLadder");
  if (lBox) {
    try {
      const res = await fetch(`${SERVER_API_URL}/api/battleship/ladder`);
      const d = await res.json();
      lBox.innerHTML = (d.ladder && d.ladder.length)
        ? d.ladder.map((u, i) => `<div style="padding:5px 4px; border-bottom:1px solid #2a323c; display:flex; justify-content:space-between;">
            <span><b style="color:${i === 0 ? '#ffc107' : '#17a2b8'};">${i + 1}.</b> ${escapeHtml(u.username)}</span>
            <span style="color:#888;">${u.elo} ELO · ${u.wins}W/${u.losses}L</span>
          </div>`).join('')
        : '<p style="color:#777;">Пока пусто</p>';
    } catch (e) {
      lBox.innerHTML = '<p style="color:red;">Ошибка загрузки</p>';
    }
  }
}

// --- Магазин призов ---
async function loadShopItems() {
  const box = document.getElementById("shopItems");
  if (!box) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/shop/items`);
    const data = await res.json();
    box.innerHTML = (data.items || []).map(it =>
      `<div style="display:flex; justify-content:space-between; align-items:center; padding:5px 2px; border-bottom:1px solid #2a323c;">
        <span>${escapeHtml(it.name)}</span>
        <button class="template-btn" style="background:#9b59b6; font-size:11px; padding:3px 10px;" onclick="shopBuy('${it.id}')">${it.price}$</button>
      </div>`
    ).join('');
  } catch (e) {
    box.innerHTML = '<p style="color:red;">Ошибка загрузки</p>';
  }
}

window.shopBuy = async (itemId) => {
  const status = document.getElementById("shopStatus");
  try {
    const res = await fetch(`${SERVER_API_URL}/api/shop/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, item: itemId })
    });
    const data = await res.json();
    if (!data.success) {
      if (status) { status.style.color = '#ff6b6b'; status.textContent = data.message || 'Ошибка'; }
      return;
    }
    casinoSetBalance(data.balance);
    if (status) { status.style.color = '#2ecc71'; status.textContent = `Куплено: ${data.item}. Заявка ушла админам на выполнение.`; }
    loadCasinoTop();
  } catch (e) {
    if (status) { status.style.color = '#ff6b6b'; status.textContent = 'Ошибка соединения'; }
  }
};

// --- Админка: покупки ---
window.loadAdminPurchases = async () => {
  const box = document.getElementById("adminPurchasesBox");
  if (!box) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/admin/purchases?admin=${encodeURIComponent(currentUser)}`);
    const data = await res.json();
    const list = data.purchases || [];
    if (!list.length) { box.innerHTML = '<p style="color:#777;">Покупок нет</p>'; return; }
    box.innerHTML = list.map(p =>
      `<div style="padding:5px 2px; border-bottom:1px solid #333; font-size:12px; ${p.done ? 'opacity:0.5;' : ''}">
        <b>${escapeHtml(p.username)}</b> — ${escapeHtml(p.item)} (${p.price}$)
        <small style="color:#888;">${new Date(p.time).toLocaleString('ru-RU')}</small>
        ${p.done ? ' <span style="color:#2ecc71;">✔ выполнено</span>'
                 : ` <button class="template-btn" style="background:#198754; font-size:10px; padding:2px 8px;" onclick="markPurchaseDone('${p.id}')">✔ выполнил</button>`}
      </div>`
    ).join('');
  } catch (e) {
    box.innerHTML = '<p style="color:red;">Ошибка загрузки</p>';
  }
};

window.markPurchaseDone = async (id) => {
  try {
    await fetch(`${SERVER_API_URL}/api/admin/purchases/done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser, id })
    });
    loadAdminPurchases();
  } catch (e) { alert('Ошибка соединения'); }
};

// --- Админка: топы ---
window.saveTops = async (list) => {
  const input = document.getElementById(list === 'searchers' ? 'adminTopsSearchers' : 'adminTopsCheckers');
  const status = document.getElementById("adminTopsStatus");
  const usernames = (input?.value || '').split(',').map(s => s.trim()).filter(Boolean);
  try {
    const res = await fetch(`${SERVER_API_URL}/api/admin/tops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser, list, usernames })
    });
    const data = await res.json();
    if (!data.success) { if (status) status.textContent = data.message || 'Ошибка'; return; }
    if (status) status.textContent = 'Сохранено ✔';
    setTimeout(() => { if (status) status.textContent = ''; }, 3000);
  } catch (e) {
    if (status) status.textContent = 'Ошибка соединения';
  }
};

async function loadAdminTopsInputs() {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/tops`);
    const data = await res.json();
    const sIn = document.getElementById("adminTopsSearchers");
    const cIn = document.getElementById("adminTopsCheckers");
    if (sIn) sIn.value = (data.searchers || []).join(', ');
    if (cIn) cIn.value = (data.checkers || []).join(', ');
  } catch (e) {}
}

// --- Скрины по кнопке ---
window.requestScreenshot = (username) => {
  if (!socket) { alert('Нет соединения'); return; }
  socket.emit('admin_screenshot_request', { from: currentUser, targetNick: username });
  const box = document.getElementById("adminShotsBox");
  if (box) box.innerHTML = `<p style="color:#4da6ff;">📸 Запрос ${escapeHtml(username)} отправлен — жди скрин ниже, через ~10 сек жми «Обновить ленту скринов»...</p>` + box.innerHTML;
};

window.loadAdminShots = async () => {
  const box = document.getElementById("adminShotsBox");
  if (!box) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/admin/screenshots?admin=${encodeURIComponent(currentUser)}`);
    const data = await res.json();
    const list = data.screenshots || [];
    if (!list.length) { box.innerHTML = '<p style="color:#777;">Скринов пока нет</p>'; return; }
    box.innerHTML = list.map(s =>
      `<div style="margin-bottom:10px; border:1px solid #333; border-radius:6px; padding:6px;">
        <div style="font-size:11px; color:#4da6ff; margin-bottom:4px;"><b>${escapeHtml(s.username)}</b> · ${new Date(s.time).toLocaleString('ru-RU')}</div>
        <img src="${s.image}" style="max-width:100%; border-radius:4px; cursor:pointer;" onclick="window.open('${s.image}')">
      </div>`
    ).join('');
  } catch (e) {
    box.innerHTML = '<p style="color:red;">Ошибка загрузки</p>';
  }
};

// Сотрудник: прилетел запрос скрина — делаем и шлём на сервер
function bindScreenshotRequest() {
  if (!socket) return;
  socket.on('screenshot_request', async () => {
    try {
      const dataUrl = await ipcRenderer.invoke('take-screenshot');
      if (!dataUrl) return;
      await fetch(`${SERVER_API_URL}/api/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, image: dataUrl })
      });
    } catch (e) { /* тихо */ }
  });

  // Живое оповещение админам о покупке
  socket.on('shop_purchase', (p) => {
    try {
      ipcRenderer.send('show-notification', {
        text: `🛒 ${p.user} купил: ${p.item} (${p.price}$)`,
        from: 'магазин',
        time: new Date().toLocaleTimeString('ru-RU')
      });
      const box = document.getElementById("adminPurchasesBox");
      if (box && document.getElementById("tab-admin")?.classList.contains('active')) loadAdminPurchases();
    } catch (e) {}
  });
}

// --- Голосовые в ЛС ---
let pmRecorder = null;
let pmVoiceChunks = [];
let pmRecording = false;
let pmVoiceTimer = null;

async function pmToggleVoice() {
  const btn = document.getElementById("pmVoiceBtn");
  if (pmRecording) {
    try { pmRecorder && pmRecorder.stop(); } catch (e) {}
    return;
  }
  if (!pmWith) { alert("Сначала выбери диалог (слева или из профиля)"); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    pmVoiceChunks = [];
    pmRecorder = new MediaRecorder(stream);
    pmRecorder.ondataavailable = (e) => { if (e.data && e.data.size) pmVoiceChunks.push(e.data); };
    pmRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      pmRecording = false;
      if (btn) { btn.textContent = '🎤'; btn.style.background = '#6f42c1'; }
      clearTimeout(pmVoiceTimer);
      const blob = new Blob(pmVoiceChunks, { type: pmRecorder.mimeType || 'audio/webm' });
      pmVoiceChunks = [];
      if (blob.size < 200) return; // пустое
      await sendVoiceMessage(blob);
    };
    pmRecorder.start();
    pmRecording = true;
    if (btn) { btn.textContent = '⏹'; btn.style.background = '#dc3545'; }
    // Автостоп через 60 секунд
    pmVoiceTimer = setTimeout(() => { try { pmRecorder && pmRecorder.stop(); } catch (e) {} }, 60000);
  } catch (e) {
    alert('Нет доступа к микрофону: ' + e.message);
  }
}

async function sendVoiceMessage(blob) {
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const res = await fetch(`${SERVER_API_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: currentUser, to: pmWith, voice: dataUrl })
    });
    const data = await res.json();
    if (!data.success) { alert(data.message || 'Ошибка'); return; }
    loadPmChat();
    loadPmInbox();
  } catch (e) { alert('Ошибка отправки голосового'); }
}

// --- Привязки ---
bindClick("pmVoiceBtn", pmToggleVoice);
bindClick("adminShotsLoadBtn", loadAdminShots);
bindClick("adminPurchasesLoadBtn", loadAdminPurchases);
loadShopItems();

// ==================== 3.7.0: КРАШ, ДУЭЛЬ, КАРМА, ДНО ДНЯ ====================

// --- Краш ---
let crashPhase = 'idle';
let crashRound = 0;
let crashMyBet = null; // {bet, cashed, mult}
let crashLastMult = 1;

function crashSetMult(m) {
  crashLastMult = m;
  const el = document.getElementById("crashMult");
  if (!el) return;
  el.textContent = '×' + m.toFixed(2);
  el.style.color = m >= 2 ? '#ffc107' : '#2ecc71';
}

function crashUpdateUI() {
  const sub = document.getElementById("crashSub");
  const betBtn = document.getElementById("crashBetBtn");
  const outBtn = document.getElementById("crashCashoutBtn");
  const amt = document.getElementById("crashBetAmount");
  if (!sub || !betBtn || !outBtn) return;

  if (crashPhase === 'bet') {
    sub.textContent = '⏳ Приём ставок...';
    sub.style.color = '#4da6ff';
    betBtn.style.display = '';
    outBtn.style.display = 'none';
    if (amt) amt.disabled = false;
  } else if (crashPhase === 'run') {
    sub.textContent = '🚀 Летит! Успей забрать';
    sub.style.color = '#2ecc71';
    betBtn.style.display = 'none';
    if (crashMyBet && !crashMyBet.cashed) {
      outBtn.style.display = '';
      outBtn.textContent = `Забрать ${Math.floor(crashMyBet.bet * crashLastMult)}$`;
    } else {
      outBtn.style.display = 'none';
    }
    if (amt) amt.disabled = true;
  } else {
    sub.textContent = 'Жди раунд...';
    sub.style.color = '#888';
    betBtn.style.display = '';
    outBtn.style.display = 'none';
    if (amt) amt.disabled = true;
  }
}

function crashRenderHistory(h) {
  const box = document.getElementById("crashHistory");
  if (!box) return;
  box.innerHTML = 'Последние крахи: ' + (h || []).slice(0, 12).map(x =>
    `<span style="color:${x.crashPoint >= 2 ? '#2ecc71' : '#ff6b6b'}; margin-right:6px;">×${x.crashPoint.toFixed(2)}</span>`
  ).join('');
}

async function crashLoadState() {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/crash/state?username=${encodeURIComponent(currentUser)}`);
    const data = await res.json();
    crashPhase = data.phase;
    crashRound = data.round;
    crashMyBet = data.myBet;
    crashRenderHistory(data.history);
    crashSetMult(data.phase === 'run' ? data.mult : 1);
    crashUpdateUI();
  } catch (e) {}
}

window.crashPlaceBet = async () => {
  const amt = Math.floor(Number(document.getElementById("crashBetAmount")?.value || 0));
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/crash/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, amount: amt })
    });
    const data = await res.json();
    const sub = document.getElementById("crashSub");
    if (!data.success) {
      if (sub) { sub.textContent = data.message; sub.style.color = '#ff6b6b'; }
      return;
    }
    crashMyBet = { bet: amt, cashed: false, mult: 0 };
    casinoSetBalance(data.balance);
    crashUpdateUI();
  } catch (e) {}
};

window.crashTake = async () => {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/crash/cashout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser })
    });
    const data = await res.json();
    if (!data.success) return;
    if (crashMyBet) { crashMyBet.cashed = true; crashMyBet.mult = data.mult; }
    casinoSetBalance(data.balance);
    const sub = document.getElementById("crashSub");
    if (sub) { sub.textContent = `✅ Забрал ×${data.mult.toFixed(2)} = +${data.winnings}$`; sub.style.color = '#2ecc71'; }
    crashUpdateUI();
  } catch (e) {}
};

// --- Дуэль ---
window.duelChallenge = async () => {
  const to = (document.getElementById("duelOpponent")?.value || '').trim().toLowerCase();
  const bet = Math.floor(Number(document.getElementById("duelBet")?.value || 0));
  const box = document.getElementById("duelBox");
  if (!to) { if (box) box.innerHTML = '<span style="color:#ff6b6b;">Впиши ник соперника</span>'; return; }
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/duel/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: currentUser, to, bet })
    });
    const data = await res.json();
    if (!data.success) { if (box) box.innerHTML = `<span style="color:#ff6b6b;">${escapeHtml(data.message || 'Ошибка')}</span>`; return; }
    if (box) box.innerHTML = `<span style="color:#4da6ff;">⚔️ Вызов ${escapeHtml(to)} на ${bet}$ отправлен — жди ответа (90 сек)...</span>`;
  } catch (e) {}
};

window.duelRespond = async (id, accept) => {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/duel/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, username: currentUser, accept })
    });
    const data = await res.json();
    const box = document.getElementById("duelBox");
    if (!data.success) { if (box) box.innerHTML = `<span style="color:#ff6b6b;">${escapeHtml(data.message || 'Ошибка')}</span>`; return; }
    if (box) box.innerHTML = '<span style="color:#4da6ff;">⚔️ Крутим барабаны...</span>';
  } catch (e) {}
};

function duelShowResult(d) {
  const box = document.getElementById("duelBox");
  if (!box) return;
  if (d.expired) { box.innerHTML = `<span style="color:#ff6b6b;">⏱ ${escapeHtml(d.message || 'Время вышло')}</span>`; return; }
  if (d.declined) { box.innerHTML = `<span style="color:#ff6b6b;">🚫 ${escapeHtml(d.message || 'Отказ')}</span>`; return; }
  const reels = (r) => (r || []).join(' ');
  const me = reels(d.yourReels), opp = reels(d.oppReels);
  if (d.tie) {
    box.innerHTML = `🤝 Ничья! ${escapeHtml(d.you)}: ${me} — ${escapeHtml(d.opp)}: ${opp}. Ставки возвращены.`;
    box.style.color = '#ccc';
  } else if (d.youWin) {
    box.innerHTML = `🏆 <b>Ты выиграл ${d.bet * 2}$!</b><br>Твои: ${me}<br>${escapeHtml(d.opp)}: ${opp}`;
    box.style.color = '#2ecc71';
  } else {
    box.innerHTML = `💀 <b>Проиграл ${d.bet}$</b><br>Твои: ${me}<br>${escapeHtml(d.opp)}: ${opp}`;
    box.style.color = '#ff6b6b';
  }
  if (typeof d.balance === 'number') casinoSetBalance(d.balance);
  loadCasinoTop();
}

function bindCasinoGameHandlers() {
  if (!socket) return;

  socket.on('crash_phase', (d) => {
    crashPhase = d.phase;
    if (d.round) crashRound = d.round;
    if (d.history) crashRenderHistory(d.history);
    if (d.phase === 'bet') {
      crashMyBet = null;
      crashSetMult(1);
    } else if (d.phase === 'run') {
      crashSetMult(1);
    } else if (d.phase === 'done') {
      const sub = document.getElementById("crashSub");
      if (sub) {
        if (crashMyBet) {
          if (crashMyBet.cashed) {
            sub.textContent = `✅ Забрал ×${(crashMyBet.mult || 1).toFixed(2)} до краха`;
            sub.style.color = '#2ecc71';
          } else {
            sub.textContent = `💥 Сгорело на ×${d.crashPoint.toFixed(2)}`;
            sub.style.color = '#ff6b6b';
          }
        } else {
          sub.textContent = `💥 Крах на ×${d.crashPoint.toFixed(2)}`;
          sub.style.color = '#ff6b6b';
        }
      }
      crashMyBet = null;
    }
    crashUpdateUI();
  });

  socket.on('crash_tick', (d) => {
    if (d.round !== crashRound) return;
    crashSetMult(d.mult);
    crashUpdateUI();
  });

  socket.on('duel_challenge', (d) => {
    const box = document.getElementById("duelBox");
    if (!box) return;
    box.innerHTML = `⚔️ <b>${escapeHtml(d.from)}</b> вызывает тебя на дуэль — ставка <b>${d.bet}$</b>!
      <button class="template-btn" style="background:#198754; font-size:11px; padding:3px 10px; margin-left:6px;" onclick="duelRespond('${d.id}', true)">Принять</button>
      <button class="template-btn" style="background:#333; font-size:11px; padding:3px 10px;" onclick="duelRespond('${d.id}', false)">Отказ</button>`;
    box.style.color = '#ffc107';
    playNoticeSound();
  });

  socket.on('duel_result', (d) => {
    duelShowResult(d);
    playNoticeSound();
  });
}

// --- Карма ---
window.karmaVote = async (to, value) => {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/karma`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: currentUser, to, value })
    });
    const data = await res.json();
    if (!data.success) { alert(data.message || 'Ошибка'); return; }
    loadHQRoster();
  } catch (e) { alert('Ошибка соединения'); }
};

// --- Дно дня (админка) ---
window.loadAdminDno = async () => {
  const box = document.getElementById("adminDnoBox");
  if (!box) return;
  const date = document.getElementById("adminDnoDate")?.value || '';
  try {
    const res = await fetch(`${SERVER_API_URL}/api/admin/dayreport?admin=${encodeURIComponent(currentUser)}&date=${encodeURIComponent(date)}`);
    const data = await res.json();
    if (!data.success) { box.innerHTML = '<p style="color:red;">Ошибка</p>'; return; }
    const b = data.bottoms || {};
    const rows = [...(data.rows || [])].sort((a, b2) => (a.truffles + a.approves) - (b2.truffles + b2.approves));
    box.innerHTML = `<table style="width:100%; font-size:11px; border-collapse:collapse;">
      <tr style="color:#888;"><td>Ник</td><td>Команда</td><td>💎</td><td>✅</td><td>AFK</td></tr>
      ${rows.map(r => {
        const isDno = r.username === b.truffles || r.username === b.approves || r.username === b.idle;
        const idleTxt = r.idleMin === null ? '—' : (r.idleMin < 1 ? 'сейчас' : r.idleMin + ' мин');
        return `<tr style="border-top:1px solid #333; ${isDno ? 'background:#3d1e1e; color:#ff6b6b;' : ''}">
          <td>${escapeHtml(r.username)}${r.username === b.truffles ? ' 💎' : ''}${r.username === b.approves ? ' ✅' : ''}${r.username === b.idle ? ' 💤' : ''}</td>
          <td>${escapeHtml(r.team)}</td><td>${r.truffles}</td><td>${r.approves}</td><td>${idleTxt}</td>
        </tr>`;
      }).join('')}
    </table>`;
  } catch (e) {
    box.innerHTML = '<p style="color:red;">Ошибка соединения</p>';
  }
};

// --- Пинг активности (для «дна дня») ---
setInterval(() => {
  if (!currentUser) return;
  fetch(`${SERVER_API_URL}/api/activity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser })
  }).catch(() => {});
}, 60000);

// --- Привязки ---
bindClick("crashBetBtn", crashPlaceBet);
bindClick("crashCashoutBtn", crashTake);
bindClick("duelChallengeBtn", duelChallenge);
bindClick("adminDnoLoadBtn", loadAdminDno);
bindClick("optUpBtn", () => optPlaceBet('up'));
bindClick("optDownBtn", () => optPlaceBet('down'));

// Начисление бабок в казино (админ)
window.adminGrant = async () => {
  const username = (document.getElementById("adminGrantNick")?.value || '').trim().toLowerCase();
  const amount = Math.floor(Number(document.getElementById("adminGrantAmount")?.value || 0));
  const status = document.getElementById("adminGrantStatus");
  if (!username || !amount) { if (status) status.textContent = 'Впиши ник и сумму (не 0)'; return; }
  try {
    const res = await fetch(`${SERVER_API_URL}/api/admin/casino/grant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser, username, amount })
    });
    const data = await res.json();
    if (!data.success) { if (status) { status.style.color = '#ff6b6b'; status.textContent = data.message || 'Ошибка'; } return; }
    if (status) { status.style.color = '#2ecc71'; status.textContent = `${username}: теперь ${data.balance}$ ✔`; }
    const amt = document.getElementById("adminGrantAmount");
    if (amt) amt.value = '';
  } catch (e) {
    if (status) { status.style.color = '#ff6b6b'; status.textContent = 'Ошибка соединения'; }
  }
};
bindClick("adminGrantBtn", adminGrant);

// ==================== 3.9.0: ДОДЕП (клиент) ====================

// Мой додеп: показываем статус или форму запроса
window.doddepMyRemaining = 0;
window.doddepLoadMy = async () => {
  const status = document.getElementById("doddepMyStatus");
  const form = document.getElementById("doddepForm");
  const repayRow = document.getElementById("doddepRepayRow");
  if (!status || !form) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/doddep/my?username=${encodeURIComponent(currentUser)}`);
    const d = await res.json();
    if (!d.success || !d.loan) {
      status.textContent = '';
      form.style.display = '';
      if (repayRow) repayRow.style.display = 'none';
      return;
    }
    form.style.display = 'none';
    if (d.loan.status === 'pending') {
      status.textContent = `⏳ Запрос на ${d.loan.amount}$ на рассмотрении у админа...`;
      status.style.color = '#ffc107';
      if (repayRow) repayRow.style.display = 'none';
    } else {
      window.doddepMyRemaining = d.loan.remaining;
      status.textContent = `🏦 Активный додеп: ${d.loan.amount}$ · остаток долга ${d.loan.remaining}$ · возврат ${d.loan.dailyReturn}$/день из ЗП`;
      status.style.color = '#e0aaff';
      if (repayRow) repayRow.style.display = '';
    }
  } catch (e) {}
};

window.doddepRequest = async () => {
  const amount = Math.floor(Number(document.getElementById("doddepAmount")?.value || 0));
  const status = document.getElementById("doddepMyStatus");
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/doddep/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, amount })
    });
    const data = await res.json();
    if (!data.success) {
      if (status) { status.textContent = '❌ ' + (data.message || 'Ошибка'); status.style.color = '#ff6b6b'; }
      return;
    }
    if (status) { status.textContent = `⏳ Запрос на ${amount}$ отправлен админу — жди подтверждения`; status.style.color = '#ffc107'; }
    const form = document.getElementById("doddepForm");
    if (form) form.style.display = 'none';
  } catch (e) {}
};
bindClick("doddepBtn", doddepRequest);

// ==================== 3.11.0: ВОЗВРАТ ДОЛГА ====================
async function doddepDoRepay(amount) {
  const status = document.getElementById("doddepMyStatus");
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/doddep/repay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, amount })
    });
    const data = await res.json();
    if (!data.success) {
      if (status) { status.textContent = '❌ ' + (data.message || 'Ошибка'); status.style.color = '#ff6b6b'; }
      return false;
    }
    casinoSetBalance(data.balance);
    if (status) {
      status.textContent = data.closed ? `🎉 Долг погашен полностью! Баланс: ${data.balance}$` : `🏦 Возвращено. Остаток долга: ${data.remaining}$ · баланс: ${data.balance}$`;
      status.style.color = data.closed ? '#20c997' : '#e0aaff';
    }
    doddepLoadMy();
    return true;
  } catch (e) { return false; }
}

window.doddepRepayFull = () => { doddepDoRepay(null); };

window.doddepRepayPart = async () => {
  const modal = document.getElementById("repayModal");
  const inp = document.getElementById("repayModalInput");
  const msg = document.getElementById("repayModalMsg");
  if (!modal) return;
  try {
    const [r1, r2] = await Promise.all([
      fetch(`${SERVER_API_URL}/api/casino/doddep/my?username=${encodeURIComponent(currentUser)}`),
      fetch(`${SERVER_API_URL}/api/casino/state?username=${encodeURIComponent(currentUser)}`)
    ]);
    const d1 = await r1.json();
    const d2 = await r2.json();
    if (d1.success && d1.loan && d2.success) {
      window.doddepMyRemaining = d1.loan.remaining;
      const rem = document.getElementById("repayModalRemain");
      const bal = document.getElementById("repayModalBalance");
      if (rem) rem.textContent = d1.loan.remaining + '$';
      if (bal) bal.textContent = d2.balance + '$';
      if (inp) inp.max = d1.loan.remaining;
    }
  } catch (e) {}
  if (inp) inp.value = '';
  if (msg) msg.textContent = '';
  modal.classList.add('open');
};

bindClick("doddepRepayFullBtn", () => doddepRepayFull());
bindClick("doddepRepayPartBtn", () => doddepRepayPart());
bindClick("repayModalCancel", () => document.getElementById("repayModal")?.classList.remove('open'));
bindClick("repayModalOk", async () => {
  const inp = document.getElementById("repayModalInput");
  const msg = document.getElementById("repayModalMsg");
  const amount = Math.floor(Number(inp?.value || 0));
  if (!amount || amount <= 0) { if (msg) msg.textContent = 'Введи сумму больше 0'; return; }
  if (window.doddepMyRemaining && amount > window.doddepMyRemaining) { if (msg) msg.textContent = `Больше остатка долга (${window.doddepMyRemaining}$)`; return; }
  const ok = await doddepDoRepay(amount);
  if (ok) document.getElementById("repayModal")?.classList.remove('open');
  else if (msg) msg.textContent = 'Не получилось — проверь баланс';
});

// Админка: список додепов + решения
window.loadAdminDoddep = async () => {
  const box = document.getElementById("adminDoddepBox");
  if (!box) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/admin/doddep/list?admin=${encodeURIComponent(currentUser)}`);
    const data = await res.json();
    if (!data.success) { box.innerHTML = `<p style="color:red;">${escapeHtml(data.message || 'Ошибка')}</p>`; return; }
    let html = '';
    if (data.pending && data.pending.length) {
      html += '<p style="color:#ffc107; margin:4px 0;">Новые запросы:</p>' + data.pending.map(l => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 2px; border-bottom:1px solid #2a323c;">
          <span><b>${escapeHtml(l.username)}</b> — ${l.amount}$ (возврат ${l.dailyReturn}$/день) · ${new Date(l.createdAt).toLocaleString('ru-RU')}</span>
          <span>
            <button class="template-btn" style="background:#198754; font-size:11px; padding:3px 10px;" onclick="adminDoddepDecide('${l._id}', true)">✅ Начислить</button>
            <button class="template-btn" style="background:#333; font-size:11px; padding:3px 10px;" onclick="adminDoddepDecide('${l._id}', false)">❌</button>
          </span>
        </div>`).join('');
    } else {
      html += '<p style="color:#777; margin:4px 0;">Новых запросов нет</p>';
    }
    if (data.active && data.active.length) {
      html += '<p style="color:#4da6ff; margin:8px 0 4px;">Активные займы:</p>' + data.active.map(l => `
        <div style="padding:5px 2px; border-bottom:1px solid #2a323c; font-size:12px;">
          <b>${escapeHtml(l.username)}</b> — долг ${l.remaining}$ из ${l.amount}$ · ${l.dailyReturn}$/день
        </div>`).join('');
    }
    box.innerHTML = html || '<p style="color:#777;">Пусто</p>';
  } catch (e) {
    box.innerHTML = '<p style="color:red;">Ошибка соединения</p>';
  }
};

window.adminDoddepDecide = async (id, approve) => {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/admin/doddep/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser, id, approve })
    });
    const data = await res.json();
    if (!data.success) { alert(data.message || 'Ошибка'); return; }
    loadAdminDoddep();
  } catch (e) { alert('Ошибка соединения'); }
};
bindClick("adminDoddepLoadBtn", loadAdminDoddep);

// ==================== 3.10.0: КАЗИНО — заставка, лобби, комнаты, блекджек ====================

let casinoSplashTimer = null;
let casinoSplashDone = false;

// Вход в казино: заставка ~5 секунд → лобби
window.casinoEnter = () => {
  casinoLoadState();
  loadCasinoTop();
  const splash = document.getElementById("casinoSplash");
  const lobby = document.getElementById("casinoLobby");
  if (!splash || !lobby) return; // старая разметка — страховка
  closeCasinoRoom(true);
  lobby.style.display = 'none';
  splash.style.display = 'flex';
  casinoSplashDone = false;

  const fill = document.getElementById("casinoSplashFill");
  const hint = document.getElementById("casinoSplashHint");
  if (hint) hint.textContent = 'Прогружаем барабаны...';
  const start = Date.now();
  const DUR = 5000;
  if (casinoSplashTimer) clearInterval(casinoSplashTimer);
  casinoSplashTimer = setInterval(() => {
    const p = Math.min(100, ((Date.now() - start) / DUR) * 100);
    if (fill) fill.style.width = p + '%';
    if (p >= 100) {
      clearInterval(casinoSplashTimer);
      casinoSplashTimer = null;
      casinoShowLobby();
    }
  }, 100);
};

// Клик по заставке — пропустить
window.casinoSkipSplash = () => {
  if (casinoSplashDone) return;
  if (casinoSplashTimer) { clearInterval(casinoSplashTimer); casinoSplashTimer = null; }
  casinoShowLobby();
};

function casinoShowLobby() {
  casinoSplashDone = true;
  const splash = document.getElementById("casinoSplash");
  const lobby = document.getElementById("casinoLobby");
  if (splash) splash.style.display = 'none';
  if (lobby) lobby.style.display = '';
  loadCasinoTop();
}

// Открыть комнату
window.openCasinoRoom = (room) => {
  casinoSkipSplash();
  const lobby = document.getElementById("casinoLobby");
  if (lobby) lobby.style.display = 'none';
  document.querySelectorAll('.casino-room').forEach(r => r.style.display = 'none');
  const el = document.getElementById('room-' + room);
  if (el) el.style.display = '';
  // загрузчики комнат
  if (room === 'crash') crashLoadState();
  else if (room === 'options') optionsLoadState();
  else if (room === 'bank') { doddepLoadMy(); loadShopItems(); }
  else if (room === 'blackjack') bjLoadState();
  else if (room === 'slot') slotSetTheme(slotTheme);
  else if (room === 'wheel') wheelLoad();
  else if (room === 'lottery') lotteryLoad();
  else if (room === 'mines') minesRender(null);
  else if (room === 'poker') { pokerHeld = []; pokerRenderHand(null); }
  else if (room === 'snake') snakeShowBest();
  else if (room === 'race') raceEnter();
  else if (room === 'case') caseEnter();
  else if (room === 'rr') rrEnter();
};

// Назад в лобби
window.closeCasinoRoom = (silent) => {
  document.querySelectorAll('.casino-room').forEach(r => r.style.display = 'none');
  const lobby = document.getElementById("casinoLobby");
  if (lobby && (casinoSplashDone || silent)) lobby.style.display = '';
};

// ==================== БЛЕКДЖЕК (клиент) ====================

function bjCardHtml(c) {
  if (!c) return '<span class="bj-card bj-back">🂠</span>';
  const red = c.s === '♥' || c.s === '♦';
  return `<span class="bj-card ${red ? 'bj-red' : ''}">${c.r}${c.s}</span>`;
}

function bjRender(g) {
  const dEl = document.getElementById("bjDealer");
  const pEl = document.getElementById("bjPlayer");
  const dSum = document.getElementById("bjDealerSum");
  const pSum = document.getElementById("bjPlayerSum");
  const st = document.getElementById("bjStatus");
  const betRow = document.getElementById("bjBetRow");
  const actions = document.getElementById("bjActions");
  if (!g) {
    if (dEl) dEl.innerHTML = '—';
    if (pEl) pEl.innerHTML = '—';
    if (dSum) dSum.textContent = '';
    if (pSum) pSum.textContent = '';
    if (st) st.textContent = '';
    if (betRow) betRow.style.display = '';
    if (actions) actions.style.display = 'none';
    return;
  }
  if (dEl) dEl.innerHTML = g.dealer.map(bjCardHtml).join('');
  if (pEl) pEl.innerHTML = g.player.map(bjCardHtml).join('');
  if (dSum) dSum.textContent = g.status === 'done' ? `(${g.dealerSum})` : `(открыто ${g.dealerSum})`;
  if (pSum) pSum.textContent = `(${g.playerSum}${g.playerBJ ? ' — БЛЕКДЖЕК!' : ''})`;
  const inGame = g.status === 'player';
  if (betRow) betRow.style.display = inGame ? 'none' : '';
  if (actions) actions.style.display = inGame ? '' : 'none';
  if (st && g.status === 'done') {
    const texts = {
      win: `🏆 Победа! +${g.bet}$`,
      bj: `🌟 БЛЕКДЖЕК! +${Math.floor(g.bet * 1.5)}$ чистыми (×2.5)`,
      push: '🤝 Ничья — ставка возвращена',
      lose: `💀 Проигрыш −${g.bet}$`
    };
    st.textContent = (texts[g.result] || '') + ' — «Раздать» для новой раздачи';
    st.style.color = g.result === 'win' || g.result === 'bj' ? '#2ecc71' : g.result === 'push' ? '#888' : '#ff6b6b';
  }
}

window.bjLoadState = async () => {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/blackjack/state?username=${encodeURIComponent(currentUser)}`);
    const d = await res.json();
    bjRender(d.game);
  } catch (e) {}
};

window.bjStart = async () => {
  const bet = Math.floor(Number(document.getElementById("bjBet")?.value || 0));
  const st = document.getElementById("bjStatus");
  try {
    const res = await fetch(`${SERVER_API_URL}/api/blackjack/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, bet })
    });
    const data = await res.json();
    if (!data.success) {
      if (st) { st.textContent = '❌ ' + (data.message || 'Ошибка'); st.style.color = '#ff6b6b'; }
      return;
    }
    casinoSetBalance(data.balance);
    if (st) st.textContent = '';
    bjRender(data.game);
  } catch (e) {}
};

window.bjAction = async (action) => {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/blackjack/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, action })
    });
    const data = await res.json();
    if (!data.success) {
      const st = document.getElementById("bjStatus");
      if (st) { st.textContent = '❌ ' + (data.message || 'Ошибка'); st.style.color = '#ff6b6b'; }
      return;
    }
    casinoSetBalance(data.balance);
    bjRender(data.game);
    if (data.game.status === 'done' && (data.game.result === 'win' || data.game.result === 'bj')) playNoticeSound();
  } catch (e) {}
};

bindClick("bjStartBtn", bjStart);
bindClick("bjHitBtn", () => bjAction('hit'));
bindClick("bjStandBtn", () => bjAction('stand'));
bindClick("bjDoubleBtn", () => bjAction('double'));

// ==================== 3.9.0: ОПЦИОНЫ (клиент) ====================

let optPhase = 'idle';
let optRound = 0;
let optEndsAt = 0;
let optStartPrice = 100;
let optPrice = 100;
let optHistory = [];
let optMyBet = null;
let optTicks = [];
let optTimerInt = null;

function optDraw() {
  const cv = document.getElementById("optChart");
  if (!cv) return;
  if(window.CasinoArt)return CasinoArt.chart(cv,optTicks,optStartPrice,optPrice);
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  // сетка
  ctx.strokeStyle = '#1d232c';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(0, H * i / 4); ctx.lineTo(W, H * i / 4); ctx.stroke();
  }
  const ticks = optTicks.length ? optTicks : [optStartPrice];
  const all = [...ticks, optStartPrice];
  let min = Math.min(...all), max = Math.max(...all);
  if (max - min < 2) { max += 1; min -= 1; }
  const px = (i) => ticks.length > 1 ? (i / (ticks.length - 1)) * (W - 10) + 5 : W / 2;
  const py = (p) => H - 8 - ((p - min) / (max - min)) * (H - 16);
  // уровень старта
  ctx.strokeStyle = '#888';
  ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(0, py(optStartPrice)); ctx.lineTo(W, py(optStartPrice)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.fillText('старт ' + optStartPrice.toFixed(2), 4, py(optStartPrice) - 3);
  // линия цены
  const up = optPrice >= optStartPrice;
  ctx.strokeStyle = up ? '#2ecc71' : '#e74c3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ticks.forEach((p, i) => { i === 0 ? ctx.moveTo(px(i), py(p)) : ctx.lineTo(px(i), py(p)); });
  ctx.stroke();
  // точка конца
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath(); ctx.arc(px(ticks.length - 1), py(optPrice), 3.5, 0, Math.PI * 2); ctx.fill();
}

function optUpdateUI() {
  const status = document.getElementById("optStatus");
  const my = document.getElementById("optMyBet");
  const upBtn = document.getElementById("optUpBtn");
  const downBtn = document.getElementById("optDownBtn");
  if (status) {
    if (optPhase === 'bet') {
      status.textContent = `⏳ Раунд #${optRound}: приём ставок — цена стартует с ${optStartPrice.toFixed(2)}`;
      status.style.color = '#ffc107';
    } else if (optPhase === 'run') {
      const dir = optPrice >= optStartPrice ? 'ВВЕРХ 🟢' : 'ВНИЗ 🔴';
      status.textContent = `▶️ Раунд #${optRound}: ${optPrice.toFixed(2)} (${dir}) — выплата ×1.8`;
      status.style.color = optPrice >= optStartPrice ? '#2ecc71' : '#ff6b6b';
    } else {
      status.textContent = 'Жди следующий раунд...';
      status.style.color = '#888';
    }
  }
  if (my) {
    my.textContent = optMyBet
      ? `Твоя ставка: ${optMyBet.amount}$ на ${optMyBet.dir === 'up' ? '🟢 ВВЕРХ' : '🔴 ВНИЗ'}`
      : '';
  }
  const canBet = optPhase === 'bet' && !optMyBet;
  if (upBtn) { upBtn.disabled = !canBet; upBtn.style.opacity = canBet ? '1' : '0.4'; }
  if (downBtn) { downBtn.disabled = !canBet; downBtn.style.opacity = canBet ? '1' : '0.4'; }
  // история стрелками
  const hist = document.getElementById("optHistory");
  if (hist) {
    hist.innerHTML = 'История: ' + (optHistory.slice(0, 10).map(h =>
      h.dir === 'up' ? '<span style="color:#2ecc71;">▲</span>'
      : h.dir === 'down' ? '<span style="color:#e74c3c;">▼</span>' : '<span style="color:#888;">◆</span>'
    ).join(' ') || '—');
  }
  optDraw();
}

function optRenderHistory(h) {
  if (Array.isArray(h)) { optHistory = h; optUpdateUI(); }
}

function optStartTimer() {
  if (optTimerInt) clearInterval(optTimerInt);
  const el = document.getElementById("optTimer");
  optTimerInt = setInterval(() => {
    const left = Math.max(0, optEndsAt - Date.now());
    if (el) {
      el.textContent = (optPhase === 'bet' || optPhase === 'run') ? (left / 1000).toFixed(1) + ' сек' : '';
    }
    if (left <= 0 && optPhase !== 'run') { /* ждём событие с сервера */ }
  }, 100);
}

async function optionsLoadState() {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/options/state?username=${encodeURIComponent(currentUser)}`);
    const d = await res.json();
    optPhase = d.phase;
    optRound = d.round;
    optEndsAt = d.endsAt || 0;
    optStartPrice = d.startPrice;
    optPrice = d.price;
    optMyBet = d.myBet;
    optHistory = d.history || [];
    optTicks = [optStartPrice];
    optStartTimer();
    optUpdateUI();
  } catch (e) {}
}

window.optPlaceBet = async (dir) => {
  const amt = Math.floor(Number(document.getElementById("optBetAmount")?.value || 0));
  try {
    const res = await fetch(`${SERVER_API_URL}/api/options/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, amount: amt, dir })
    });
    const data = await res.json();
    if (!data.success) {
      const s = document.getElementById("optStatus");
      if (s) { s.textContent = '❌ ' + (data.message || 'Ошибка'); s.style.color = '#ff6b6b'; }
      return;
    }
    optMyBet = { amount: amt, dir };
    casinoSetBalance(data.balance);
    optUpdateUI();
  } catch (e) {}
};

function bindOptionsHandlers() {
  if (!socket) return;
  socket.on('option_phase', (d) => {
    optPhase = d.phase;
    if (d.round) optRound = d.round;
    if (d.endsAt) optEndsAt = d.endsAt;
    if (typeof d.startPrice === 'number') { optStartPrice = d.startPrice; optPrice = d.startPrice; }
    if (d.phase === 'bet') { optMyBet = null; optTicks = [optStartPrice]; }
    if (d.phase === 'run') optTicks = [optStartPrice];
    if (Array.isArray(d.history)) optHistory = d.history;
    if (d.phase === 'done' && typeof d.endPrice === 'number') {
      optPrice = d.endPrice;
      optTicks.push(d.endPrice);
      const s = document.getElementById("optStatus");
      if (s) {
        s.textContent = d.dir === 'flat'
          ? `◆ Раунд #${d.round}: ничья ${d.endPrice.toFixed(2)} — ставки возвращены`
          : `${d.dir === 'up' ? '🟢' : '🔴'} Раунд #${d.round}: финал ${d.endPrice.toFixed(2)}`;
        s.style.color = d.dir === 'up' ? '#2ecc71' : d.dir === 'down' ? '#ff6b6b' : '#888';
      }
    }
    optStartTimer();
    optUpdateUI();
  });
  socket.on('option_tick', (d) => {
    if (d.round !== optRound) return;
    optPrice = d.price;
    optTicks.push(d.price);
    if (optTicks.length > 200) optTicks.shift();
    optUpdateUI();
  });
  socket.on('option_result', (d) => {
    if (typeof d.balance === 'number') casinoSetBalance(d.balance);
    const s = document.getElementById("optStatus");
    if (s) {
      if (d.win) { s.textContent = `🏆 Угадал! +${d.payout}$ (${d.dir === 'up' ? 'вверх' : 'вниз'})`; s.style.color = '#2ecc71'; }
      else if (d.dir === 'flat') { s.textContent = `◆ Ничья — возврат ${d.payout}$`; s.style.color = '#888'; }
      else { s.textContent = `💀 Мимо. Цена пошла ${d.dir === 'up' ? 'вверх' : 'вниз'} — ставка сгорела`; s.style.color = '#ff6b6b'; }
    }
    if (d.win) playNoticeSound();
    optMyBet = null;
    optUpdateUI();
  });
}

// ==================== 3.8.0: МОРСКОЙ БОЙ ====================

const BS_PALETTE = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
const BS_LETTERS = 'АБВГДЕЖЗИК';
let bsView = null;          // последний вид игры с сервера
let bsPlaced = [];          // расставленные корабли [{cells:[{x,y}]}]
let bsCursor = 0;           // какой корабль ставим
let bsHoriz = true;
let bsPlacedSent = false;
let bsWasMyTurn = false;
let bsLastId = '';
let bsMines = [];           // 3.9.0: мины, поставленные при расстановке [{x,y}]
let bsRadarZone = [];       // 3.9.0: зона радара (подсветка на вражеской доске)
let bsClockOffset = 0;      // 3.9.0: расхождение с серверным временем
let bsRapidTimer = null;    // 3.9.0: тикер кулдауна rapid
let bsLastOpponent = '';    // 3.9.0: для реванша
let bsLastBet = 10;
let bsLastMode = 'classic';
let bsLastRandom = false;

function bsBanner(html, cls) {
  const b = document.getElementById("bsBanner");
  if (!b) return;
  b.innerHTML = html ? `<div class="bs-result-banner ${cls}">${html}</div>` : '';
}

function bsShowSetup() {
  document.getElementById("bsSetup").style.display = '';
  document.getElementById("bsGame").style.display = 'none';
  document.getElementById("bsPlacement").style.display = 'none';
  const sb = document.getElementById("bsSurrenderBtn");
  if (sb) sb.style.display = 'none';
}

function bsUsedCells() {
  const m = new Map();
  bsPlaced.forEach((ship, idx) => ship.cells.forEach(c => m.set(c.x + ',' + c.y, idx)));
  return m;
}

function bsCanPlace(x, y, len, horiz) {
  const cells = [];
  for (let i = 0; i < len; i++) cells.push({ x: x + (horiz ? i : 0), y: y + (horiz ? 0 : i) });
  if (cells.some(c => c.x < 0 || c.x > 9 || c.y < 0 || c.y > 9)) return null;
  const used = bsUsedCells();
  for (const c of cells) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (used.has((c.x + dx) + ',' + (c.y + dy))) return null;
    }
  }
  return cells;
}

function bsClearPreview() {
  document.querySelectorAll('#bsMyBoard .bs-cell.preview, #bsMyBoard .bs-cell.preview-bad')
    .forEach(c => c.classList.remove('preview', 'preview-bad'));
}

function bsRenderPlacement() {
  const board = document.getElementById("bsMyBoard");
  if (!board) return;
  board.classList.remove('active');
  const shipsDone = bsCursor >= BS_PALETTE.length;
  bsDrawBoard(board, (x, y, cell) => {
    const used = bsUsedCells();
    const isShipCell = used.has(x + ',' + y);
    if (isShipCell) cell.classList.add('ship');
    const mineIdx = bsMines.findIndex(m => m.x === x && m.y === y);
    if (mineIdx >= 0) cell.classList.add('mine-own');

    if (!shipsDone) {
      cell.onmouseenter = () => {
        bsClearPreview();
        const cells = bsCanPlace(x, y, BS_PALETTE[bsCursor], bsHoriz);
        const preview = cells || (() => {
          // показываем что влезает
          const all = [];
          for (let i = 0; i < BS_PALETTE[bsCursor]; i++) all.push({ x: x + (bsHoriz ? i : 0), y: y + (bsHoriz ? 0 : i) });
          return all.filter(c => c.x >= 0 && c.x <= 9 && c.y >= 0 && c.y <= 9);
        })();
        preview.forEach(c => {
          const el = board.querySelector(`[data-x="${c.x}"][data-y="${c.y}"]`);
          if (el) el.classList.add(cells ? 'preview' : 'preview-bad');
        });
      };
      cell.onclick = () => {
        if (bsCursor >= BS_PALETTE.length || bsPlacedSent) return;
        const cells = bsCanPlace(x, y, BS_PALETTE[bsCursor], bsHoriz);
        if (!cells) return;
        bsPlaced.push({ cells });
        bsCursor++;
        bsClearPreview();
        bsRenderPlacement();
      };
    } else {
      // фаза мин: клик по пустой воде — поставить/убрать мину
      cell.onmouseenter = () => {
        bsClearPreview();
        if (bsPlacedSent || isShipCell) return;
        if (bsMines.length < 3 && mineIdx < 0) cell.classList.add('preview');
      };
      cell.onclick = () => {
        if (bsPlacedSent || isShipCell) return;
        const idx = bsMines.findIndex(m => m.x === x && m.y === y);
        if (idx >= 0) bsMines.splice(idx, 1);
        else if (bsMines.length < 3) bsMines.push({ x, y });
        bsClearPreview();
        bsRenderPlacement();
      };
    }
    cell.oncontextmenu = (e) => {
      e.preventDefault();
      if (!shipsDone) { bsHoriz = !bsHoriz; bsClearPreview(); }
    };
  });

  // строка мин
  const mineBar = document.getElementById("bsMineBar");
  if (mineBar) {
    mineBar.innerHTML = !shipsDone ? '' :
      `💣 Мины: <b>${bsMines.length}/3</b> — кликай по пустым клеткам (необязательно, не поставишь — расставим сами)`;
  }

  // палитра оставшихся кораблей
  const pal = document.getElementById("bsFleetPalette");
  if (pal) {
    const left = BS_PALETTE.slice(bsCursor);
    pal.innerHTML = shipsDone
      ? '<span style="color:#2ecc71;">Флот готов! Поставь мины и жми «⚔️ Готов!»</span>'
      : 'Ставишь: <b style="color:#4da6ff;">' + BS_PALETTE[bsCursor] + '-палубный</b> (' + (BS_PALETTE.length - bsCursor) + ' осталось) · ' +
        left.map(l => l + 'п').join(', ');
  }
  const ready = document.getElementById("bsReadyBtn");
  if (ready) {
    ready.disabled = !shipsDone;
    ready.style.opacity = shipsDone ? '1' : '0.5';
  }
}

// Универсальный построитель доски 10×10 (обработчики через свойства — не копятся)
function bsDrawBoard(board, fillCell) {
  if (!board.dataset.built) {
    board.innerHTML = '';
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const cell = document.createElement('div');
        cell.className = 'bs-cell water';
        cell.dataset.x = x;
        cell.dataset.y = y;
        board.appendChild(cell);
      }
    }
    board.dataset.built = '1';
  }
  [...board.children].forEach(cell => {
    cell.className = 'bs-cell water';
    cell.style.cursor = 'default';
    cell.onclick = null;
    cell.onmouseenter = null;
    cell.oncontextmenu = null;
  });
  if (fillCell) {
    [...board.children].forEach(cell => fillCell(Number(cell.dataset.x), Number(cell.dataset.y), cell));
  }
}

function bsRenderBattle() {
  const v = bsView;
  if (!v) return;
  document.getElementById("bsPlacement").style.display = 'none';

  const now = Date.now() + bsClockOffset;
  const rapid = v.mode === 'rapid';
  const rapidReady = !rapid || now >= (v.myNextShotAt || 0);
  const canShoot = (v.myTurn || rapid) && rapidReady;

  // Мой флот
  const myBoard = document.getElementById("bsMyBoard");
  const myHit = new Set((v.incoming || []).filter(s => s.result === 'hit').map(s => s.x + ',' + s.y));
  const myMiss = new Set((v.incoming || []).filter(s => s.result === 'miss').map(s => s.x + ',' + s.y));
  const myMineHits = new Set((v.incoming || []).filter(s => s.result === 'mine').map(s => s.x + ',' + s.y));
  const myMineSet = new Set((v.myMines || []).map(m => m.x + ',' + m.y));
  bsDrawBoard(myBoard, (x, y, cell) => {
    const k = x + ',' + y;
    if (v.myShips.some(ship => ship.some(c => c.x === x && c.y === y))) {
      cell.classList.add('ship');
      if (myHit.has(k)) cell.classList.add('hit');
    } else if (myMineHits.has(k)) {
      cell.classList.add('mine-hit');
    } else if (myMiss.has(k)) {
      cell.classList.add('miss');
    } else if (myMineSet.has(k)) {
      cell.classList.add('mine-own');
    }
  });

  // Вражеские воды
  const enBoard = document.getElementById("bsEnemyBoard");
  const sunkSet = new Set();
  (v.sunkShips || []).forEach(ship => ship.forEach(c => sunkSet.add(c.x + ',' + c.y)));
  const shotMap = {};
  (v.myShots || []).forEach(s => { shotMap[s.x + ',' + s.y] = s.result; });
  const radarSet = new Set((bsRadarZone || []).map(c => c.x + ',' + c.y));
  bsDrawBoard(enBoard, (x, y, cell) => {
    const k = x + ',' + y;
    if (radarSet.has(k) && !shotMap[k]) cell.classList.add('radar-zone');
    if (sunkSet.has(k)) { cell.classList.add('sunk'); return; }
    if (shotMap[k] === 'hit') { cell.classList.add('hit'); return; }
    if (shotMap[k] === 'mine') { cell.classList.add('mine-hit'); return; }
    if (shotMap[k] === 'miss') { cell.classList.add('miss'); return; }
    if (canShoot) {
      cell.classList.add('target');
      cell.onclick = () => bsShoot(x, y);
    }
  });

  // Подсветка активной доски
  myBoard.classList.toggle('active', canShoot);
  enBoard.classList.toggle('active', canShoot);

  // Радар
  const rb = document.getElementById("bsRadarBtn");
  if (rb) {
    rb.style.display = v.canRadar ? '' : 'none';
    rb.textContent = `👀 Радар (${v.radarCost}$)`;
  }

  // Статус
  const bar = document.getElementById("bsStatusBar");
  if (bar) {
    const modeLabel = rapid ? '🌊 Быстрый огонь' : '🎖️ Классика';
    let turnHtml;
    if (rapid) {
      turnHtml = rapidReady
        ? '<span style="color:#2ecc71; font-weight:bold;">🟢 Стреляй!</span>'
        : `<span style="color:#ffc107;">🔃 Перезарядка: ${Math.ceil(((v.myNextShotAt || 0) - now) / 1000)} сек</span>`;
    } else {
      turnHtml = v.myTurn
        ? '<span style="color:#2ecc71; font-weight:bold;">🟢 Твой ход — бей!</span>'
        : '<span style="color:#ffc107;">🟡 Ход соперника...</span>';
    }
    const freeTag = v.iAmFree ? ' · <span style="color:#2ecc71;">🍀 твой бой за счёт казино</span>'
      : v.oppIsFree ? ' · <span style="color:#2ecc71;">🍀 бой соперника бесплатный</span>' : '';
    bar.innerHTML = `⚔️ <b>${escapeHtml(v.opponent)}</b> · ${modeLabel} · ставка <b style="color:#e0aaff;">${v.bet}$</b>${freeTag} · ` + turnHtml;
  }
}

function bsStartRapidTicker() {
  if (bsRapidTimer) return;
  bsRapidTimer = setInterval(() => {
    if (bsView && bsView.phase === 'battle' && bsView.mode === 'rapid') bsRenderBattle();
    else { clearInterval(bsRapidTimer); bsRapidTimer = null; }
  }, 500);
}

async function bsShoot(x, y) {
  if (!bsView) return;
  try {
    await fetch(`${SERVER_API_URL}/api/battleship/shot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bsView.id, username: currentUser, x, y })
    });
    // состояние прилетит сокетом bs_update
  } catch (e) {}
}

function bsApplyView(v) {
  if (!v) return;
  if (v.phase === 'expired') { bsBanner('⏱ ' + escapeHtml(v.opponent || '') + ' не ответил на вызов', 'info'); bsShowSetup(); return; }
  if (v.phase === 'declined') { bsBanner('🚫 ' + escapeHtml(v.opponent || '') + ' отказался от боя', 'info'); bsShowSetup(); return; }
  if (!v.id) return;

  if (v.id !== bsLastId) { // новая игра — сброс расстановки
    bsLastId = v.id;
    bsPlaced = [];
    bsCursor = 0;
    bsPlacedSent = false;
    bsWasMyTurn = false;
    bsMines = [];
    bsRadarZone = [];
    if (bsRapidTimer) { clearInterval(bsRapidTimer); bsRapidTimer = null; }
  }
  bsView = v;
  if (v.serverTime) bsClockOffset = v.serverTime - Date.now();
  document.getElementById("bsSetup").style.display = 'none';
  document.getElementById("bsGame").style.display = '';
  const sb = document.getElementById("bsSurrenderBtn");
  if (sb) sb.style.display = (v.phase === 'placement' || v.phase === 'battle') ? '' : 'none';

  if (v.phase === 'placement') {
    document.getElementById("bsPlacement").style.display = '';
    if (!bsPlacedSent) bsRenderPlacement();
  } else if (v.phase === 'battle') {
    bsLastOpponent = v.opponent;
    bsLastBet = v.bet;
    bsLastMode = v.mode || 'classic';
    bsRenderBattle();
    if (v.myTurn && !bsWasMyTurn) playNoticeSound();
    bsWasMyTurn = v.myTurn;
    bsBanner('', '');
    if (v.mode === 'rapid') bsStartRapidTicker();
  } else if (v.phase === 'done') {
    bsRenderBattle();
    const won = v.winner === currentUser;
    const freeWin = won && v.iAmFree;
    const freeLose = !won && v.iAmFree;
    const profit = freeLose ? 0 : won ? (freeWin ? v.bet * 2 : v.bet) : -v.bet;
    bsBanner(
      (won ? `🏆 ПОБЕДА! +${profit}$` : freeLose ? '🤝 Поражение, но ты ничего не потерял (бой за счёт казино)' : `💀 ПОРАЖЕНИЕ −${v.bet}$`) +
      ` <button class="template-btn" style="background:#dc3545; font-size:12px; padding:4px 14px; margin-left:8px;" onclick="bsRematch()">⚔️ Реванш</button>`,
      won ? 'win' : 'lose');
    playNoticeSound();
    fetch(`${SERVER_API_URL}/api/casino/state?username=${encodeURIComponent(currentUser)}`)
      .then(r => r.json()).then(d => { if (d.success) casinoSetBalance(d.balance); }).catch(() => {});
    bsView = null;
    setTimeout(() => { bsBanner('', ''); bsShowSetup(); }, 8000);
  }
}

// Реванш: тот же соперник, ставка и режим
window.bsRematch = async () => {
  if (!bsLastOpponent) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/battleship/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: currentUser, to: bsLastOpponent, bet: bsLastBet, mode: bsLastMode, random: bsLastRandom })
    });
    const data = await res.json();
    bsBanner(data.success
      ? `⚓ Реванш: вызвал ${escapeHtml(bsLastOpponent)} на ${bsLastBet}$ — жди ответа...`
      : '❌ ' + escapeHtml(data.message || 'Ошибка'), data.success ? 'info' : 'lose');
  } catch (e) { bsBanner('❌ Ошибка соединения', 'lose'); }
};

// Радар: подсветка зоны 3×3 с вражеским кораблём
window.bsUseRadar = async () => {
  if (!bsView) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/battleship/radar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bsView.id, username: currentUser })
    });
    const data = await res.json();
    if (!data.success) { bsBanner('❌ ' + escapeHtml(data.message || 'Радар недоступен'), 'lose'); return; }
    bsRadarZone = data.zone || [];
    if (typeof data.balance === 'number') casinoSetBalance(data.balance);
    bsRenderBattle();
  } catch (e) { bsBanner('❌ Ошибка соединения', 'lose'); }
};

// Кнопки расстановки
window.bsRotate = () => { bsHoriz = !bsHoriz; bsClearPreview(); };

window.bsRandomLocal = () => {
  const LENS = BS_PALETTE;
  for (let attempt = 0; attempt < 300; attempt++) {
    const occ = new Set(); const ships = []; let ok = true;
    for (const len of LENS) {
      let placed = false;
      for (let t = 0; t < 150; t++) {
        const h = Math.random() < 0.5;
        const x = Math.floor(Math.random() * (h ? 11 - len : 10));
        const y = Math.floor(Math.random() * (h ? 10 : 11 - len));
        const cells = [];
        for (let i = 0; i < len; i++) cells.push({ x: x + (h ? i : 0), y: y + (h ? 0 : i) });
        let free = true;
        for (const c of cells) for (let dx = -1; dx <= 1 && free; dx++) for (let dy = -1; dy <= 1; dy++)
          if (occ.has((c.x + dx) + ',' + (c.y + dy))) { free = false; break; }
        if (free) { cells.forEach(c => occ.add(c.x + ',' + c.y)); ships.push({ cells }); placed = true; break; }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) {
      bsPlaced = ships;
      bsCursor = LENS.length;
      // мины: 3 случайные свободные клетки
      const occ2 = new Set();
      ships.forEach(s => s.cells.forEach(c => occ2.add(c.x + ',' + c.y)));
      const freeCells = [];
      for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) {
        if (!occ2.has(x + ',' + y)) freeCells.push({ x, y });
      }
      bsMines = [];
      while (bsMines.length < 3 && freeCells.length) {
        bsMines.push(freeCells.splice(Math.floor(Math.random() * freeCells.length), 1)[0]);
      }
      bsRenderPlacement();
      return;
    }
  }
};

window.bsReady = async () => {
  if (!bsView || bsPlacedSent) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/battleship/place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bsView.id, username: currentUser, ships: bsPlaced.map(s => s.cells), mines: bsMines })
    });
    const data = await res.json();
    if (!data.success) { bsBanner('❌ ' + escapeHtml(data.message || 'Ошибка расстановки'), 'lose'); return; }
    bsPlacedSent = true;
    bsBanner('⚓ Флот готов! Ждём соперника...', 'info');
    document.getElementById("bsPlacement").style.display = 'none';
  } catch (e) { bsBanner('❌ Ошибка соединения', 'lose'); }
};

// Вызов / ответ
window.bsChallenge = async () => {
  const to = (document.getElementById("bsOpponent")?.value || '').trim().toLowerCase();
  const mode = document.getElementById("bsMode")?.value === 'rapid' ? 'rapid' : 'classic';
  const random = !!document.getElementById("bsRandomFleet")?.checked;
  const free = !!document.getElementById("bsFreeFight")?.checked;
  let bet = Math.floor(Number(document.getElementById("bsBet")?.value || 0));
  if (free) bet = 10;
  bsLastMode = mode; bsLastRandom = random;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/battleship/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: currentUser, to, bet, mode, random, free })
    });
    const data = await res.json();
    if (!data.success) { bsBanner('❌ ' + escapeHtml(data.message || 'Ошибка'), 'lose'); return; }
    bsBanner(`⚓ Вызов ${escapeHtml(to)} на ${bet}$ отправлен — жди ответа...`, 'info');
  } catch (e) { bsBanner('❌ Ошибка соединения', 'lose'); }
};

window.bsRespond = async (id, accept) => {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/battleship/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, username: currentUser, accept })
    });
    const data = await res.json();
    if (!data.success) { bsBanner('❌ ' + escapeHtml(data.message || 'Ошибка'), 'lose'); return; }
    bsPlaced = []; bsCursor = 0; bsPlacedSent = false; bsWasMyTurn = false; bsMines = []; bsRadarZone = [];
    bsBanner('', '');
  } catch (e) {}
};

function bindBattleshipHandlers() {
  if (!socket) return;
  socket.on('bs_challenge', (d) => {
    const tag = [d.mode === 'rapid' ? '🌊 быстрый огонь' : '', d.random ? '🎰 случайный флот' : '', d.free ? '🍀 бесплатный бой (ставка казино)' : ''].filter(Boolean).join(', ');
    bsBanner(`🚢 <b>${escapeHtml(d.from)}</b> вызывает тебя на морской бой — ставка <b>${d.bet}$</b>${tag ? ` (${tag})` : ''}!
      <button class="template-btn" style="background:#198754; font-size:12px; padding:4px 14px; margin-left:8px;" onclick="bsRespond('${d.id}', true)">Принять</button>
      <button class="template-btn" style="background:#333; font-size:12px; padding:4px 14px;" onclick="bsRespond('${d.id}', false)">Отказ</button>`, 'info');
    playNoticeSound();
  });
  socket.on('bs_update', (v) => bsApplyView(v));
}

function bsTabOpen() {
  // доступность бесплатного боя дня
  fetch(`${SERVER_API_URL}/api/casino/state?username=${encodeURIComponent(currentUser)}`)
    .then(r => r.json()).then(d => {
      const freeCb = document.getElementById("bsFreeFight");
      const hint = document.getElementById("bsFreeHint");
      if (freeCb) {
        freeCb.disabled = !d.bsFreeAvailable;
        freeCb.checked = freeCb.checked && d.bsFreeAvailable;
      }
      if (hint) hint.style.display = d.bsFreeAvailable ? '' : 'none';
    }).catch(() => {});
  if (bsView) {
    document.getElementById("bsSetup").style.display = 'none';
    document.getElementById("bsGame").style.display = '';
    if (bsView.phase === 'placement') { document.getElementById("bsPlacement").style.display = ''; bsRenderPlacement(); }
    else bsRenderBattle();
  } else {
    bsShowSetup();
  }
}

// --- Привязки ---
bindClick("bsChallengeBtn", bsChallenge);
bindClick("bsRotateBtn", bsRotate);
bindClick("bsRandomBtn", bsRandomLocal);
bindClick("bsReadyBtn", bsReady);
bindClick("bsRadarBtn", bsUseRadar);

// Сдаться
window.bsSurrender = async () => {
  if (!bsView) return;
  if (!confirm(`Сдаться? Соперник заберёт ${bsView.bet * 2}$.`)) return;
  try {
    await fetch(`${SERVER_API_URL}/api/battleship/surrender`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bsView.id, username: currentUser })
    });
    // финал прилетит сокетом bs_update
  } catch (e) {}
};
bindClick("bsSurrenderBtn", bsSurrender);

// ==================== 3.12.0: КЛИЕНТ — переводы, колесо, лотерея, сапёр, покер, змейка ====================

// --- ПЕРЕВОДЫ ---
window.transferSend = async () => {
  const to = (document.getElementById("transferTo")?.value || '').trim();
  const amount = Math.floor(Number(document.getElementById("transferAmount")?.value || 0));
  const st = document.getElementById("transferStatus");
  if (!to || amount < 5) { if (st) { st.textContent = '❌ Укажи ник и сумму от 5$'; st.style.color = '#ff6b6b'; } return; }
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: currentUser, to, amount })
    });
    const data = await res.json();
    if (!data.success) { if (st) { st.textContent = '❌ ' + (data.message || 'Ошибка'); st.style.color = '#ff6b6b'; } return; }
    casinoSetBalance(data.balance);
    if (st) { st.textContent = `✅ Отправлено ${to}: ${data.delivered}$ (комиссия ${data.fee}$)`; st.style.color = '#20c997'; }
  } catch (e) { if (st) { st.textContent = '❌ Ошибка соединения'; st.style.color = '#ff6b6b'; } }
};
bindClick("transferBtn", () => transferSend());

// --- КОЛЕСО ФОРТУНЫ ---
let wheelSectors = [];
let wheelAvailable = false;
let wheelSpinning = false;
const WHEEL_KIND_COLOR = (id) => id.startsWith('fine') ? '#c0392b' : id.startsWith('win') ? '#27ae60' : id === 'spin' ? '#8e44ad' : '#2980b9';

function wheelDraw(rotation) {
  const cv = document.getElementById("wheelCanvas");
  if (!cv || !wheelSectors.length) return;
  if(window.CasinoArt)return CasinoArt.wheel(cv,wheelSectors,rotation);
  const ctx = cv.getContext("2d");
  const R = cv.width / 2, cx = R, cy = R;
  const total = wheelSectors.reduce((s, x) => s + x.w, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  let a = 0;
  wheelSectors.forEach((s) => {
    const seg = (s.w / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R - 6, a, a + seg);
    ctx.closePath();
    ctx.fillStyle = WHEEL_KIND_COLOR(s.id);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();
    // подпись
    ctx.save();
    ctx.rotate(a + seg / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(s.label, R - 14, 4);
    ctx.restore();
    a += seg;
  });
  ctx.restore();
  // стрелка сверху
  ctx.beginPath();
  ctx.moveTo(cx - 10, 4);
  ctx.lineTo(cx + 10, 4);
  ctx.lineTo(cx, 24);
  ctx.closePath();
  ctx.fillStyle = '#ffd54a';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.stroke();
  // центр
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1d20';
  ctx.fill();
  ctx.strokeStyle = '#ffd54a';
  ctx.stroke();
}

window.wheelLoad = async () => {
  const btn = document.getElementById("wheelSpinBtn");
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/wheel/state?username=${encodeURIComponent(currentUser)}`);
    const data = await res.json();
    if (data.success) {
      wheelSectors = data.sectors;
      wheelAvailable = data.available;
      wheelDraw(0);
      if (btn) { btn.disabled = !wheelAvailable; btn.textContent = wheelAvailable ? '🎡 Крутануть!' : '🎡 Уже крутил — завтра'; }
    }
  } catch (e) {}
};

bindClick("wheelSpinBtn", async () => {
  if (wheelSpinning) return;
  const resEl = document.getElementById("wheelResult");
  const btn = document.getElementById("wheelSpinBtn");
  wheelSpinning = true;
  if (btn) btn.disabled = true;
  if (resEl) resEl.textContent = 'Крутим...';
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/wheel/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser })
    });
    const data = await res.json();
    if (!data.success) {
      if (resEl) { resEl.textContent = '❌ ' + (data.message || 'Ошибка'); resEl.style.color = '#ff6b6b'; }
      wheelSpinning = false;
      if (btn) btn.disabled = false;
      return;
    }
    const idx = wheelSectors.findIndex(s => s.id === data.sector);
    const total = wheelSectors.reduce((s, x) => s + x.w, 0);
    const seg = (wheelSectors[idx].w / total) * Math.PI * 2;
    // центр выигравшего сектора должен оказаться под стрелкой (верх = -π/2)
    let before = 0;
    for (let i = 0; i < idx; i++) before += (wheelSectors[i].w / total) * Math.PI * 2;
    const center = before + seg / 2;
    const target = Math.PI * 2 * 6 - center - Math.PI / 2;
    const start = performance.now(), DUR = 4200;
    const step = (now) => {
      const p = Math.min(1, (now - start) / DUR);
      const ease = 1 - Math.pow(1 - p, 3);
      wheelDraw(target * ease);
      if (p < 1) requestAnimationFrame(step);
      else {
        casinoSetBalance(data.balance);
        casinoLoadState();
        if (resEl) {
          resEl.textContent = `🎯 ${data.label} — ${data.detail}`;
          resEl.style.color = data.kind === 'fine' ? '#ff6b6b' : '#20c997';
        }
        if (btn) btn.textContent = '🎡 Завтра снова';
        wheelSpinning = false;
      }
    };
    requestAnimationFrame(step);
  } catch (e) {
    wheelSpinning = false;
    if (btn) btn.disabled = false;
  }
});

// --- ЛОТЕРЕЯ ---
let lotteryInt = null;
function lotteryFmtMs(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}ч ${String(m).padStart(2, '0')}м ${String(sec).padStart(2, '0')}с`;
}

window.lotteryLoad = async () => {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/lottery/state?username=${encodeURIComponent(currentUser)}`);
    const d = await res.json();
    if (!d.success) return;
    const pool = document.getElementById("lotteryPool");
    const tickets = document.getElementById("lotteryTickets");
    const my = document.getElementById("lotteryMy");
    const last = document.getElementById("lotteryLast");
    if (pool) pool.textContent = d.pool + '$';
    if (tickets) tickets.textContent = d.tickets;
    if (my) my.textContent = d.myTickets;
    if (last) last.textContent = d.lastWinner ? `Последний победитель: ${d.lastWinner.winner} — ${d.lastWinner.pool}$ (${d.lastWinner.date})` : '';
    const btn = document.getElementById("lotteryBuyBtn");
    if (btn) btn.disabled = !!d.played;
    if (lotteryInt) clearInterval(lotteryInt);
    lotteryInt = setInterval(() => {
      const t = document.getElementById("lotteryTimer");
      if (!t || d.played) { if (t) t.textContent = 'Сегодня розыгрыш состоялся — жди завтра'; clearInterval(lotteryInt); return; }
      d.msUntilDraw -= 1000;
      t.textContent = d.msUntilDraw > 0 ? `До розыгрыша: ${lotteryFmtMs(d.msUntilDraw)}` : '🎲 Розыгрыш...';
    }, 1000);
  } catch (e) {}
};

bindClick("lotteryBuyBtn", async () => {
  const st = document.getElementById("lotteryStatus");
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/lottery/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser })
    });
    const data = await res.json();
    if (!data.success) { if (st) { st.textContent = '❌ ' + (data.message || 'Ошибка'); st.style.color = '#ff6b6b'; } return; }
    casinoSetBalance(data.balance);
    if (st) { st.textContent = `✅ Билет #${data.ticket} куплен! Всего у тебя: ${data.myTickets}`; st.style.color = '#20c997'; }
    lotteryLoad();
  } catch (e) {}
});

// --- САПЁР ---
let minesGame = null; // {status, opened, mines, bet, mineCount, multiplier, payout}

window.minesRender = (game) => {
  const field = document.getElementById("minesField");
  const info = document.getElementById("minesInfo");
  const startBtn = document.getElementById("minesStartBtn");
  const cashBtn = document.getElementById("minesCashoutBtn");
  if (!field) return;
  if (game) minesGame = game;
  if (!minesGame) minesGame = { status: 'idle', opened: [], mines: [] };
  const g = minesGame;
  field.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const b = document.createElement('button');
    b.style.cssText = 'height:44px; font-size:18px; border-radius:6px; border:1px solid #2a323c; background:#1a1d20; color:#fff; cursor:pointer;';
    if (g.status === 'done' && g.mines.includes(i)) {
      b.textContent = '💣';
      b.style.background = '#5c1a1a';
    } else if (g.opened.includes(i)) {
      b.textContent = '💎';
      b.style.background = '#1a3d2e';
    } else {
      b.textContent = g.status === 'idle' ? '' : '❔';
      if (g.status === 'play') b.onclick = () => minesOpen(i);
    }
    field.appendChild(b);
  }
  if (info) {
    if (g.status === 'play') info.textContent = `Открыто ${g.opened.length} · множитель ×${g.multiplier} · заберёшь ${Math.round((g.bet * g.multiplier) * 100) / 100}$`;
    else if (g.status === 'done') info.textContent = g.payout > 0 ? `💰 Забрано ${g.payout}$` : '💥 БУМ! Ставка сгорела';
    else info.textContent = 'Выбери ставку и число мин, жми «Начать»';
  }
  if (startBtn) startBtn.textContent = g.status === 'play' ? '🔄 Заново (ставка сгорит)' : '▶️ Начать';
  if (cashBtn) cashBtn.style.display = g.status === 'play' && g.opened.length > 0 ? '' : 'none';
};

window.minesStart = async () => {
  try {
    const bet = Number(document.getElementById("minesBet")?.value || 5);
    const mines = Number(document.getElementById("minesCount")?.value || 5);
    const res = await fetch(`${SERVER_API_URL}/api/casino/mines/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, bet, mines })
    });
    const data = await res.json();
    if (!data.success) {
      const info = document.getElementById("minesInfo");
      if (info) { info.textContent = '❌ ' + (data.message || 'Ошибка'); info.style.color = '#ff6b6b'; }
      return;
    }
    casinoSetBalance(data.balance);
    casinoLoadState();
    minesRender(data.game);
  } catch (e) {}
};

window.minesOpen = async (cell) => {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/mines/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, cell })
    });
    const data = await res.json();
    if (!data.success) return;
    if (data.boom && data.balance != null) { casinoSetBalance(data.balance); casinoLoadState(); }
    minesRender(data.game);
  } catch (e) {}
};

window.minesCashout = async () => {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/mines/cashout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser })
    });
    const data = await res.json();
    if (!data.success) return;
    if (data.balance != null) { casinoSetBalance(data.balance); casinoLoadState(); }
    minesRender(data.game);
  } catch (e) {}
};

bindClick("minesStartBtn", () => minesStart());
bindClick("minesCashoutBtn", () => minesCashout());

// --- ВИДЕО-ПОКЕР ---
let pokerHeld = [];
let pokerCurrentHand = null;

function pokerCardHtml(card, idx, interactive) {
  const red = card.s === '♥' || card.s === '♦';
  const held = pokerHeld.includes(idx);
  const border = held ? 'border:2px solid #ffd54a; box-shadow:0 0 10px rgba(255,213,74,0.6);' : 'border:1px solid #444;';
  const onclick = interactive ? `onclick="pokerToggle(${idx})"` : '';
  return `<div ${onclick} style="display:inline-block; min-width:44px; padding:8px 4px; border-radius:8px; background:#fff; color:${red ? '#c0392b' : '#111'}; font-weight:bold; font-size:20px; text-align:center; cursor:${interactive ? 'pointer' : 'default'}; ${border}">
    ${card.r}<br>${card.s}${held ? '<div style="font-size:9px; color:#b8860b;">ДЕРЖУ</div>' : ''}
  </div>`;
}

window.pokerRenderHand = (hand, interactive) => {
  const box = document.getElementById("pokerHand");
  if (!box) return;
  if (hand) pokerCurrentHand = hand;
  if (!pokerCurrentHand) { box.innerHTML = '<p style="color:#777; font-size:12px;">Жми «Раздать» — ставка спишется</p>'; return; }
  box.innerHTML = pokerCurrentHand.map((c, i) => pokerCardHtml(c, i, interactive)).join('');
};

window.pokerToggle = (idx) => {
  if (!pokerCurrentHand || !document.getElementById("pokerDrawBtn") || document.getElementById("pokerDrawBtn").style.display === 'none') return;
  const i = pokerHeld.indexOf(idx);
  if (i >= 0) pokerHeld.splice(i, 1);
  else pokerHeld.push(idx);
  pokerRenderHand(null, true);
};

bindClick("pokerDealBtn", async () => {
  const bet = Number(document.getElementById("pokerBet")?.value || 5);
  const resEl = document.getElementById("pokerResult");
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/poker/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, bet })
    });
    const data = await res.json();
    if (!data.success) { if (resEl) { resEl.textContent = '❌ ' + (data.message || 'Ошибка'); resEl.style.color = '#ff6b6b'; } return; }
    casinoSetBalance(data.balance);
    casinoLoadState();
    pokerHeld = [];
    pokerRenderHand(data.hand, true);
    const drawBtn = document.getElementById("pokerDrawBtn");
    if (drawBtn) drawBtn.style.display = '';
    if (resEl) { resEl.textContent = 'Отметь карты, которые ОСТАВИШЬ (ДЕРЖУ), и жми «Поменять остальные»'; resEl.style.color = '#aaa'; }
  } catch (e) {}
});

bindClick("pokerDrawBtn", async () => {
  const resEl = document.getElementById("pokerResult");
  try {
    const res = await fetch(`${SERVER_API_URL}/api/casino/poker/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, hold: pokerHeld })
    });
    const data = await res.json();
    if (!data.success) { if (resEl) { resEl.textContent = '❌ ' + (data.message || 'Ошибка'); resEl.style.color = '#ff6b6b'; } return; }
    casinoSetBalance(data.balance);
    casinoLoadState();
    pokerHeld = [];
    pokerRenderHand(data.hand, false);
    const drawBtn = document.getElementById("pokerDrawBtn");
    if (drawBtn) drawBtn.style.display = 'none';
    if (resEl) {
      resEl.textContent = data.mult > 0 ? `🎉 ${data.combo}! Выплата +${data.payout}$ (×${data.mult})` : `💀 ${data.combo} — ставка сгорела`;
      resEl.style.color = data.mult > 0 ? '#20c997' : '#ff6b6b';
    }
  } catch (e) {}
});

// --- ЗМЕЙКА «ДАТЬ В РОТ ОБИИ» ---
const snake = { grid: 20, cell: 18, body: [], dir: { x: 1, y: 0 }, food: null, score: 0, running: false, timer: null, speed: 160 };
const obiiImg = new Image();
obiiImg.src = 'obii-head.png';

function snakeDraw() {
  const cv = document.getElementById("snakeCanvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = '#0d0f12';
  ctx.fillRect(0, 0, cv.width, cv.height);
  // какашки-еда
  if (snake.food) {
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💩', snake.food.x * snake.cell + snake.cell / 2, snake.food.y * snake.cell + snake.cell / 2);
  }
  // хвост — коричневые сегменты
  for (let i = snake.body.length - 1; i > 0; i--) {
    const s = snake.body[i];
    ctx.fillStyle = i % 2 ? '#6b4a2b' : '#8a6238';
    ctx.beginPath();
    ctx.arc(s.x * snake.cell + snake.cell / 2, s.y * snake.cell + snake.cell / 2, snake.cell / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // голова — фото обии
  if (snake.body.length) {
    const h = snake.body[0];
    const px = h.x * snake.cell, py = h.y * snake.cell;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px + snake.cell / 2, py + snake.cell / 2, snake.cell / 2, 0, Math.PI * 2);
    ctx.clip();
    if (obiiImg.complete && obiiImg.naturalWidth) {
      ctx.drawImage(obiiImg, px, py - 2, snake.cell, snake.cell + 4);
    } else {
      ctx.fillStyle = '#f0c8a0';
      ctx.fillRect(px, py, snake.cell, snake.cell);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(px + snake.cell / 2, py + snake.cell / 2, snake.cell / 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function snakePlaceFood() {
  while (true) {
    const f = { x: Math.floor(Math.random() * snake.grid), y: Math.floor(Math.random() * snake.grid) };
    if (!snake.body.some(s => s.x === f.x && s.y === f.y)) { snake.food = f; return; }
  }
}

function snakeTick() {
  const head = { x: snake.body[0].x + snake.dir.x, y: snake.body[0].y + snake.dir.y };
  // стены или сам себя — конец
  if (head.x < 0 || head.y < 0 || head.x >= snake.grid || head.y >= snake.grid || snake.body.some(s => s.x === head.x && s.y === head.y)) {
    snakeStop();
    return;
  }
  snake.body.unshift(head);
  if (snake.food && head.x === snake.food.x && head.y === snake.food.y) {
    snake.score++;
    snake.food = null;
    snakePlaceFood();
    // ускоряемся
    if (snake.speed > 70 && snake.score % 3 === 0) {
      snake.speed -= 8;
      clearInterval(snake.timer);
      snake.timer = setInterval(snakeTick, snake.speed);
    }
    const sc = document.getElementById("snakeScore");
    if (sc) sc.textContent = `Счёт: ${snake.score}`;
  } else {
    snake.body.pop();
  }
  snakeDraw();
}

function snakeStop() {
  snake.running = false;
  clearInterval(snake.timer);
  snake.timer = null;
  const best = Math.max(snake.score, Number(localStorage.getItem('sh_snake_best') || 0));
  localStorage.setItem('sh_snake_best', String(best));
  snakeShowBest();
  const sc = document.getElementById("snakeScore");
  if (sc) { sc.textContent = `💀 Конец! Съедено: ${snake.score}. Рекорд: ${best}`; sc.style.color = '#ff6b6b'; }
  const btn = document.getElementById("snakeStartBtn");
  if (btn) btn.textContent = '▶️ Ещё раз';
}

window.snakeShowBest = () => {
  const b = document.getElementById("snakeBest");
  if (b) b.textContent = localStorage.getItem('sh_snake_best') || '0';
};

window.snakeStart = () => {
  if (snake.running) return;
  snake.body = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  snake.dir = { x: 1, y: 0 };
  snake.score = 0;
  snake.speed = 160;
  snake.running = true;
  snakePlaceFood();
  const sc = document.getElementById("snakeScore");
  if (sc) { sc.textContent = 'Счёт: 0'; sc.style.color = '#20c997'; }
  const btn = document.getElementById("snakeStartBtn");
  if (btn) btn.textContent = '⏳ Игра...';
  snakeDraw();
  snake.timer = setInterval(snakeTick, snake.speed);
};

bindClick("snakeStartBtn", () => snakeStart());

document.addEventListener('keydown', (e) => {
  if (!snake.running) return;
  const k = e.key.toLowerCase();
  const dirs = { arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 }, arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 } };
  const nd = dirs[k];
  if (!nd) return;
  e.preventDefault();
  // нельзя развернуться в себя
  if (snake.body.length > 1 && nd.x === -snake.dir.x && nd.y === -snake.dir.y) return;
  snake.dir = nd;
});

// ==================== 3.12.0: АВТОЛОГИН («Оставаться в системе») ====================
(function () {
  const doAutoLogin = async () => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('sh_auth') || 'null'); } catch (e) {}
    if (!saved || !saved.u || !saved.p) return;
    const authScreen = document.getElementById("authScreen");
    const err = document.getElementById("authErrorMsg");
    if (err) err.innerText = 'Автовход...';
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`${SERVER_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: saved.u, password: saved.p }),
        signal: controller.signal
      });
      clearTimeout(t);
      const data = await response.json();
      if (!data || !data.success) {
        localStorage.removeItem('sh_auth');
        if (err) err.innerText = '';
        return;
      }
      currentUser = data.username;
      currentRole = data.role || 'user';
      HubCalls.start({username:data.username,token:data.callsToken,server:SERVER_API_URL,notify:payload=>ipcRenderer.send('call-notification',payload)});
      HubVoxels.configure({username:data.username,token:data.callsToken,server:SERVER_API_URL,io});
      localStorage.setItem('global_worker_nick', data.username);
      localStorage.setItem('support_hub_user', data.username);
      if (authScreen) authScreen.style.display = 'none';
      applyNickToApp(data.username);
      loadHQRoster();
      if (currentRole === 'admin') setupAdminPanel();
      checkTLStatus();
      initSocketConnection(data.username);
    } catch (e) {
      if (err) err.innerText = '';
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', doAutoLogin);
  else doAutoLogin();
})();

// 3.12.0: кнопка выхода из аккаунта
bindClick("logoutBtn", async () => {
  await HubVoxels.leave();
  localStorage.clear();
  location.reload();
});


// ==================== 3.13.0: БЕГА · КЕЙС · РУССКАЯ РУЛЕТКА ====================

function rrApi(path, body) {
  return fetch(`${SERVER_API_URL}/api/casino/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json());
}

function raceApiGet(path) {
  return fetch(`${SERVER_API_URL}/api/casino/${path}`).then(r => r.json());
}

// ---------- ПЕТУШИНЫЕ БЕГА ----------
const raceImg = new Image();
raceImg.src = 'obii-head.png';
let raceCache = null;
let raceTimer = null;
let raceAnimId = null;
let raceSelected = -1;
let raceSmooth = [0, 0, 0, 0, 0];

window.raceEnter = () => {
  raceSelected = -1;
  raceLoad();
  if (raceTimer) clearInterval(raceTimer);
  raceTimer = setInterval(raceLoad, 1000);
  if (raceAnimId) cancelAnimationFrame(raceAnimId);
  raceAnimLoop();
  const btn = document.getElementById("raceBetBtn");
  if (btn) btn.onclick = racePlaceBet;
};

function raceLeaveCheck() {
  const room = document.getElementById("room-race");
  if (room && room.style.display === 'none') {
    if (raceTimer) { clearInterval(raceTimer); raceTimer = null; }
    if (raceAnimId) { cancelAnimationFrame(raceAnimId); raceAnimId = null; }
    return true;
  }
  return false;
}

async function raceLoad() {
  if (raceLeaveCheck()) return;
  try {
    const data = await raceApiGet(`race/state?username=${encodeURIComponent(currentUser)}`);
    if (data.success) raceApply(data.race);
  } catch (e) {}
}

function raceApply(r) {
  raceCache = r;
  const st = document.getElementById("raceStatus");
  if (st) {
    if (r.phase === 'bet') st.innerText = `🏇 Забег #${r.round} — приём ставок: ${r.timeLeft} сек`;
    else if (r.phase === 'run') st.innerText = `🔥 ЗАБЕГ #${r.round}! До финиша: ${r.timeLeft} сек`;
    else st.innerText = r.winner >= 0 ? `🏆 Победил: ${r.roosters[r.winner].name} (×${r.roosters[r.winner].odds}). Новый забег через ${r.timeLeft} сек` : `Новый забег через ${r.timeLeft} сек`;
  }
  const box = document.getElementById("raceRoosters");
  if (box) {
    const canBet = r.phase === 'bet' && !r.myBet;
    box.innerHTML = r.roosters.map((ro, i) => {
      const sel = raceSelected === i ? 'outline:2px solid #ffc107;' : '';
      const dis = canBet ? '' : 'opacity:.55;';
      return `<button class="template-btn" style="background:#2a323c; font-size:11px; padding:6px 8px; ${sel}${dis}" onclick="racePick(${i})" ${canBet ? '' : 'disabled'}>
        🐔 ${escapeHtml(ro.name)}<br><b style="color:#ffc107;">×${ro.odds}</b></button>`;
    }).join('');
  }
  const betBtn = document.getElementById("raceBetBtn");
  if (betBtn) betBtn.disabled = !(r.phase === 'bet' && !r.myBet && raceSelected >= 0);
}

window.racePick = (i) => { raceSelected = i; if (raceCache) raceApply(raceCache); };

async function racePlaceBet() {
  const amount = Number(document.getElementById("raceBetAmount")?.value) || 10;
  const msg = document.getElementById("raceMsg");
  const data = await rrApi('race/bet', { username: currentUser, rooster: raceSelected, amount });
  if (msg) msg.innerText = data.success ? `✅ Ставка ${amount}$ на «${data.myBet.rooster >= 0 ? (raceCache ? raceCache.roosters[data.myBet.rooster].name : '') : ''}» принята!` : (`❌ ${data.message || 'Ошибка'}`);
  if (data.success) { casinoSetBalance(data.balance); raceLoad(); }
}

function raceAnimLoop() {
  if (raceLeaveCheck()) return;
  raceAnimId = requestAnimationFrame(raceAnimLoop);
  const cv = document.getElementById("raceCanvas");
  if (!cv || !raceCache) return;
  if(window.CasinoArt)return CasinoArt.race(cv,raceCache,raceSmooth);
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  // небо и земля
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#101820'); sky.addColorStop(1, '#1c2a1a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#24401f'; ctx.fillRect(0, 40, W, H - 40);
  const lanes = raceCache.roosters.length;
  const laneH = (H - 50) / lanes;
  const trackX = 10, trackW = W - 90;
  // финишная лента
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#fff' : '#111';
    ctx.fillRect(trackX + trackW + 6 + (i % 2) * 6, 40, 6, H - 50);
  }
  for (let i = 0; i < lanes; i++) {
    const y = 40 + i * laneH;
    // дорожка
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(trackX, y, trackW + 20, laneH);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(trackX, y + laneH); ctx.lineTo(trackX + trackW + 20, y + laneH); ctx.stroke();
    // сглаживание позиции
    raceSmooth[i] += ((raceCache.positions[i] || 0) - raceSmooth[i]) * 0.12;
    const px = trackX + (raceSmooth[i] / 100) * trackW;
    const py = y + laneH / 2;
    const bob = raceCache.phase === 'run' ? Math.sin(Date.now() / 90 + i) * 3 : 0;
    // петух (голова обии)
    const sz = Math.min(46, laneH - 8);
    if (raceImg.complete && raceImg.naturalWidth) {
      ctx.save();
      if (raceCache.phase === 'run') {
        ctx.translate(px + sz / 2, py + bob);
        ctx.rotate(Math.sin(Date.now() / 110 + i) * 0.12);
        ctx.drawImage(raceImg, -sz / 2, -sz / 2, sz, sz);
      } else {
        ctx.drawImage(raceImg, px - sz / 2, py - sz / 2, sz, sz);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = '#c0392b';
      ctx.beginPath(); ctx.arc(px, py + bob, sz / 2.5, 0, 7); ctx.fill();
    }
    // имя + позиция
    ctx.fillStyle = raceCache.winner === i ? '#ffc107' : '#cfd8dc';
    ctx.font = 'bold 11px Segoe UI';
    ctx.fillText(`${raceCache.roosters[i].name} ×${raceCache.roosters[i].odds}`, 12, y + 13);
    if (raceCache.winner === i) { ctx.font = '16px Segoe UI'; ctx.fillText('👑', px + 24, py + 5); }
  }
}

// ---------- КЕЙС ДНЯ ----------
let caseBusy = false;
let caseParticles = [];

window.caseEnter = async () => {
  caseDraw('closed');
  const btn = document.getElementById("caseOpenBtn");
  const msg = document.getElementById("caseMsg");
  try {
    const data = await raceApiGet(`case/state?username=${encodeURIComponent(currentUser)}`);
    if (btn) {
      btn.disabled = !data.available || caseBusy;
      btn.textContent = data.available ? '🔓 Открыть кейс' : '🔒 Уже открыт — завтра новый';
    }
    if (msg && data.available) msg.innerText = `VIP-уровень: ${data.level}. Возможные награды: 0$ · 5$ · 15$ · 30$ · 60$ · 100$`;
  } catch (e) {}
  if (btn) btn.onclick = caseOpen;
};

function caseDraw(state, reward) {
  const cv = document.getElementById("caseCanvas");
  if (!cv) return;
  if(window.CasinoArt)return CasinoArt.chest(cv,state,reward);
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.fillStyle = '#0d0f12'; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2 + 10;
  const t = Date.now();
  if (state === 'closed') {
    const glow = 0.5 + Math.sin(t / 400) * 0.2;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 120);
    g.addColorStop(0, `rgba(255,193,7,${0.25 * glow})`); g.addColorStop(1, 'rgba(255,193,7,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // корпус кейса
    ctx.fillStyle = '#5d4037';
    ctx.beginPath(); ctx.roundRect(cx - 70, cy - 35, 140, 75, 10); ctx.fill();
    ctx.fillStyle = '#795548';
    ctx.beginPath(); ctx.roundRect(cx - 70, cy - 35, 140, 35, 10); ctx.fill();
    ctx.strokeStyle = '#ffc107'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(cx - 70, cy - 35, 140, 75, 10); ctx.stroke();
    ctx.fillStyle = '#ffc107';
    ctx.fillRect(cx - 8, cy - 6, 16, 18);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText('🎁', cx, cy + 45);
    ctx.fillText('КЕЙС ДНЯ', cx, cy - 50);
    ctx.textAlign = 'left';
  } else if (state === 'open') {
    // открытая крышка + свет
    ctx.fillStyle = '#5d4037';
    ctx.beginPath(); ctx.roundRect(cx - 70, cy - 10, 140, 50, 10); ctx.fill();
    ctx.save();
    ctx.translate(cx - 70, cy - 10); ctx.rotate(-1.2);
    ctx.fillStyle = '#795548';
    ctx.beginPath(); ctx.roundRect(0, -35, 140, 35, 10); ctx.fill();
    ctx.restore();
    const lg = ctx.createLinearGradient(cx, cy - 60, cx, cy);
    lg.addColorStop(0, 'rgba(255,235,150,0.9)'); lg.addColorStop(1, 'rgba(255,235,150,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.moveTo(cx - 45, cy); ctx.lineTo(cx - 15, cy - 90); ctx.lineTo(cx + 15, cy - 90); ctx.lineTo(cx + 45, cy); ctx.fill();
  } else if (state === 'reward') {
    caseDraw('open');
    // частицы
    caseParticles = caseParticles.filter(p => p.life > 0);
    for (const p of caseParticles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.015;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = reward > 0 ? '#ffc107' : '#90a4ae';
    ctx.font = 'bold 34px Segoe UI';
    ctx.shadowColor = reward > 0 ? '#ffc107' : 'transparent'; ctx.shadowBlur = 18;
    ctx.fillText(reward > 0 ? `+${reward}$` : 'Пусто...', cx, cy + 15);
    ctx.shadowBlur = 0; ctx.textAlign = 'left';
  }
}

async function caseOpen() {
  if (caseBusy) return;
  caseBusy = true;
  const btn = document.getElementById("caseOpenBtn");
  const msg = document.getElementById("caseMsg");
  if (btn) btn.disabled = true;
  // анимация встряхивания и открытия
  for (let i = 0; i < 12; i++) {
    const cv = document.getElementById("caseCanvas");
    if (cv) {
      const ctx = cv.getContext("2d");
      ctx.save();
      ctx.translate(cv.width / 2, cv.height / 2);
      ctx.rotate(Math.sin(i) * 0.06);
      ctx.translate(-cv.width / 2, -cv.height / 2);
      caseDraw('closed');
      ctx.restore();
    }
    await new Promise(r => setTimeout(r, 80));
  }
  const data = await rrApi('case/open', { username: currentUser });
  if (!data.success) {
    caseBusy = false;
    if (msg) msg.innerText = `❌ ${data.message || 'Ошибка'}`;
    if (btn) { btn.disabled = false; btn.textContent = '🔓 Открыть кейс'; }
    return;
  }
  caseDraw('open');
  const cx = 180, cy = 120;
  caseParticles = Array.from({ length: 40 }, () => ({
    x: cx, y: cy, vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 7 - 2,
    life: 1, c: ['#ffc107', '#fff176', '#ffffff', '#ff8f00'][Math.floor(Math.random() * 4)]
  }));
  let frames = 0;
  const anim = () => {
    caseDraw('reward', data.reward);
    if (++frames < 140) requestAnimationFrame(anim);
  };
  anim();
  if (msg) msg.innerText = data.reward > 0 ? `🎉 Из кейса выпало ${data.reward}$! Баланс: ${data.balance}$` : '😶 Кейс оказался пустым. Повезёт завтра!';
  casinoSetBalance(data.balance);
  if (btn) btn.textContent = '🔒 Уже открыт — завтра новый';
  playNoticeSound();
  caseBusy = false;
}

// ---------- РУССКАЯ РУЛЕТКА ----------
let rrCache = null;
let rrSpinning = false;

window.rrEnter = async () => {
  const sel = document.getElementById("rrOpponent");
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">Соперник...</option>' +
      (typeof onlineNicks !== 'undefined' ? onlineNicks : [])
        .filter(n => n.toLowerCase() !== currentUser.toLowerCase())
        .map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    if (cur) sel.value = cur;
  }
  const ch = document.getElementById("rrChallengeBtn");
  if (ch) ch.onclick = rrChallenge;
  const pl = document.getElementById("rrPullBtn");
  if (pl) pl.onclick = rrPull;
  rrDrawRevolver(0, 0, false);
  rrRefresh();
};

async function rrRefresh() {
  try {
    const data = await raceApiGet(`rr/state?username=${encodeURIComponent(currentUser)}`);
    rrCache = data;
    const st = document.getElementById("rrStatus");
    const pull = document.getElementById("rrPullBtn");
    const row = document.getElementById("rrChallengeBtn");
    if (data.game) {
      if (st) st.innerHTML = `🔫 Дуэль: <b>${escapeHtml(data.game.players[0])}</b> vs <b>${escapeHtml(data.game.players[1])}</b> · ставка ${data.game.bet}$ · выстрелов: ${data.game.chambersFired}/6`;
      if (pull) {
        pull.style.display = '';
        pull.disabled = !data.game.yourTurn || rrSpinning;
        pull.textContent = data.game.yourTurn ? '💥 Нажать на курок' : '⏳ Ход соперника...';
      }
      if (row) row.style.display = 'none';
      rrDrawRevolver(0, data.game.chambersFired, false);
    } else {
      if (pull) pull.style.display = 'none';
      if (row) row.style.display = '';
      if (data.challenge) {
        if (data.challenge.incoming) {
          if (st) st.innerHTML = `⚔️ <b>${escapeHtml(data.challenge.from)}</b> вызывает тебя на русскую рулетку — ставка ${data.challenge.bet}$!
            <button class="template-btn" style="background:#198754; font-size:11px; padding:3px 10px; margin-left:6px;" onclick="rrRespond('${data.challenge.id}', true)">Принять</button>
            <button class="template-btn" style="background:#333; font-size:11px; padding:3px 10px;" onclick="rrRespond('${data.challenge.id}', false)">Отказ</button>`;
          playNoticeSound();
        } else if (st) st.innerText = `⏳ Ждём ответа от ${data.challenge.to}...`;
      } else if (st) st.innerText = 'Выбери соперника и ставку — и по очереди давайте на курок.';
      rrDrawRevolver(0, 0, false);
    }
  } catch (e) {}
}

async function rrChallenge() {
  const to = document.getElementById("rrOpponent")?.value;
  const bet = Number(document.getElementById("rrBet")?.value) || 20;
  const msg = document.getElementById("rrMsg");
  if (!to) { if (msg) msg.innerText = '❌ Выбери соперника'; return; }
  const data = await rrApi('rr/challenge', { from: currentUser, to, bet });
  if (msg) msg.innerText = data.success ? `⚔️ Вызов ${to} отправлен — ставка ${bet}$` : `❌ ${data.message || 'Ошибка'}`;
  if (data.success) rrRefresh();
}

window.rrRespond = async (id, accept) => {
  const data = await rrApi('rr/answer', { username: currentUser, id, accept });
  const msg = document.getElementById("rrMsg");
  if (!data.success && msg) msg.innerText = `❌ ${data.message || 'Ошибка'}`;
  if (data.accepted) { rrSpinAnim(); playNoticeSound(); }
  rrRefresh();
};

async function rrPull() {
  if (rrSpinning) return;
  rrSpinning = true;
  rrSpinAnim(); // вращение барабана
  await new Promise(r => setTimeout(r, 1300));
  const data = await rrApi('rr/pull', { username: currentUser });
  rrSpinning = false;
  if (!data.success) {
    const msg = document.getElementById("rrMsg");
    if (msg) msg.innerText = `❌ ${data.message || 'Ошибка'}`;
    rrRefresh();
    return;
  }
  rrDrawRevolver(0, data.chambersFired, data.boom);
  if (data.boom) {
    // выстрел — проигрыш (сервер эмитит rr_result обоим)
    rrRefresh();
  } else {
    rrRefresh();
  }
}

// Анимация вращения барабана
function rrSpinAnim() {
  let rot = 0, speed = 0.45;
  const step = () => {
    if (speed < 0.005) { rrRefresh(); return; }
    rot += speed; speed *= 0.965;
    rrDrawRevolver(rot, rrCache && rrCache.game ? rrCache.game.chambersFired : 0, false);
    requestAnimationFrame(step);
  };
  step();
}

// Отрисовка револьвера: rot — поворот барабана, fired — сколько камор уже стреляли
function rrDrawRevolver(rot, fired, bang) {
  const cv = document.getElementById("rrCanvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, 260);
  bg.addColorStop(0, '#1a2530'); bg.addColorStop(1, '#0a0e12');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const cx = W / 2 - 10, cy = H / 2 - 30;

  // рукоять
  ctx.save();
  ctx.translate(cx, cy + 55); ctx.rotate(0.5);
  const grip = ctx.createLinearGradient(0, 0, 0, 75);
  grip.addColorStop(0, '#6d4c41'); grip.addColorStop(1, '#3e2723');
  ctx.fillStyle = grip;
  ctx.beginPath(); ctx.roundRect(-16, 0, 34, 78, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-14, i * 14); ctx.lineTo(16, i * 14); ctx.stroke(); }
  ctx.restore();

  // ствол
  const barrel = ctx.createLinearGradient(cx + 45, cy - 14, cx + 45, cy + 14);
  barrel.addColorStop(0, '#b0bec5'); barrel.addColorStop(0.5, '#78909c'); barrel.addColorStop(1, '#455a64');
  ctx.fillStyle = barrel;
  ctx.beginPath(); ctx.roundRect(cx + 40, cy - 13, 110, 26, 8); ctx.fill();
  ctx.strokeStyle = '#263238'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(cx + 40, cy - 13, 110, 26, 8); ctx.stroke();
  ctx.fillStyle = '#37474f';
  ctx.beginPath(); ctx.arc(cx + 150, cy, 11, 0, 7); ctx.fill();
  ctx.fillStyle = '#102027';
  ctx.beginPath(); ctx.arc(cx + 150, cy, 6, 0, 7); ctx.fill();

  // барабан
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  const drum = ctx.createRadialGradient(0, 0, 10, 0, 0, 62);
  drum.addColorStop(0, '#cfd8dc'); drum.addColorStop(0.7, '#90a4ae'); drum.addColorStop(1, '#546e7a');
  ctx.fillStyle = drum;
  ctx.beginPath(); ctx.arc(0, 0, 62, 0, 7); ctx.fill();
  ctx.strokeStyle = '#263238'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 62, 0, 7); ctx.stroke();
  // 6 камор: одна под стволом (угол 0)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const kx = Math.cos(a) * 36, ky = Math.sin(a) * 36;
    ctx.beginPath(); ctx.arc(kx, ky, 14, 0, 7);
    ctx.fillStyle = i < fired ? '#20262b' : '#37474f';
    ctx.fill();
    ctx.strokeStyle = '#263238'; ctx.lineWidth = 1.5; ctx.stroke();
    if (i >= fired) {
      // пуля латунная
      const bul = ctx.createRadialGradient(kx - 3, ky - 3, 1, kx, ky, 9);
      bul.addColorStop(0, '#ffe082'); bul.addColorStop(1, '#c62828');
      ctx.fillStyle = bul;
      ctx.beginPath(); ctx.arc(kx, ky, 8, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(120,144,156,0.4)';
      ctx.beginPath(); ctx.arc(kx, ky, 8, 0, 7); ctx.fill();
    }
  }
  ctx.restore();

  // курок
  ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx - 45, cy + 42, 20, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 45, cy + 22); ctx.lineTo(cx - 45, cy + 8); ctx.stroke();

  // метка каморы под курком
  if (fired > 0) {
    ctx.fillStyle = '#ffc107';
    ctx.font = 'bold 12px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText(`💥 выстрелов: ${fired}/6`, cx + 10, 24);
    ctx.textAlign = 'left';
  }

  // выстрел
  if (bang) {
    const t = Date.now();
    const flash = ctx.createRadialGradient(cx + 150, cy, 5, cx + 150, cy, 90);
    flash.addColorStop(0, 'rgba(255,235,120,0.95)'); flash.addColorStop(0.5, 'rgba(255,80,0,0.6)'); flash.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = flash;
    ctx.beginPath(); ctx.arc(cx + 150, cy, 90, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 44px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText('BANG!', W / 2, H - 26);
    ctx.textAlign = 'left';
    setTimeout(() => rrDrawRevolver(0, rrCache && rrCache.game ? rrCache.game.chambersFired : 6, false), 1200);
  }
}

// Сокет-хендлеры дуэли на выживание
function bindRaceRrHandlers() {
  socket.on('rr_challenge', (d) => {
    const room = document.getElementById("room-rr");
    if (room && room.style.display !== 'none') { rrRefresh(); return; }
    playNoticeSound();
    if (confirm(`🔫 ${d.from} вызывает тебя на русскую рулетку — ставка ${d.bet}$. Принять?`)) {
      rrRespond(d.id, true);
    } else {
      rrRespond(d.id, false);
    }
  });
  socket.on('rr_start', (d) => { playNoticeSound(); rrSpinAnim(); if (d.balance != null) casinoSetBalance(d.balance); rrRefresh(); });
  socket.on('rr_turn', (d) => { playNoticeSound(); rrRefresh(); });
  socket.on('rr_result', (d) => {
    rrDrawRevolver(0, 6, true);
    playNoticeSound();
    const msg = document.getElementById("rrMsg");
    if (msg) {
      msg.innerHTML = d.youWin
        ? `🏆 <b>${escapeHtml(d.winner)}</b> выжил! <b>${escapeHtml(d.loser)}</b> лёг. Твой выигрыш: <b style="color:#ffc107;">+${d.payout}$</b>`
        : `💀 БА-БАХ. <b>${escapeHtml(d.loser)}</b> лёг — это ты. Победитель: <b>${escapeHtml(d.winner)}</b>`;
    }
    if (d.youWin && d.balance != null) casinoSetBalance(d.balance);
    rrCache = null;
    setTimeout(rrRefresh, 2500);
  });
  socket.on('rr_declined', (d) => {
    const msg = document.getElementById("rrMsg");
    if (msg) msg.innerText = `😤 ${d.to} отказался от дуэли`;
    rrRefresh();
  });
  socket.on('rr_expired', () => rrRefresh());
  socket.on('race_result', () => { raceLoad(); });
  // 3.13.1: принудительный перезапуск от админа
  socket.on('force_restart', () => { ipcRenderer.send('force-restart'); });
  socket.on('show_scare', (payload) => { ipcRenderer.send('show-scare', payload); });
  // 3.14.0: демонстрация экрана по команде админа
  socket.on('force_present', (p) => { ipcRenderer.send('force-present', p); });
  // 3.14.0: живой просмотр экрана (сотрудник — источник, админ — зритель)
  socket.on('watch_request', () => { startScreenWatch(); });
  socket.on('disconnect',()=>{stopScreenWatch();hideWatchOverlay();});
  socket.on('watch_stop', () => { stopScreenWatch(); });
  socket.on('watch_started', (d) => { setWatchStatus(`смотрим ${d.target}...`); });
  socket.on('watch_error', (d) => { hideWatchOverlay(); alert(`❌ ${d.message || 'Не удалось начать просмотр'}`); });
  socket.on('watch_frame', (d) => {
    const img = document.getElementById("watchScreenImg");
    if (img && d.dataUrl) { img.src = d.dataUrl; lastWatchFrameAt = Date.now(); setWatchStatus(`в эфире · обновлено ${new Date().toLocaleTimeString('ru-RU')}`); }
  });
  socket.on('watch_stopped', (d) => {
  hideWatchOverlay();if(d.reason==='capture_failed')return;
  alert(d.reason === 'offline' ? `🔌 ${d.target} отключился — просмотр завершён` : `Просмотр ${d.target} завершён`);
  });
  socket.on('present_result', (d) => {
    if (d.ok) {
      alert(`🖥️ Демка у ${d.worker}: включена${d.verified ? ' (проверено — трансляция идёт)' : ' (кнопка нажата, проверь в звонке)'}`);
    } else {
      alert(`❌ Демка у ${d.worker || 'сотрудника'} НЕ включена: ${d.error}`);
    }
  });
  socket.on('casino_banned', (d) => {
    alert(d.until ? `🚫 Админ забанил тебя в казино до ${new Date(d.until).toLocaleString('ru-RU')}` : '🎰 Бан в казино снят, возвращайся!');
    casinoLoadState && casinoLoadState();
  });
  socket.on('race_start', () => { playNoticeSound(); raceLoad(); });
}


// ==================== 3.13.1: БАН В КАЗИНО (админка) ====================
window.casinoBanUser = async (username, isBanned) => {
  const sel = document.getElementById('cbDur-' + username);
  const alreadyBanned = !!isBanned;
  const minutes = Number(sel ? sel.value : 60);
  const label = minutes >= 5256000 ? 'навсегда' : `на ${minutes} мин.`;
  if (!confirm(`🎰 ${alreadyBanned ? 'Снять бан' : 'Забанить'} ${username} в казино ${alreadyBanned ? '' : label}?`)) return;
  try {
    const res = await fetch(`${SERVER_API_URL}/api/admin/casino-ban?admin=${encodeURIComponent(currentUser)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser, username, minutes: alreadyBanned ? 0 : minutes })
    });
    const data = await res.json();
    if (data.success) {
      alert(alreadyBanned ? `💚 ${username} разбанен в казино` : `🚫 ${username} забанен в казино ${label}`);
      loadAdminUsers();
    } else {
      alert('❌ ' + (data.message || 'Ошибка'));
    }
  } catch (e) { alert('Ошибка сети'); }
};

// Принудительный перезапуск у всех сотрудников (3.13.1)
function sendForceRestart() {
  if (!confirm("Перезапустить приложение у ВСЕХ сотрудников? У них окно закроется и откроется заново, обновления установятся.")) return;
  if (!socket || !socket.connected) { alert("Нет соединения с сервером!"); return; }
  socket.emit('admin_force_restart', { from: currentUser });
  const st = document.getElementById("adminForceRestartStatus");
  if (st) { st.innerText = "🔄 Команда на перезапуск отправлена"; setTimeout(() => st.innerText = "", 5000); }
}


// ==================== 3.13.2: СКРИМЕР НА ВЕСЬ ЭКРАН ====================
let scareImageDataUrl = null;

function bindScarePicker() {
  const fi = document.getElementById("adminScareFile");
  if (!fi) return;
  fi.addEventListener("change", () => {
    const f = fi.files[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { alert("Фото слишком большое (максимум 8 МБ)"); fi.value = ""; return; }
    const r = new FileReader();
    r.onload = () => {
      scareImageDataUrl = r.result;
      const prev = document.getElementById("adminScarePreview");
      if (prev) { prev.src = scareImageDataUrl; prev.style.display = "block"; }
    };
    r.readAsDataURL(f);
  });
}

function sendScare() {
  if (!scareImageDataUrl) { alert("Сначала загрузи фото для скримера!"); return; }
  if (!socket || !socket.connected) { alert("Нет соединения с сервером!"); return; }
  const target = document.getElementById("adminScareTarget")?.value || "all";
  if (!confirm(`😱 Запустить скример ${target === 'all' ? 'ВСЕМ' : 'для ' + target}?`)) return;
  socket.emit('admin_scare', { target, from: currentUser, dataUrl: scareImageDataUrl });
  const status = document.getElementById("adminScareStatus");
  if (status) { status.innerText = `😱 Скример запущен (${target === 'all' ? 'всем' : target})`; setTimeout(() => status.innerText = "", 4000); }
  scareImageDataUrl = null;
  const fi = document.getElementById("adminScareFile");
  if (fi) fi.value = "";
  const prev = document.getElementById("adminScarePreview");
  if (prev) prev.style.display = "none";
}


// ==================== 3.14.0: «ВРУБИТЬ ДЕМКУ» (админка) ====================
window.forcePresent = (username) => {
  if (!confirm(`🖥️ Врубить демонстрацию экрана у ${username}?\n\nУ него откроется/перезапустится Brave и в звонке сама включится трансляция экрана.`)) return;
  if (!socket || !socket.connected) { alert("Нет соединения с сервером!"); return; }
  socket.emit('admin_force_present', { from: currentUser, target: username });
  alert(`🖥️ Команда ${username} отправлена. Жди результата — придёт оповещение.`);
};

// Результат автоматизации от main-процесса → отправляем админу через сервер
ipcRenderer.on('present-result', (e, res) => {
  if (socket && socket.connected) {
    socket.emit('present_done', { by: res.by, ok: res.ok, verified: res.verified, error: res.error });
  }
});


// ==================== 3.14.0: ЖИВОЙ ПРОСМОТР ЭКРАНА ====================
// Сотрудник: захват экрана + отправка кадров (только по запросу админа, с индикатором)
let watchStream = null, watchVideo = null, watchCanvas = null, watchTimer = null, watchActive = false;

function setWatchIndicator(live) {
  const el = document.getElementById("screenWatchNotice");
  if (!el) return;
  if (live) {
    el.style.background = '#5c1a1a';
    el.style.color = '#ff8080';
    el.style.fontWeight = 'bold';
    el.textContent = '🔴 ИДЁТ ПРОСМОТР ТВОЕГО ЭКРАНА — админ смотрит вживую';
  } else {
    el.style.background = '#2a2a1b';
    el.style.color = '#e8c547';
    el.style.fontWeight = 'normal';
    el.textContent = '⚠️ Экран контролируется — админ может включить просмотр в любой момент';
  }
}

let watchSession=0,watchDeadline=null;
async function startScreenWatch(){
 if(watchActive)return;
 const session=++watchSession;watchActive=true;setWatchIndicator(true);
 const sendFrame=async()=>{
  if(!watchActive||session!==watchSession)return;
  try{
   const dataUrl=await ipcRenderer.invoke('watch-frame');
   if(!watchActive||session!==watchSession)return;
   if(!dataUrl)throw Error('Windows не вернула изображение экрана. Проверь, что рабочий стол не заблокирован.');
   if(!socket?.connected){stopScreenWatch();return;}
   socket.emit('watch_frame',{dataUrl});
   watchTimer=setTimeout(sendFrame,1500);
  }catch(error){if(session!==watchSession)return;socket?.emit('watch_failed',{message:error.message||'Не удалось захватить экран'});stopScreenWatch();}
 };
 watchDeadline=setTimeout(()=>{if(session===watchSession){socket?.emit('watch_stop',{});stopScreenWatch();}},5*60*1000);
 await sendFrame();
}
function stopScreenWatch(){
 watchActive=false;++watchSession;clearTimeout(watchTimer);clearTimeout(watchDeadline);watchTimer=watchDeadline=null;
 if(watchStream){watchStream.getTracks().forEach(t=>t.stop());watchStream=null;}
 watchVideo=watchCanvas=null;setWatchIndicator(false);
}

// Админ: оверлей просмотра
let currentWatchTarget = null;
let lastWatchFrameAt = 0;

function setWatchStatus(txt) {
  const el = document.getElementById("watchStatus");
  if (el) el.textContent = txt;
}

function hideWatchOverlay() {
  const ov = document.getElementById("watchOverlay");
  if (ov) ov.style.display = 'none';
  currentWatchTarget = null;
}

window.watchScreen = (username) => {
  if (!confirm(`👁 Смотреть экран ${username}?\n\nУ сотрудника в приложении загорится красный индикатор «ИДЁТ ПРОСМОТР».`)) return;
  if (!socket || !socket.connected) { alert("Нет соединения с сервером!"); return; }
  currentWatchTarget = username;
  const ov = document.getElementById("watchOverlay");
  const name = document.getElementById("watchTargetName");
  if (name) name.textContent = username;
  if (ov) ov.style.display = 'flex';
  setWatchStatus('просим сотрудника начать трансляцию...');
  lastWatchFrameAt = Date.now();
  const img = document.getElementById("watchScreenImg");
  if (img) img.src = '';
  socket.emit('watch_start', { from: currentUser, target: username });
  // следим за потоком кадров
  const watchdog = setInterval(() => {
    if (!currentWatchTarget) { clearInterval(watchdog); return; }
    if (Date.now() - lastWatchFrameAt > 8000) setWatchStatus('нет кадров более 8 сек — возможно, сотрудник свернул приложение или нет прав на захват');
  }, 2000);
};

window.stopWatching = () => {
  if (socket && socket.connected && currentWatchTarget) {
    socket.emit('watch_stop', { from: currentUser, target: currentWatchTarget });
  }
  hideWatchOverlay();
};
