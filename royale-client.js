(function (global) {
  'use strict';
  const C = global.RoyaleCore;
  let config = null,
    active = null;
  function configure(c) {
    if (active && config?.username !== c.username) active.close();
    config = { ...c };
  }
  function open({ root, canvas, renderer, onExit, quality = 'balanced', qualityMode = 'auto' }) {
    if (active) return;
    const T = global.THREE,
      controller = new AbortController(),
      signal = controller.signal,
      oldParent = canvas.parentNode,
      oldNext = canvas.nextSibling,
      oldStyle = canvas.style.cssText;
    const el = (tag, cls, parent, text) => {
      const n = document.createElement(tag);
      n.className = cls || '';
      if (text !== undefined) n.textContent = text;
      parent?.append(n);
      return n;
    };
    const btn = (parent, text, fn, cls = '') => {
      const b = el('button', cls, parent, text);
      b.onclick = fn;
      return b;
    };
    const wrap = el('div', 'br-stage', root);
    wrap.append(canvas);
    canvas.style.cssText = 'display:block;width:100%;height:100%;position:absolute;inset:0';
    const overlay = el('div', 'br-overlay', wrap),
      top = el('header', 'br-top', overlay),
      left = el('div', 'br-brand', top),
      overline = el('small', '', left, 'SUPPORT HUB  /  ОПЕРАЦИЯ 01'),
      title = el('strong', '', left, 'Каменный Берег'),
      status = el('div', 'br-status', top, 'Подключение…');
    const exit = btn(top, 'Выйти', () => close(), 'br-exit');
    const lobbyPanel = el('section', 'br-lobby', overlay);
    el('small', 'br-kicker', lobbyPanel, 'ПОЛЁТНАЯ ГРУППА  /  BR');
    el('h1', '', lobbyPanel, 'Королевская битва');
    el(
      'p',
      'br-lead',
      lobbyPanel,
      'Четыре квадратных километра. Двадцать четыре бойца. Последняя команда в зоне побеждает.',
    );
    const tabs = el('div', 'br-tabs', lobbyPanel),
      solo = btn(tabs, 'Соло', () => join('solo')),
      duo = btn(tabs, 'Дуэты', () => join('duo'));
    const party = el('div', 'br-party', lobbyPanel),
      start = btn(
        lobbyPanel,
        'Начать высадку',
        () =>
          socket?.emit('start', {}, (r) => {
            if (!r?.ok) notice('Начать матч может хост лобби');
          }),
        'br-primary',
      );
    const lobbyNote = el('p', 'br-sub', lobbyPanel, 'Свободные места займут боты.');
    const retry = btn(
      lobbyPanel,
      'Повторить подключение',
      () => {
        if (socket?.connected) join(mode);
        else socket?.connect();
        if (loadError) loadView();
      },
      'br-link',
    );
    retry.hidden = true;
    const hud = el('div', 'br-hud', overlay),
      radar = el('canvas', 'br-radar', hud);
    radar.width = radar.height = 180;
    const cross = el('div', 'br-cross', hud, '+'),
      noticeBar = el('div', 'br-notice', overlay),
      prompt = el('div', 'br-prompt', hud),
      vitals = el('div', 'br-vitals', hud),
      weapon = el('div', 'br-weapon', hud),
      phaseLabel = el('div', 'br-phase', hud);
    const ally = el('div', 'br-ally', hud);
    const board = el('div', 'br-mapplate', overlay),
      mapCanvas = el('canvas', '', board);
    mapCanvas.width = mapCanvas.height = 600;
    btn(board, 'Закрыть карту · M', () => (board.hidden = true));
    board.hidden = true;
    const results = el('div', 'br-results', overlay),
      resultTitle = el('h2', '', results),
      ranking = el('div', '', results);
    results.hidden = true;
    const help = el(
      'div',
      'br-help',
      overlay,
      'WASD · Shift бег · Space прыжок / парашют · E добыча, лестница или помощь · R перезарядка · G броня · 1/2 оружие · M карта',
    );
    let steps = null,
      stride = 0;
    let socket = null,
      mode = 'solo',
      lobby = null,
      state = null,
      view = null,
      loot = { boxes: [], drops: [], rev: -1 },
      raf = 0,
      last = performance.now(),
      snapshotAt = last,
      yaw = 0,
      pitch = 0,
      fire = false,
      aim = false,
      spectator = '',
      nextInput = 0,
      nextUI = 0,
      noticeUntil = 0,
      closed = false,
      loadError = false,
      joined = false,
      gpuQuality = quality,
      w = 0,
      h = 0,
      audio = null,
      context = null,
      joining = 0,
      loading = false;
    const compass = el('div', 'field-bearing', hud);
    const keys = new Set(),
      on = (target, name, fn) => target.addEventListener(name, fn, { signal });
    function notice(msg) {
      noticeBar.textContent = msg;
      noticeUntil = performance.now() + 3500;
      noticeBar.hidden = false;
    }
    function local() {
      return state?.actors.find((a) => a.id === state.self?.id);
    }
    function phase() {
      return lobby?.phase || state?.phase || 'lobby';
    }
    function redrawLobby() {
      const visible = phase() === 'lobby' || !joined;
      lobbyPanel.hidden = !visible;
      hud.hidden = visible;
      help.hidden = visible;
      solo.classList.toggle('on', mode === 'solo');
      duo.classList.toggle('on', mode === 'duo');
      start.disabled = !view || !joined || lobby?.host !== config?.username;
      start.textContent = !view
        ? 'Загрузка города…'
        : lobby?.host === config?.username
          ? 'Начать высадку'
          : 'Ждём решения хоста';
      party.replaceChildren();
      if (!lobby) return;
      const people = lobby.players.filter((p) => p.connected);
      el('small', 'br-kicker', party, 'В ЛОББИ  ' + people.length + ' / 24');
      for (const p of people) {
        const row = el('div', 'br-member', party);
        el('span', '', row, p.name + (p.id === lobby.host ? ' · хост' : ''));
        if (mode === 'duo' && p.id !== config.username) {
          const me = people.find((v) => v.id === config.username),
            mine = me?.choice === p.id,
            theirs = p.choice === config.username;
          btn(row, mine && theirs ? 'В паре ✓' : mine ? 'Отозвать' : theirs ? 'Принять' : 'В пару', () =>
            socket.emit('pair', mine ? null : p.id, (r) => {
              if (!r?.ok) notice('Пара недоступна');
            }),
          );
        }
      }
      lobbyNote.textContent =
        mode === 'duo'
          ? 'Для своей пары выберите друг друга. Остальных объединит автопоиск, последнему одиночке достанется бот.'
          : 'Один боец в команде. После гибели есть одна дуэль за возвращение.';
    }
    function join(next) {
      mode = next;
      joined = false;
      const attempt = ++joining;
      state = null;
      lobby = null;
      results.hidden = true;
      board.hidden = true;
      loot = { boxes: [], drops: [], rev: -1 };
      view?.setLoot(loot);
      redrawLobby();
      if (!socket?.connected) return;
      socket.timeout(7000).emit('join', mode, (err, r) => {
        if (closed || attempt !== joining) return;
        if (err || !r?.ok) {
          status.textContent = r?.error || 'Лобби не отвечает';
          retry.hidden = false;
          return;
        }
        joined = true;
        lobby = r.lobby;
        state = r.state;
        setLoot(r.loot);
        status.textContent = 'Связь установлена';
        retry.hidden = true;
        redrawLobby();
      });
    }
    function setLoot(data) {
      if (!data) return;
      loot = {
        boxes: data.boxes.map((x) => ({ ...x })),
        drops: data.drops.map((x) => ({ ...x })),
        rev: data.rev,
      };
      view?.setLoot(loot);
    }
    function action(kind, slot) {
      if (socket?.connected) socket.emit('action', { kind, slot }, () => {});
    }
    function initSocket() {
      if (!config?.token) {
        status.textContent = 'Для входа нужен действующий сеанс Support Hub';
        return;
      }
      socket = config.io(config.server + '/royale-v2', {
        auth: { token: config.token, protocol: 2 },
        autoConnect: false,
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      socket.on('connect', () => join(mode));
      socket.on('connect_error', (e) => {
        status.textContent = e.message;
        retry.hidden = false;
      });
      socket.on('disconnect', () => {
        joined = false;
        fire = aim = false;
        keys.clear();
        status.textContent = 'Восстановление связи…';
      });
      socket.on('lobby', (l) => {
        if (l.mode !== mode) return;
        lobby = l;
        if (l.phase === 'lobby') {
          state = null;
          results.hidden = true;
        }
        redrawLobby();
      });
      socket.on('loot', setLoot);
      socket.on('lootChange', (d) => {
        if (d.rev !== loot.rev + 1) {
          socket.emit('sync');
          return;
        }
        loot.rev = d.rev;
        if (d.opened !== undefined && loot.boxes[d.opened]) loot.boxes[d.opened].open = true;
        if (d.remove) loot.drops = loot.drops.filter((x) => x.uid !== d.remove);
        if (d.drop) loot.drops.push(d.drop);
        view?.setLoot(loot);
      });
      socket.on('start', () => {
        results.hidden = true;
        notice('Самолёт вошёл в район. M — карта, Space — высадка.');
      });
      socket.on('state', (s) => {
        if (!s || s.mode !== mode) return;
        const previous = state?.self?.s,
          old = local();
        state = s;
        snapshotAt = performance.now();
        const person = local();
        if (person && old && ['ground', 'duel'].includes(person.s) && person.s === old.s) {
          const d = Math.hypot(person.x - old.x, person.z - old.z);
          if (d < 2 && d > 0.015) {
            stride += d;
            if (stride >= 2.55) {
              stride = 0;
              steps?.play(person.y > 2 ? 'metal' : 'stone', 0.44);
            }
          }
        } else stride = 0;
        if (s.lootRev !== loot.rev) socket.emit('sync');
        if (s.self?.s === 'duel' && previous !== 'duel') {
          const a = local();
          yaw = a?.yaw || 0;
          pitch = 0;
          notice('Дуэль · победа возвращает в город');
        }
        if (!previous || s.self?.s !== previous) redrawLobby();
      });
      socket.on('shot', (d) => {
        if (!state || !!d.arena !== !!state.self?.duel || (d.arena && d.arena !== state.self.duel)) return;
        view?.muzzle(d, performance.now());
        const p = local();
        if (audio && p && Math.hypot(p.x - d.o[0], p.z - d.o[2]) < 150) {
          audio.shot(d.weapon, d.o, d.tier === 4 ? 0.45 : 1);
          if (d.by !== p.id) audio.whizz(d.o, d.d, d.len);
        }
      });
      socket.on('notice', (d) => notice(String(d.text).slice(0, 120)));
      socket.on('end', (d) => {
        document.exitPointerLock?.();
        results.hidden = false;
        resultTitle.textContent = d.winner === state?.self?.team ? 'Победа команды' : 'Матч завершён';
        ranking.replaceChildren();
        for (const p of [...d.results].sort((a, b) => b.kills - a.kills || b.damage - a.damage).slice(0, 8))
          el(
            'p',
            '',
            ranking,
            p.name + '  ·  ' + p.kills + ' устранений  ·  ' + Math.round(p.damage) + ' урона',
          );
      });
      socket.connect();
    }
    async function loadView() {
      if (loading) return;
      loading = true;
      loadError = false;
      try {
        global.CS16Graphics.configureRenderer(renderer, { quality: gpuQuality });
        const ready = await global.RoyaleView.create(T, renderer, () => gpuQuality);
        if (closed) {
          ready.dispose();
          return;
        }
        view = ready;
        view.setLoot(loot);
        w = 0;
        redrawLobby();
      } catch (e) {
        if (!closed) {
          loadError = true;
          status.textContent = 'Город не загрузился: ' + e.message;
          retry.hidden = false;
        }
      } finally {
        loading = false;
      }
    }
    const adaptive = global.CS16AdaptiveQuality.create({
      mode: qualityMode,
      quality,
      apply: (q) => {
        gpuQuality = q;
        global.CS16Graphics.configureRenderer(renderer, { quality: q });
        w = 0;
      },
    });
    function unlockAudio() {
      if (context) {
        if (context.state === 'suspended') context.resume().catch(() => {});
        return;
      }
      try {
        context = new AudioContext();
        steps = global.CS16Footsteps.create(context);
        audio = global.CS16BattleAudio.create(context, {
          listener: () => {
            const p = local() || { x: 1000, y: 0, z: 1000 };
            return { x: p.x, y: p.y + 1.55, z: p.z, yaw };
          },
          blocked: (a, b) => {
            const d = b.map((v, i) => v - a[i]),
              n = Math.hypot(...d);
            return (
              n > 1 &&
              C.ray(
                a,
                d.map((v) => v / n),
                n,
                !!state?.self?.duel,
              ) <
                n - 0.15
            );
          },
          indoor: (p) =>
            p[1] < 0 ||
            C.nearby(p[0], p[2]).some(
              (b) =>
                b.owner >= 0 &&
                p[1] < b.y + b.h &&
                p[0] > b.min[0] &&
                p[0] < b.max[0] &&
                p[2] > b.min[2] &&
                p[2] < b.max[2],
            ),
        });
      } catch {}
    }
    let mapBase = null;
    function baseMap() {
      if (mapBase) return mapBase;
      mapBase = document.createElement('canvas');
      mapBase.width = mapBase.height = 1000;
      const g = mapBase.getContext('2d');
      g.scale(0.5, 0.5);
      g.fillStyle = '#3c4848';
      g.fillRect(0, 0, 2000, 2000);
      for (let z = 0; z < 300; z += 10)
        for (let x = 0; x < 600; x += 10) {
          const h = C.terrainHeight(x, z),
            v = Math.round(88 + h * 1.5);
          g.fillStyle =
            Math.abs(z - C.riverZ(x)) < 14 ? '#839da4' : 'rgb(' + v + ',' + (v + 8) + ',' + (v + 6) + ')';
          g.fillRect(x, z, 10, 10);
        }
      for (const b of C.buildings) {
        g.fillStyle = ['#889189', '#71848b', '#907f6e', '#a69a83'][b.kind];
        g.fillRect(b.left, b.front, b.w, b.d);
      }
      for (const r of C.metro) {
        g.fillStyle = '#7798a5';
        g.fillRect(r.x1, r.z1, r.x2 - r.x1, r.z2 - r.z1);
      }
      for (const l of C.landmarks) {
        g.fillStyle = '#e0c77e';
        g.fillRect(l.x - 6, l.z - 6, 12, 12);
      }
      return mapBase;
    }
    function drawMap(can, big) {
      const ctx = can.getContext('2d'),
        size = can.width,
        p = local() || { x: 1000, z: 1000 },
        field = big ? 2000 : 280,
        minX = big ? 0 : p.x - field / 2,
        minZ = big ? 0 : p.z - field / 2,
        k = size / field,
        X = (x) => (x - minX) * k,
        Z = (z) => (z - minZ) * k;
      ctx.fillStyle = '#243335';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(baseMap(), -minX * k, -minZ * k, 2000 * k, 2000 * k);
      if (big) {
        ctx.font = 'bold 10px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e4dfca';
        for (const d of C.landmarks) ctx.fillText(d.name, X(d.x), Z(d.z));
      }
      if (state) {
        const z = state.zone;
        ctx.strokeStyle = '#e4e9bc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(X(z.x), Z(z.z), z.r * k, 0, Math.PI * 2);
        ctx.stroke();
        if (state.age < 44) {
          const [a, b] = state.path;
          ctx.setLineDash([6, 3]);
          ctx.strokeStyle = '#edd28b';
          ctx.beginPath();
          ctx.moveTo(X(a[0]), Z(a[1]));
          ctx.lineTo(X(b[0]), Z(b[1]));
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#ffd788';
          ctx.fillRect(X(state.plane[0]) - 3, Z(state.plane[2]) - 3, 7, 7);
        }
        for (const a of state.actors) {
          if (a.team !== state.self.team || ['out', 'queue', 'duel'].includes(a.s)) continue;
          ctx.fillStyle = a.id === state.self.id ? '#fff' : '#58edc2';
          ctx.beginPath();
          ctx.arc(X(a.x), Z(a.z), 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    function nearestPrompt(p) {
      if (!p) return '';
      const me = state.self;
      if (me.s === 'plane') return 'Space · выпрыгнуть из самолёта';
      if (me.s === 'fall') return 'Space · раскрыть парашют';
      if (me.s === 'chute') return 'WASD · направляй парашют';
      if (me.s === 'queue') return 'Ожидание соперника для дуэли';
      if (me.s === 'out' || me.s === 'watch') return 'Наблюдение · Space сменить бойца';
      if (me.s === 'duel') return 'Дуэль · ' + Math.ceil(me.duelLeft / 1000) + ' с';
      if (me.s === 'down') return 'Нужна помощь · ' + Math.ceil(me.bleed / 1000) + ' с';
      if (me.climb) return 'Подъём / спуск · E отсоединиться';
      if (me.revive) return 'Поднимаешь напарника · ' + (me.revive / 1000).toFixed(1) + ' с — держи E';
      const distance = (q) => Math.hypot(q.x - p.x, q.z - p.z, q.y - p.y);
      if (state.actors.some((q) => q.team === me.team && q.s === 'down' && distance(q) < 3))
        return 'Удерживай E · поднять напарника';
      const item = loot.drops.filter((q) => distance(q) < 3.3).sort((a, b) => distance(a) - distance(b))[0];
      if (item)
        return (
          'E · ' +
          C.profile(item.gun.id, item.gun.tier).name +
          ' · ' +
          C.tiers[item.gun.tier] +
          ' · ' +
          C.mods.slice(0, item.gun.tier).join(' / ')
        );
      const box = loot.boxes.find((q) => !q.open && distance(q) < 3.3);
      if (box) return 'E · открыть ящик · ' + C.tiers[box.tier];
      return C.ladderNear(p) ? 'E · лестница на крышу / вниз' : '';
    }
    function updateUI(t) {
      if (t > noticeUntil) noticeBar.hidden = true;
      if (!state) return;
      const me = state.self,
        p = local(),
        held = me.gear[me.slot];
      status.textContent = (mode === 'duo' ? 'ДУЭТЫ' : 'СОЛО') + '  ·  В ЖИВЫХ ' + state.alive + ' / 24';
      vitals.textContent =
        '♥ ' + me.hp + '   ◈ ' + me.armor + '   /   Пластины ' + me.plates + '   ·   Устранения ' + me.kills;
      weapon.textContent = held
        ? C.profile(held.id, held.tier).name +
          '  ' +
          held.mag +
          ' / ' +
          held.reserve +
          '   ·   ' +
          C.tiers[held.tier] +
          (me.reload ? ' · перезарядка' : '')
        : 'Наблюдение';
      weapon.style.borderColor = held ? C.colors[held.tier] : '#6e7e81';
      prompt.textContent = nearestPrompt(p);
      prompt.hidden = !prompt.textContent;
      compass.textContent = global.CS16FieldView.bearing(yaw);
      const mate = state.actors.find((a) => a.team === me.team && a.id !== me.id);
      ally.hidden = !mate || mode !== 'duo';
      if (mate)
        ally.textContent =
          '◆ ' +
          mate.n +
          ' · ' +
          (mate.s === 'down' ? 'НУЖНА ПОМОЩЬ' : mate.hp + ' HP') +
          (p ? ' · ' + Math.round(Math.hypot(p.x - mate.x, p.z - mate.z)) + ' м' : '');
      const gas = p && Math.hypot(p.x - state.zone.x, p.z - state.zone.z) > state.zone.r;
      phaseLabel.textContent = me.duel
        ? 'ДУЭЛЬ'
        : gas
          ? 'ПОКИНЬ ГАЗ'
          : 'ЗОНА ' + (state.zone.stage + 1) + '  ·  ' + Math.ceil(state.zone.nextIn) + ' с';
      phaseLabel.classList.toggle('danger', !!gas && !me.duel);
      cross.hidden = !['ground', 'duel'].includes(me.s);
      drawMap(radar, false);
      if (!board.hidden) drawMap(mapCanvas, true);
    }
    function frame(t) {
      if (closed) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016),
        visible = wrap.getClientRects().length > 0 && !document.hidden;
      adaptive.sample(t - last, visible && phase() === 'live');
      last = t;
      if (!visible) {
        keys.clear();
        fire = aim = false;
        return;
      }
      if (w !== wrap.clientWidth || h !== wrap.clientHeight) {
        w = wrap.clientWidth;
        h = wrap.clientHeight;
        view?.resize(w, h);
      }
      if (state && t > nextInput) {
        nextInput = t + 48;
        socket?.volatile.emit('input', {
          yaw,
          pitch,
          f: Number(keys.has('KeyW')) - Number(keys.has('KeyS')),
          s: Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
          sprint: keys.has('ShiftLeft'),
          aim,
          fire: fire && document.pointerLockElement === canvas,
          use: keys.has('KeyE'),
          jump: keys.has('Space'),
        });
      }
      view?.update(
        state,
        {
          yaw,
          pitch,
          aim,
          spectator,
          snapshotAt,
          moving: board.hidden && ['KeyW', 'KeyS', 'KeyA', 'KeyD'].some((k) => keys.has(k)),
        },
        t,
        dt,
      );
      if (t > nextUI) {
        nextUI = t + 150;
        updateUI(t);
      }
    }
    on(canvas, 'mousedown', (e) => {
      if (phase() !== 'live' || !board.hidden) return;
      unlockAudio();
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock()?.catch(() => {});
        return;
      }
      if (e.button === 0) fire = true;
      if (e.button === 2) aim = true;
    });
    on(window, 'mouseup', (e) => {
      if (e.button === 0) fire = false;
      if (e.button === 2) aim = false;
    });
    on(canvas, 'contextmenu', (e) => e.preventDefault());
    on(window, 'mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      yaw -= e.movementX * (aim ? 0.0013 : 0.0024);
      pitch = C.clamp(pitch - e.movementY * (aim ? 0.0013 : 0.0024), -1.4, 1.4);
    });
    on(document, 'pointerlockchange', () => {
      if (document.pointerLockElement !== canvas) {
        keys.clear();
        fire = aim = false;
      }
    });
    on(window, 'blur', () => {
      keys.clear();
      fire = aim = false;
    });
    on(window, 'keydown', (e) => {
      if (!state || phase() !== 'live' || !wrap.getClientRects().length) return;
      if (['Space', 'KeyM', 'KeyE', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'KeyM') {
        board.hidden = !board.hidden;
        if (!board.hidden) {
          keys.clear();
          fire = aim = false;
          document.exitPointerLock?.();
          drawMap(mapCanvas, true);
        }
        return;
      }
      if (!board.hidden) return;
      keys.add(e.code);
      if (e.code === 'Space') {
        if (['plane', 'fall'].includes(state.self.s)) action('jump');
        else if (['out', 'watch'].includes(state.self.s)) {
          const people = state.actors.filter((a) => a.s === 'ground' || a.s === 'chute');
          spectator =
            people[(people.findIndex((a) => a.id === spectator) + 1) % Math.max(1, people.length)]?.id || '';
        }
      }
      if (e.code === 'KeyE') action('use');
      if (e.code === 'KeyR') action('reload');
      if (e.code === 'KeyG') action('plate');
      if (e.code === 'Digit1' || e.code === 'Digit2') action('slot', e.code === 'Digit1' ? 0 : 1);
    });
    on(window, 'keyup', (e) => keys.delete(e.code));
    function close() {
      if (closed) return;
      closed = true;
      controller.abort();
      cancelAnimationFrame(raf);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      socket?.emit('leave');
      socket?.disconnect();
      steps?.dispose();
      audio?.dispose();
      context?.close().catch(() => {});
      view?.dispose();
      oldParent.insertBefore(canvas, oldNext?.parentNode === oldParent ? oldNext : null);
      canvas.style.cssText = oldStyle;
      wrap.remove();
      active = null;
      onExit();
    }
    active = { close };
    redrawLobby();
    initSocket();
    loadView();
    raf = requestAnimationFrame(frame);
    return active;
  }
  global.HubRoyale = {
    configure,
    open,
    close() {
      active?.close();
    },
  };
})(window);
