// ==================== SUPPORT HUB v3 ====================
// ⚠️ АДРЕС НОВОГО СЕРВЕРА (Render) — меняется здесь
const SERVER_API_URL = "https://support-hub-server-v3.onrender.com";
// Google-таблица (дублирование параллельно)
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby1q1rhdewBwtjCGPQ9g7g_HaruhPYxovLQRbAuXQyV8GIyNY5suZpxXn_hJSrRoLbt/exec";

const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');
const { io } = require("socket.io-client");

const notesFilePath = path.join(process.cwd(), 'notes.txt');

let socket = null;
let currentUser = "";      // ник текущего пользователя
let currentRole = "user";  // 'admin' или 'user'
let onlineNicks = [];      // кто онлайн в чате (для точек в Штабе)

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
        localStorage.setItem('global_worker_nick', data.username);
        localStorage.setItem('support_hub_user', data.username);

        if (authScreen) authScreen.style.display = "none";
        authSubmitBtn.disabled = false;

        applyNickToApp(data.username);
        loadHQRoster();
        if (currentRole === 'admin') setupAdminPanel();
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
  bindClick("adminQuickRabotayBtn", () => sendAdminNotification("РАБОТАЙ СУКА", "all", true));
  bindClick("adminEventsLoadBtn", loadAdminEvents);
  bindClick("adminStatsLoadBtn", loadAdminStats);
  bindClick("adminTeamAddBtn", addAdminTeam);
  bindClick("adminExAddBtn", addAdminExchange);

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
    teams.forEach(t => {
      const col = document.createElement("div");
      col.className = "team-column";
      col.style.flex = "1";
      const usersHtml = t.users.length
        ? t.users.map(u => `<li data-nick="${escapeHtml(u)}">${escapeHtml(u)} <span class="status-dot"></span></li>`).join('')
        : '<li style="color:#666;">пусто</li>';
      col.innerHTML = `<h4 style="color:#4da6ff;">🏴 ${escapeHtml(t.name)}</h4><ul class="team-list">${usersHtml}</ul>`;
      box.appendChild(col);
    });
    updateHQStatusDots();
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
  });

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

