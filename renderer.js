const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby1q1rhdewBwtjCGPQ9g7g_HaruhPYxovLQRbAuXQyV8GIyNY5suZpxXn_hJSrRoLbt/exec";
const fs = require('fs');
const path = require('path');
const notesFilePath = path.join(process.cwd(), 'notes.txt');

document.addEventListener("DOMContentLoaded", () => {
  // 1. Надежное переключение вкладок
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".content");

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const tabName = button.getAttribute("data-tab");

      tabButtons.forEach(btn => btn.classList.remove("active"));
      tabContents.forEach(el => {
        el.classList.remove("active");
        el.style.display = "none";
      });

      button.classList.add("active");
      const targetTab = document.getElementById("tab-" + tabName);
      if (targetTab) {
        targetTab.classList.add("active");
        targetTab.style.display = "block";
      }
    });
  });

  // 2. Загрузка сохраненных данных
  const savedNick = localStorage.getItem('global_worker_nick') || localStorage.getItem('support_hub_user');

  if (savedNick) {
    const globalNickInput = document.getElementById("globalWorkerNick");
    if (globalNickInput) globalNickInput.value = savedNick;

    const shiftNick = document.getElementById("userNick");
    if (shiftNick && !shiftNick.disabled) shiftNick.value = savedNick;

    updateOnlineStatus(savedNick);
  }

  // Загрузка заметок из файла
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

  // 3. Привязка кнопок к функциям
  const globalNickEl = document.getElementById("globalWorkerNick");
  if (globalNickEl) globalNickEl.addEventListener("input", saveGlobalNick);

  document.getElementById("templateBtn").addEventListener("click", insertTruffleTemplate);
  document.getElementById("sendBugBtn").addEventListener("click", sendBugReport);
  document.getElementById("startBtn").addEventListener("click", toggleShift);
  document.getElementById("stopBtn").addEventListener("click", finishShift);
  document.getElementById("addOneBtn").addEventListener("click", () => addCount(1));
  document.getElementById("addFiveBtn").addEventListener("click", () => addCount(5));
  document.getElementById("subOneBtn").addEventListener("click", () => addCount(-1));
  document.getElementById("resetShiftBtn").addEventListener("click", resetShift);
  document.getElementById("copyBtn").addEventListener("click", copyReport);
  document.getElementById("sendOvertimeBtn").addEventListener("click", sendOvertime);
  document.getElementById("sendCallBtn").addEventListener("click", sendCallEntry);
  document.getElementById("sendLeaveBtn").addEventListener("click", sendLeave);
  document.getElementById("openExplorerBtn").addEventListener("click", openExplorer);
  document.getElementById("saveNotesBtn").addEventListener("click", saveNotes);

  // 4. Запуск проверки онлайн-статусов
  setTimeout(initRealtimeStatus, 1000);
  setInterval(initRealtimeStatus, 15000);
});

function updateOnlineStatus(currentNick) {
  const items = document.querySelectorAll('.team-list li');
  items.forEach(item => {
    const nickName = item.getAttribute('data-nick');
    if (nickName && currentNick && nickName.toLowerCase() === currentNick.toLowerCase()) {
      item.classList.add('online');
    }
  });
}

function initRealtimeStatus() {
  const currentNick = localStorage.getItem('support_hub_user') || localStorage.getItem('global_worker_nick');
  if (!currentNick) return;

  fetch(WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "heartbeat", nick: currentNick })
  }).catch(err => console.error("Ошибка отправки heartbeat:", err));

  fetch(WEB_APP_URL)
    .then(res => res.json())
    .then(onlineNicks => {
      updateOnlineUI(onlineNicks);
    })
    .catch(err => console.error("Ошибка получения онлайн-статусов:", err));
}

function updateOnlineUI(onlineNicks) {
  if (!Array.isArray(onlineNicks)) return;
  const items = document.querySelectorAll('.team-list li');
  items.forEach(item => {
    const nickName = item.getAttribute('data-nick');
    if (!nickName) return;

    const isOnline = onlineNicks.some(n => n.toLowerCase() === nickName.toLowerCase());
    if (isOnline) {
      item.classList.add('online');
    } else {
      item.classList.remove('online');
    }
  });
}

function saveGlobalNick() {
  const nick = document.getElementById("globalWorkerNick").value.trim();
  localStorage.setItem('global_worker_nick', nick);
  localStorage.setItem('support_hub_user', nick);
  
  const shiftNick = document.getElementById("userNick");
  if (shiftNick && !shiftNick.disabled) shiftNick.value = nick;
  
  updateOnlineStatus(nick);
  initRealtimeStatus();
}