function checkTruffles() {
  const nick = currentUser || localStorage.getItem('global_worker_nick') || "";
  const resultBox = document.getElementById("trufflesResultBox");
  if (!nick) { alert("Сначала войдите в систему!"); return; }

  if (resultBox) {
    resultBox.style.display = "block";
    resultBox.innerHTML = "⏳ Загрузка статистики...";
  }

  fetch(`${WEB_APP_URL}?action=getTruffles&nick=${encodeURIComponent(nick)}`)
    .then(res => res.json())
    .then(data => {
      if (!resultBox) return;
      if (data && data.success) {
        resultBox.innerHTML = `✅ <b>Статистика для ${nick}:</b><br>💎 Трюфелей найдено: <b>${data.count || 0}</b>`;
      } else {
        resultBox.innerHTML = `ℹ️ ${(data && data.message) || "Данные не найдены или ошибка сервера."}`;
      }
    })
    .catch(() => {
      if (resultBox) resultBox.innerHTML = "❌ Не удалось получить данные. Проверьте соединение.";
    });
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
function sendCallEntry() {
  const callType = document.getElementById("callTypeSelect")?.value || "";
  const serviceName = document.getElementById("callServiceName")?.value.trim() || "";
  const callLink = document.getElementById("callLinkInput")?.value.trim() || "";
  const callNote = document.getElementById("callNoteInput")?.value.trim() || "";

  if (!serviceName || !callLink) { alert("Заполните название и ссылку!"); return; }

  sendToGoogleSheet({ type: "Колы", nick: currentUser, callType, serviceName, callLink, callNote });
  sendEventToServer('call', { callType, serviceName, callLink, callNote });

  document.getElementById("callServiceName").value = "";
  document.getElementById("callLinkInput").value = "";
  document.getElementById("callNoteInput").value = "";

  const status = document.getElementById("callStatus");
  if (status) { status.innerText = "✅ Колл отправлен!"; setTimeout(() => status.innerText = "", 3000); }
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

    // Список для мута/бана
    if (container) {
      container.innerHTML = "";
      data.users.forEach(u => {
        const row = document.createElement("div");
        row.className = "admin-user-row";
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(u.username)}</strong> (${u.role})<br>
            <small style="color:#888;">Мут: ${u.isMuted ? 'Да' : 'Нет'} | Бан: ${u.isBanned ? 'Да' : 'Нет'}</small>
          </div>
          <div>
            <button onclick="toggleUserMute('${u.username}', ${!u.isMuted})">${u.isMuted ? 'Размутить' : 'Мут'}</button>
            <button class="ban-btn" onclick="toggleUserBan('${u.username}', ${!u.isBanned})">${u.isBanned ? 'Разбанить' : 'Бан'}</button>
          </div>
        `;
        container.appendChild(row);
      });
    }
  } catch (err) {
    if (container) container.innerHTML = "<p style='color:red;'>Ошибка соединения с сервером</p>";
  }
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

  socket.emit('admin_notify', { target, text, from: currentUser });

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
  notify:   { icon: '🚀', label: 'Уведомление',cls: 'ev-notify' }
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
        details = `<b>${escapeHtml(d.callType || '')}</b> ${escapeHtml(d.serviceName || '')} | ${escapeHtml(d.callLink || '')} ${escapeHtml(d.callNote || '')}`;
      } else if (ev.type === 'overtime') {
        const h = Math.floor((ev.durationMin || 0) / 60), m = (ev.durationMin || 0) % 60;
        details = `${escapeHtml(d.from || '')}–${escapeHtml(d.to || '')} = <b>${h} ч. ${m > 0 ? m + ' мин.' : ''}</b>`;
      } else if (ev.type === 'shift') {
        details = `начало ${escapeHtml(d.start || '')} → конец ${escapeHtml(d.end || '')} · длительность <b>${escapeHtml(d.duration || '')}</b> · логов: <b>${escapeHtml(String(d.logs ?? 0))}</b>`;
      } else if (ev.type === 'notify') {
        details = `кому: ${escapeHtml(d.target || 'all')} | «${escapeHtml(d.text || '')}»`;
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
  } catch (err) {
    alert("Ошибка соединения: " + err.message);
  }
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
  const colYes = document.getElementById("colYes");
  const colCondition = document.getElementById("colCondition");
  const colNo = document.getElementById("colNo");

  if (colYes) colYes.innerHTML = exchangesYes.map(i => `<li>• ${escapeHtml(i)}</li>`).join('');
  if (colCondition) colCondition.innerHTML = exchangesCondition.map(i => `<li>• ${escapeHtml(i.name)}</li>`).join('');
  if (colNo) colNo.innerHTML = exchangesNo.map(i => `<li>• ${escapeHtml(i)}</li>`).join('');
}

function handleExchangeSearch(e) {
  const query = e.target.value.trim().toLowerCase();
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const conditionBox = document.getElementById("conditionNoteBox");

  if (!query) {
    if (statusDot) statusDot.style.background = "#666";
    if (statusText) statusText.textContent = "Введите запрос";
    if (conditionBox) conditionBox.style.display = "none";
    return;
  }

  const inYes = exchangesYes.some(i => i.toLowerCase().includes(query));
  const foundCond = exchangesCondition.find(i => i.name.toLowerCase().includes(query));
  const inNo = exchangesNo.some(i => i.toLowerCase().includes(query));

  if (inYes) {
    if (statusDot) statusDot.style.background = "#28a745";
    if (statusText) statusText.textContent = "Точно да";
    if (conditionBox) conditionBox.style.display = "none";
  } else if (foundCond) {
    if (statusDot) statusDot.style.background = "#ffc107";
    if (statusText) statusText.textContent = "Есть условия";
    if (conditionBox) {
      conditionBox.style.display = "block";
      conditionBox.textContent = `⚠️ Условия для ${foundCond.name}:\n${foundCond.condition}`;
    }
  } else if (inNo) {
    if (statusDot) statusDot.style.background = "#dc3545";
    if (statusText) statusText.textContent = "Точно нет";
    if (conditionBox) conditionBox.style.display = "none";
  } else {
    if (statusDot) statusDot.style.background = "#666";
    if (statusText) statusText.textContent = "Не найдено";
    if (conditionBox) conditionBox.style.display = "none";
  }
}