function sendDataToSheet(payload) {
  fetch(WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(err => console.error("Ошибка отправки в таблицу:", err));
}

function saveNotes() {
  const notes = document.getElementById("userNotes").value;
  try {
    fs.writeFileSync(notesFilePath, notes, 'utf8');
    const status = document.getElementById("notesStatus");
    if (status) {
      status.innerText = "Сохранено в файл!";
      setTimeout(() => status.innerText = "", 2000);
    }
  } catch (err) {
    alert("Ошибка сохранения: " + err.message);
  }
}

function insertTruffleTemplate() {
  const desc = document.getElementById("bugDesc");
  if (!desc) return;
  desc.value = "Search- \nID- \nSumma- \nКомментарий по логу- ";
}

function sendBugReport() {
  const nick = document.getElementById("globalWorkerNick").value.trim() || localStorage.getItem('support_hub_user') || "Аноним";
  const type = document.getElementById("bugType").value;
  const desc = document.getElementById("bugDesc").value.trim();
  if (!desc) { alert("Заполните описание!"); return; }

  sendDataToSheet({
    type: "Логи ошибок",
    nick: nick,
    bugType: type,
    desc: desc
  });

  document.getElementById("bugDesc").value = "";
  const msg = document.getElementById("statusMsg");
  if (msg) {
    msg.innerText = "Отчет отправлен в таблицу!";
    setTimeout(() => msg.innerText = "", 3000);
  }
}

function calculateDuration(from, to) {
  const startParts = from.split(':');
  const endParts = to.split(':');
  const startDate = new Date(0, 0, 0, startParts[0], startParts[1]);
  const endDate = new Date(0, 0, 0, endParts[0], endParts[1]);
  
  let diff = endDate - startDate;
  if (diff < 0) diff += 24 * 60 * 60 * 1000;
  
  const hours = Math.floor(diff / 1000 / 60 / 60);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  return `${hours} ч. ${minutes > 0 ? minutes + ' мин.' : ''}`.trim();
}

function sendOvertime() {
  const nick = document.getElementById("globalWorkerNick").value.trim() || document.getElementById("userNick").value.trim() || localStorage.getItem('support_hub_user') || "Сотрудник";
  const fromTime = document.getElementById("overtimeFrom").value;
  const toTime = document.getElementById("overtimeTo").value;
  
  if (!fromTime || !toTime) { alert("Укажите время 'От' и 'До'!"); return; }
  
  const totalDuration = calculateDuration(fromTime, toTime);
  
  sendDataToSheet({
    type: "Овертаймы",
    nick: nick,
    fromTime: fromTime,
    toTime: toTime,
    totalDuration: totalDuration
  });
  
  document.getElementById("overtimeFrom").value = "";
  document.getElementById("overtimeTo").value = "";
  
  const status = document.getElementById("overtimeStatus");
  if (status) {
    status.innerText = "✅ Овертайм добавлен!";
    setTimeout(() => status.innerText = "", 3000);
  }
}

function sendCallEntry() {
  const nick = document.getElementById("globalWorkerNick").value.trim() || document.getElementById("userNick").value.trim() || localStorage.getItem('support_hub_user') || "Сотрудник";
  const callType = document.getElementById("callTypeSelect").value;
  const serviceName = document.getElementById("callServiceName").value.trim();
  const callLink = document.getElementById("callLinkInput").value.trim();
  const callNote = document.getElementById("callNoteInput").value.trim();
  
  if (!serviceName || !callLink) { alert("Заполните название и ссылку!"); return; }
  
  sendDataToSheet({
    type: "Колы",
    nick: nick,
    callType: callType,
    serviceName: serviceName,
    callLink: callLink,
    callNote: callNote
  });
  
  document.getElementById("callServiceName").value = "";
  document.getElementById("callLinkInput").value = "";
  document.getElementById("callNoteInput").value = "";
  
  const status = document.getElementById("callStatus");
  if (status) {
    status.innerText = "✅ Колл отправлен в таблицу!";
    setTimeout(() => status.innerText = "", 3000);
  }
}

function sendLeave() {
  const nick = document.getElementById("globalWorkerNick").value.trim() || localStorage.getItem('support_hub_user') || "Аноним";
  const reason = document.getElementById("leaveReason").value;
  const comment = document.getElementById("leaveComment").value.trim();
  const date = document.getElementById("leaveDate").value;
  const from = document.getElementById("leaveTimeFrom").value;
  const to = document.getElementById("leaveTimeTo").value;

  if (!date || !from || !to) { alert("Заполните дату и время!"); return; }

  const fullReason = comment ? `${reason} — ${comment}` : reason;

  sendDataToSheet({
    type: "Отпроситься",
    nick: nick,
    reason: fullReason,
    leaveDate: date,
    from: from,
    to: to
  });

  const status = document.getElementById("leaveStatus");
  if (status) {
    status.innerText = "Запрос отправлен в таблицу!";
    setTimeout(() => status.innerText = "", 3000);
  }
}

function openExplorer() {
  const net = document.getElementById("network").value;
  const raw = document.getElementById("cryptoQuery").value.trim();
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

let timerInterval = null, startTimeMs = null, startTimeStr = "", count = 0, isWorking = false;

function toggleShift() {
  const nickEl = document.getElementById("userNick");
  const nick = nickEl ? nickEl.value.trim() : (localStorage.getItem('support_hub_user') || "");
  if (!nick) { alert("Укажите никнейм!"); return; }

  if (!isWorking) {
    isWorking = true;
    startTimeMs = new Date().getTime();
    startTimeStr = new Date().toLocaleTimeString();
    count = 0;

    document.getElementById("startBtn").style.display = "none";
    document.getElementById("stopBtn").style.display = "block";
    if (nickEl) nickEl.disabled = true;
    document.getElementById("counterBox").style.opacity = "1";
    document.getElementById("counterBox").style.pointerEvents = "auto";
    
    startTimerLoop();
    saveShiftState();
  }
}

function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((new Date().getTime() - startTimeMs) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    const timerDisplay = document.getElementById("timerDisplay");
    if (timerDisplay) timerDisplay.innerText = `${h}:${m}:${s}`;
  }, 1000);
}

function addCount(val) {
  if (!isWorking) return;
  count += val;
  if (count < 0) count = 0;
  document.getElementById("countDisplay").innerText = count;

  const nick = document.getElementById("userNick").value.trim() || localStorage.getItem('support_hub_user');
  const logInput = document.getElementById("logLinkInput").value.trim();
  const logComment = document.getElementById("logCommentInput").value.trim();

  if (val > 0 && logInput !== "") {
    sendDataToSheet({
      type: "Отчет логов",
      nick: nick,
      logInput: logInput,
      logComment: logComment,
      count: count
    });
    document.getElementById("logLinkInput").value = "";
    document.getElementById("logCommentInput").value = "";
  }
  saveShiftState();
}

function finishShift() {
  if (!isWorking) return;
  clearInterval(timerInterval);
  isWorking = false;

  const nick = document.getElementById("userNick").value.trim() || localStorage.getItem('support_hub_user');
  const timeStr = document.getElementById("timerDisplay").innerText;
  const endTimeStr = new Date().toLocaleTimeString();
  
  const report = `🏁 ОТЧЁТ ЗА СМЕНУ\n👤 Работник: ${nick}\n⏰ Время: ${timeStr} (${startTimeStr} - ${endTimeStr})\n📊 Логов: ${count}`;

  sendDataToSheet({
    type: "Отчёты смен",
    nick: nick,
    start: startTimeStr,
    end: endTimeStr,
    duration: timeStr,
    count: count
  });

  document.getElementById("reportBox").innerText = report;
  document.getElementById("reportBox").style.display = "block";
  document.getElementById("copyBtn").style.display = "block";
  document.getElementById("stopBtn").style.display = "none";

  localStorage.removeItem('shift_state');
}

function resetShift() {
  if (confirm("Сбросить таймер и начать новую смену?")) {
    clearInterval(timerInterval);
    isWorking = false;
    count = 0;
    document.getElementById("timerDisplay").innerText = "00:00:00";
    document.getElementById("countDisplay").innerText = "0";
    
    const nickEl = document.getElementById("userNick");
    if (nickEl) nickEl.disabled = false;
    
    document.getElementById("startBtn").style.display = "block";
    document.getElementById("stopBtn").style.display = "none";
    document.getElementById("counterBox").style.opacity = "0.5";
    document.getElementById("counterBox").style.pointerEvents = "none";
    document.getElementById("reportBox").style.display = "none";
    document.getElementById("copyBtn").style.display = "none";
    localStorage.removeItem('shift_state');
  }
}

function copyReport() {
  const text = document.getElementById("reportBox").innerText;
  navigator.clipboard.writeText(text).then(() => alert("Отчёт скопирован!"));
}

function saveShiftState() {
  const nickEl = document.getElementById("userNick");
  const state = { isWorking, startTimeMs, startTimeStr, count, nick: nickEl ? nickEl.value : '' };
  localStorage.setItem('shift_state', JSON.stringify(state));
}

function loadShiftState() {
  const savedState = localStorage.getItem('shift_state');
  if (savedState) {
    const res = JSON.parse(savedState);
    if (res && res.isWorking) {
      isWorking = true;
      startTimeMs = res.startTimeMs;
      startTimeStr = res.startTimeStr || "00:00:00";
      count = res.count;
      
      const nickEl = document.getElementById("userNick");
      if (nickEl) {
        nickEl.value = res.nick;
        nickEl.disabled = true;
      }
      
      document.getElementById("startBtn").style.display = "none";
      document.getElementById("stopBtn").style.display = "block";
      document.getElementById("counterBox").style.opacity = "1";
      document.getElementById("counterBox").style.pointerEvents = "auto";
      document.getElementById("countDisplay").innerText = count;
      startTimerLoop();
    }
  }
}