/* Keystroke Keep — DOM UI: HUD, panels, relic offers, modals, toasts, fake desktop. */
(function () {
  'use strict';
  const KK = window.KK, U = KK.U, D = KK.DATA, F = KK.F, A = KK.actions;
  const W = KK.world;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = U.fmt;
  const UI = KK.ui = { tab: null, buyMult: 1 };
  const icon = (k, cls = '') => `<img class="ico ${cls}" src="${KK.SPR.iconURL[k]}" alt="">`;

  const TABS = [
    { id: 'party', label: 'Party', icon: 'sword' },
    { id: 'forge', label: 'Forge', icon: 'hammer' },
    { id: 'workshop', label: 'Workshop', icon: 'candle' },
    { id: 'relics', label: 'Relics', icon: 'gem' },
    { id: 'legacy', label: 'Legacy', icon: 'crown' },
    { id: 'settings', label: '', icon: 'gear' },
  ];

  UI.init = function () {
    $$('img[data-icon]').forEach((img) => { img.src = KK.SPR.iconURL[img.dataset.icon]; });
    // HUD buttons
    const hb = $('#hud-btns');
    hb.innerHTML = `<button class="hbtn mute" data-mute="1" data-tip="Sound on/off"></button>` + TABS.map((t) => `<button class="hbtn" data-tab="${t.id}" data-tip="${t.label || 'Settings'}"><img src="${KK.SPR.iconURL[t.icon]}" alt=""></button>`).join('');
    hb.addEventListener('click', (e) => {
      const btn = e.target.closest('.hbtn');
      if (!btn) return;
      if (btn.dataset.mute) { UI.setSetting('sound', !KK.S.settings.sound); return; }
      KK.audio.play('ui'); UI.toggle(btn.dataset.tab);
    });
    syncMute();
    // panel tabs
    $('#panel-tabs').innerHTML = TABS.map((t) => `<button class="ptab" data-tab="${t.id}">${icon(t.icon)}${t.label}<span class="badge hidden"></span></button>`).join('');
    $('#panel-tabs').addEventListener('click', (e) => { const b = e.target.closest('.ptab'); if (b) { KK.audio.play('ui'); UI.open(b.dataset.tab); } });
    $('#panel-close').addEventListener('click', () => UI.close());
    $('#panel-body').addEventListener('click', onPanelClick);
    $('#panel-body').addEventListener('input', onPanelInput);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') UI.close(); });
    $('#relic-offer').addEventListener('click', onOfferClick);
    $('#hud-farm').addEventListener('click', () => { if (A.renownGain() > 0) UI.open('legacy'); else UI.open('party'); $('#panel-body').scrollTop = 0; });
    setupDesktop();
    // wave pips
    UI.renderPips();
    KK.on('wave', UI.renderPips); KK.on('floor', UI.renderPips); KK.on('recovered', UI.renderPips); KK.on('floorClear', UI.renderPips);
    KK.on('coinArrive', () => pulse('#hud-gold'));
    KK.on('relicOffer', () => setTimeout(() => UI.toast('The boss dropped a relic! Choose it in ◆ Relics when you have a moment.', 'gem', 'epic', 6), 1400));
    KK.on('dirty', () => { UI.dirty = true; });
    KK.on('retired', () => { UI.dirty = true; UI.close(); });
    setInterval(UI.slowUpdate, 250);
    hookTutorial();
  };

  // ---------------------------------------------------------------- HUD
  let shownGold = 0;
  UI.update = function (dt) {
    const S = KK.S, m = KK.mods();
    shownGold += (S.gold - shownGold) * Math.min(1, dt * 8);
    if (Math.abs(S.gold - shownGold) < 1 || S.gold < shownGold) shownGold = S.gold;
    setText('#hud-gold .val', fmt(shownGold));
    setText('#hud-spark .val', S.settings.countInput ? Math.floor(S.sparks) + '/' + m.sparkCap : 'PAUSED');
    $('#hud-spark').classList.toggle('paused', !S.settings.countInput);
    setText('#hud-embers', fmt(Math.floor(S.embers || 0)));
    $('#hud-spark .sparkbar i').style.width = (100 * S.sparks / m.sparkCap).toFixed(1) + '%';
    const t = KK.fervorTier();
    const fv = $('#hud-fervor');
    if (fv.dataset.t !== String(t)) { fv.dataset.t = t; fv.className = 'fervor t' + t; }
    $('#fv-fill').style.width = S.fervor.toFixed(1) + '%';
    setText('#fv-tier', D.FERVOR_TIERS[t].name);
    setText('#fv-mult', 'x' + KK.powerMult().toFixed(2).replace(/0$/, ''));
  };
  let blinkT = 0;
  UI.slowUpdate = function () {
    if (document.documentElement.classList.contains('kk-paused')) return;
    const S = KK.S;
    blinkT ^= 1;
    document.documentElement.classList.toggle('blink', !!blinkT);
    setText('#hud-floor', 'FLOOR ' + S.floor);
    setText('#hud-biome', F.biomeOf(S.floor).name);
    setText('#hud-rate', S.incomeRate > 0.05 ? fmt(S.incomeRate) + '/s' : '');
    if (S.maxFloorRun !== UI._lastMax) { UI._lastMax = S.maxFloorRun; UI._lastMaxT = S.stats.playTime; }
    const stalled = S.stats.playTime - (UI._lastMaxT || 0) > 300 && A.renownGain() >= 10;
    const blocked = !!(S.bossBlock && S.floor < S.bossBlock) || stalled;
    const g = A.renownGain();
    setText('#hud-farm', blocked && g >= 10 ? `Stuck? ♛ Retire: +${g} Renown` : '⚠ Boss too strong: farming. Level up!');
    $('#hud-farm').classList.toggle('hidden', !blocked || KK.fx.banners.length > 0);
    const pill = $('#hud-demo');
    if (pill) {
      const om = S.omen && D.OMENS.find((o) => o.id === S.omen);
      setText(pill, KK.DEMO_CAP ? 'DEMO · ENDS AT FLOOR 40' + (S.demoLaps ? ` · BEST ${U.fmtTime(S.bestCapTime)} · ${S.demoLaps} CLEAR${S.demoLaps > 1 ? 'S' : ''}` : '') : om ? '◆ ' + om.name.toUpperCase() : '');
      pill.classList.toggle('hidden', (!KK.DEMO_CAP && !om) || KK.fx.banners.length > 0);
      pill.title = om ? om.desc : '';
      pill.classList.toggle('omen', !KK.DEMO_CAP);
    }
    setText('#np-count', fmt(S.stats.keys) + ' keystrokes · ' + U.fmtTime(S.stats.flowTime) + ' in FLOW');
    badges();
    if (UI.tab) refreshPanel();
  };
  UI.renderPips = function () {
    const S = KK.S, boss = F.isBossFloor(S.floor);
    let h = '';
    for (let i = 0; i < W.waves; i++) {
      const cls = i < W.wave - 1 || (i === W.wave - 1 && !W.enemies.some((e) => !e.dead)) ? 'done' : i === W.wave - 1 ? 'cur' : '';
      h += `<i class="${cls} ${boss && i === W.waves - 1 ? 'boss' : ''}"></i>`;
    }
    $('#hud-waves').innerHTML = h;
  };
  KK.on('kill', () => UI.renderPips && UI.renderPips());

  function setText(sel, txt) { const el = typeof sel === 'string' ? $(sel) : sel; if (el && el.textContent !== txt) el.textContent = txt; }
  function pulse(sel) { const el = $(sel); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }

  function anyAffordable() {
    const S = KK.S;
    for (const id of D.PARTY_ORDER) {
      if (S.heroes[id] && F.levelCost(id, S.heroes[id]) <= S.gold) return true;
      if (A.canRecruit(id) && A.recruitCost(id) <= S.gold) return 'recruit';
    }
    return false;
  }
  function badges() {
    const S = KK.S;
    const set = (tab, txt, cls = '') => {
      const hb = $(`.hbtn[data-tab="${tab}"]`);
      let bd = hb.querySelector('.badge');
      if (!txt) { if (bd) bd.remove(); } else { if (!bd) { bd = document.createElement('span'); hb.appendChild(bd); } bd.className = 'badge ' + cls; bd.textContent = txt; }
      const pb = $(`.ptab[data-tab="${tab}"] .badge`);
      if (pb) { pb.classList.toggle('hidden', !txt); pb.textContent = txt || ''; }
    };
    const aff = anyAffordable();
    set('party', aff === 'recruit' ? 'NEW' : aff ? '!' : null, aff ? 'gold' : '');
    const offers = S.relicOffer ? 1 + (S.relicQueue || []).length : 0;
    set('relics', offers ? (offers > 1 ? String(offers) : '!') : null, offers ? 'epic glow' : '');
    const legacyAff = D.LEGACY.some((d) => (S.legacy[d.id] || 0) < d.max && d.cost(S.legacy[d.id] || 0) <= S.renown);
    set('legacy', legacyAff ? '!' : A.canRetire() && S.retires === 0 ? '♛' : null, 'epic');
    const wsAff = D.WORKSHOP.some((d) => (S.workshop[d.id] || 0) < d.max && F.upCost(d, S.workshop[d.id] || 0) <= (S.embers || 0));
    set('workshop', wsAff ? '!' : null, 'spark');
    const forgeAff = D.FORGE.some((d) => (S.forge[d.id] || 0) < d.max && F.upCost(d, S.forge[d.id] || 0) <= S.gold && S.heroes.archer);
    set('forge', forgeAff ? '!' : null, 'gold');
  }

  // ---------------------------------------------------------------- panel
  UI.toggle = (tab) => (UI.tab === tab ? UI.close() : UI.open(tab));
  UI.open = function (tab) {
    UI.tab = tab;
    $('#panel').classList.remove('closed');
    $$('.ptab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $$('.hbtn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    buildPanel();
    if (tab === 'relics' && KK.S.relicOffer) UI.showOffer();
    placeToasts();
  };
  UI.close = function () {
    UI.tab = null;
    $('#panel').classList.add('closed');
    $$('.hbtn').forEach((b) => b.classList.remove('active'));
    placeToasts();
  };
  function placeToasts() {
    requestAnimationFrame(() => {
      const dock = $('#dock').getBoundingClientRect();
      const panelH = UI.tab ? $('#panel').getBoundingClientRect().height : 0;
      $('#toasts').style.bottom = (window.innerHeight - dock.top + panelH + 10) + 'px';
    });
  }
  KK.on('resized', placeToasts);

  function buildPanel() {
    if (!UI.tab) return;
    const body = $('#panel-body');
    body.innerHTML = ({ party: partyHTML, forge: forgeHTML, workshop: workshopHTML, relics: relicsHTML, legacy: legacyHTML, settings: settingsHTML })[UI.tab]();
    UI.dirty = false;
    refreshPanel();
  }
  function refreshPanel() {
    if (UI.dirty) { const st = $('#panel-body').scrollTop; buildPanel(); $('#panel-body').scrollTop = st; return; }
    const S = KK.S;
    $$('#panel-body [data-cost]').forEach((btn) => {
      const cur = btn.dataset.cur || 'gold';
      const have = cur === 'gold' ? S.gold : cur === 'embers' ? (S.embers || 0) : S.renown;
      btn.disabled = +btn.dataset.cost > have || btn.dataset.lock === '1';
    });
    if (UI.tab === 'party') {
      // costs depend on gold when buying MAX
      for (const id of D.PARTY_ORDER) {
        if (!S.heroes[id]) continue;
        const btn = $(`#panel-body [data-action="lvl"][data-id="${id}"]`);
        if (!btn) continue;
        const { total, count } = A.heroCost(id, UI.buyMult === 'max' ? 'max' : UI.buyMult);
        const n = Math.max(1, count);
        const cost = count ? total : F.levelCost(id, S.heroes[id]);
        btn.dataset.cost = cost;
        btn.disabled = cost > S.gold || (UI.buyMult === 'max' && count === 0);
        btn.querySelector('.l').textContent = 'LEVEL UP' + (n > 1 ? ' x' + n : '');
        btn.querySelector('.c').innerHTML = icon('coin') + ' ' + fmt(Math.ceil(cost));
      }
    }
    if (UI.tab === 'legacy') {
      setText('#retire-gain', '+' + A.renownGain());
      setText('#retire-worth', renownWorth());
      setText('#legacy-renown', '♛ ' + S.renown);
    }
    if (UI.tab === 'workshop') setText('#ws-embers', fmt(Math.floor(S.embers || 0)));
  }

  function heroCard(id) {
    const S = KK.S, def = D.HEROES[id], lvl = S.heroes[id], m = KK.mods();
    const port = `<div class="port"><img src="${KK.SPR.portraitURL[id]}" alt=""></div>`;
    if (!lvl) {
      const unlocked = S.maxFloorRun >= def.unlockFloor;
      const c = A.recruitCost(id);
      return `<div class="card ${unlocked ? '' : 'locked'}">${port}<div class="info">
        <div class="nm"><span>${unlocked ? def.name : '???'}</span></div>
        <div class="cls">${def.cls} · ${unlocked ? def.blurb : 'Reach floor ' + def.unlockFloor + ' to meet them.'}</div>
        <div class="ultline">⚡ ${def.ult.name}: ${def.ult.desc}</div>
        ${unlocked ? `<button class="buy" data-action="recruit" data-id="${id}" data-cost="${c}"><span>RECRUIT</span><span>${icon('coin')} ${fmt(c)}</span></button>` : `<button class="buy" disabled><span>LOCKED</span><span>FLOOR ${def.unlockFloor}</span></button>`}
      </div></div>`;
    }
    const dmg = F.heroDmg(id, lvl) * m.dmg * (id === 'knight' ? m.knightDmg : 1);
    const hp = F.heroHp(id, lvl) * m.hp * (id === 'knight' ? m.knightHp : 1);
    const next = Math.ceil((lvl + 1) / 10) * 10;
    return `<div class="card">${port}<div class="info">
      <div class="nm"><span>${def.name}</span><span class="lv">LV ${lvl}</span></div>
      <div class="stats"><span>${id === 'cleric' ? '✚' : '⚔'} ${fmt(dmg)}</span><span>♥ ${fmt(hp)}</span><span style="color:var(--muted)">LV ${next}: x${KK.BAL.dmgMile}</span></div>
      <div class="ultline">${def.ult.free ? 'FREE' : '⚡' + Math.ceil(def.ult.cost * m.ultCost)} ${def.ult.name}: ${def.ult.desc}</div>
      <button class="buy" data-action="lvl" data-id="${id}" data-cost="0"><span class="l">LEVEL UP</span><span class="c"></span></button>
    </div></div>`;
  }
  function partyHTML() {
    const mult = (v, l) => `<button data-action="mult" data-v="${v}" class="${UI.buyMult === v ? 'on' : ''}">${l}</button>`;
    return `<div class="ph"><div><h3>THE PARTY</h3><div class="sub">Gold levels heroes. Your Sparks fire their ultimates automatically.</div></div>
      <div class="buymult">${mult(1, 'x1')}${mult(10, 'x10')}${mult('max', 'MAX')}</div></div>
      <div class="grid">${['knight', 'archer', 'mage', 'cleric'].map(heroCard).join('')}</div>`;
  }
  function upCard(def, lvl, cur, action) {
    const maxed = lvl >= def.max;
    const cost = cur === 'renown' ? def.cost(lvl) : F.upCost(def, lvl);
    const curIcon = cur === 'gold' ? icon('coin') : cur === 'embers' ? icon('candle') : '♛';
    const tooBig = false;
    return `<div class="card ${maxed ? 'maxed' : ''}"><div class="port"><img src="${KK.SPR.iconURL[def.icon]}" alt=""></div><div class="info">
      <div class="nm"><span>${def.name}</span><span class="lv">${maxed ? 'MAX' : 'LV ' + lvl}</span></div>
      <div class="desc">${def.desc(lvl)}${def.needsTyping ? ` <span class="tag">${def.needsTyping === true ? 'NEEDS TYPING' : def.needsTyping}</span>` : ''}</div>
      ${maxed ? '<button class="buy" disabled><span>MAXED</span></button>' : `<button class="buy ${cur === 'embers' ? 'spark' : cur === 'renown' ? 'renown' : ''}" data-action="${action}" data-id="${def.id}" data-cost="${cost}" data-cur="${cur}" data-lock="${tooBig ? 1 : 0}"><span>UPGRADE</span><span>${curIcon} ${fmt(cost)}</span></button>`}
    </div></div>`;
  }
  function forgeHTML() {
    const S = KK.S;
    return `<div class="ph"><div><h3>THE FORGE</h3><div class="sub">Party-wide upgrades bought with gold. Resets when you retire.</div></div></div>
      <div class="grid">${D.FORGE.map((d) => upCard(d, S.forge[d.id] || 0, 'gold', 'forge')).join('')}</div>`;
  }
  function workshopHTML() {
    const S = KK.S;
    return `<div class="ph"><div><h3>WORKSHOP</h3><div class="sub"><b style="color:#ffb070">Embers</b> come from Sparks spent on ultimates (1 per 4), from bosses and from golden rats. They buy upgrades that <b style="color:var(--spark)">never reset</b>.</div></div>
      <div class="res-pill">${icon('candle')} <span id="ws-embers">${fmt(Math.floor(S.embers || 0))}</span> EMBERS</div></div>
      <div class="grid">${D.WORKSHOP.map((d) => upCard(d, S.workshop[d.id] || 0, 'embers', 'workshop')).join('')}</div>`;
  }
  function relicCard(id, count) {
    const r = D.RELICS.find((x) => x.id === id);
    return `<div class="card"><div class="port"><img src="${KK.SPR.iconURL[r.icon]}" alt=""></div><div class="info">
      <div class="nm"><span class="rarity-${r.rar}">${r.name}${count > 1 ? ' x' + count : ''}</span></div>
      <div class="cls rarity-${r.rar}">${D.RARITY[r.rar].label}</div>
      <div class="desc">${r.desc}</div></div></div>`;
  }
  function relicsHTML() {
    const S = KK.S;
    const counts = {};
    for (const r of S.relics) counts[r] = (counts[r] || 0) + 1;
    const waiting = S.relicOffer ? 1 + (S.relicQueue || []).length : 0;
    const offer = waiting ? `<button class="buy big" data-action="showoffer" style="margin-bottom:10px">◆ ${waiting > 1 ? waiting + ' RELIC CHESTS ARE' : 'A RELIC IS'} WAITING. OPEN THE CHEST</button>` : '';
    return `<div class="ph"><div><h3>RELICS</h3><div class="sub">Bosses drop a choice of relics every 10 floors. They last until you retire.</div></div></div>
      ${offer}
      ${S.relics.length ? `<div class="relic-list">${Object.keys(counts).map((id) => relicCard(id, counts[id])).join('')}</div>` : '<div class="empty">No relics yet. Defeat the boss on floor 10!</div>'}`;
  }
  function legacyHTML() {
    const S = KK.S, gain = A.renownGain();
    const st = S.stats;
    const statRow = (k, v) => `<span>${k}</span><span>${v}</span>`;
    return `<div class="legacy-top">
      <div class="retire-box">
        <h4>♛ RETIRE THE PARTY</h4>
        <p>Your heroes retire to the tavern. Gold, levels, Forge and relics reset. You keep <b>Renown</b>, Legacy upgrades and all Workshop upgrades. Renown is paid for <b>beating your deepest record</b> (${S.renownFloor ? 'floor ' + S.renownFloor : 'no record yet'}).</p>
        <p>Deepest floor this delve: <b>${S.maxFloorRun}</b> · Renown: <b style="color:#e9a2ff">${S.renown}</b> (lifetime ${S.renownLifetime}, Fame x${fmt(S.renownLifetime ? KK.mods().fame : 1)} dmg &amp; gold${KK.mods().trophies ? `, ${KK.mods().trophies} depth troph${KK.mods().trophies > 1 ? 'ies' : 'y'}` : ''}${KK.mods().codexRanks ? `, Hollow Codex ${KK.mods().codexRanks}/28` : ''})${S.omen ? `<br>Omen this delve: <b style="color:#ffd76a">${D.OMENS.find((o) => o.id === S.omen).name}</b>` : ''}</p>
        <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
          <div><div class="gain" id="retire-gain">+${gain}</div><div class="worth" id="retire-worth">${renownWorth()}</div></div>
          <button class="buy renown big" data-action="retire" ${A.canRetire() ? '' : 'disabled'} style="flex:1">${gain > 0 ? 'RETIRE FOR RENOWN' : A.canRetire() ? 'RE-DELVE (NEW RUN, NEW RELICS)' : A.retireHint()}</button>
        </div>
      </div>
      <div class="statbox">
        ${statRow('Monsters slain', fmt(st.kills))}${statRow('Bosses slain', fmt(st.bossKills))}
        ${statRow('Keystrokes', fmt(st.keys))}${statRow('Clicks', fmt(st.clicks))}
        ${statRow('Ultimates cast', fmt(st.ults))}${statRow('Time in FLOW', U.fmtTime(st.flowTime))}
        ${statRow('Gold earned', fmt(st.goldEarned))}${statRow('Golden rats', fmt(st.rats))}
        ${statRow('Deepest floor ever', S.maxFloorEver)}${statRow('Retirements', S.retires)}
      </div></div>
      ${achHTML()}
      <div class="ph"><div><h3>HALL OF LEGENDS</h3><div class="sub">Permanent upgrades bought with Renown.</div></div><div class="res-pill renown" id="legacy-renown">♛ ${S.renown}</div></div>
      <div class="grid">${D.LEGACY.map((d) => upCard(d, S.legacy[d.id] || 0, 'renown', 'legacy')).join('')}</div>`;
  }
  function achHTML() {
    if (!KK.ach) return '';
    const S = KK.S, got = S.ach || {};
    const list = KK.ach.LIST.filter((a) => !KK.DEMO_CAP || a.demo);
    const n = list.filter((a) => got[a.id]).length;
    return `<details class="achbox" ${UI.achOpen ? 'open' : ''} ontoggle="KK.ui.achOpen = this.open"><summary>🏆 ACHIEVEMENTS ${n}/${list.length}${KK.DEMO_CAP ? ' (demo set: they unlock on Steam in the full game)' : ''}</summary><div class="achlist">${list.map((a) => `<div class="ach ${got[a.id] ? 'got' : ''}"><b>${a.name}</b><span>${a.desc}</span></div>`).join('')}</div></details>`;
  }
  /** "+X% damage & gold" that the pending Renown would add (Fame), for the retire button. */
  function renownWorth() {
    const S = KK.S, g = A.renownGain();
    if (g <= 0) return '';
    const fame = (R) => (1 + 0.03 * R) * Math.pow(1.004, R);
    const pct = Math.round((fame(S.renownLifetime + g) / fame(S.renownLifetime) - 1) * 100);
    return `+${pct}% DMG & GOLD FOREVER`;
  }
  function settingsHTML() {
    const s = KK.S.settings;
    const opt = (key, v, l) => `<button data-action="set" data-k="${key}" data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`;
    return `<div class="ph"><div><h3>SETTINGS</h3></div></div><div class="settings">
      <div class="setrow"><span>Sound effects</span><div class="opts">${opt('sound', true, 'ON')}${opt('sound', false, 'OFF')}</div></div>
      <div class="setrow"><span>Music</span><div class="opts">${opt('music', true, 'ON')}${opt('music', false, 'OFF')}</div></div>
      <div class="setrow"><span>Volume</span><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-action="vol"></div>
      <div class="setrow"><span>Keystroke blips</span><div class="opts">${opt('keySound', true, 'ON')}${opt('keySound', false, 'OFF')}</div></div>
      <div class="setrow"><span>Calm mode<br><small style="color:var(--muted)">No screen shake, flashes or slow-mo.</small></span><div class="opts">${opt('calm', true, 'ON')}${opt('calm', false, 'OFF')}</div></div>
      <div class="setrow"><span>Frame rate<br><small style="color:var(--muted)">Lower = less GPU &amp; battery. Drops further when idle.</small></span><div class="opts">${opt('fps', 15, '15')}${opt('fps', 24, '24')}${opt('fps', 30, '30')}${opt('fps', 60, '60')}</div></div>
      ${KK.native ? `<div class="setrow"><span>Low-GPU mode<br><small style="color:var(--muted)">Draws the strip without GPU compositing (uses a little CPU). Takes effect after a restart.</small></span><div class="opts">${opt('lowGpu', true, 'ON')}${opt('lowGpu', false, 'OFF')}</div></div>` : ''}
      <div class="setrow"><span>Strip size</span><div class="opts">${opt('size', 'auto', 'AUTO')}${opt('size', 'S', 'S')}${opt('size', 'M', 'M')}${opt('size', 'L', 'L')}</div></div>
      ${KK.S.legacy.quartermaster ? `<div class="setrow"><span>Quartermaster auto-levels heroes</span><div class="opts">${opt('autoLevel', true, 'ON')}${opt('autoLevel', false, 'OFF')}</div></div>` : ''}
      <div class="setrow"><span>Count my keystrokes &amp; clicks<br><small style="color:var(--muted)">Only counts. Never records which keys.</small></span><div class="opts">${opt('countInput', true, 'ON')}${opt('countInput', false, 'PAUSED')}</div></div>
      <div class="setrow"><span>Reset all progress</span><button class="danger" data-action="reset">RESET SAVE</button></div>
      ${KK.native ? '<div class="setrow"><span>Close the strip (progress is saved)</span><button data-action="quit">QUIT GAME</button></div>' : ''}
    </div>`;
  }

  function onPanelClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) { if (el && el.disabled) KK.audio.play('deny'); return; }
    const S = KK.S, id = el.dataset.id;
    let ok = true;
    switch (el.dataset.action) {
      case 'mult': UI.buyMult = el.dataset.v === 'max' ? 'max' : +el.dataset.v; KK.audio.play('ui'); UI.dirty = true; refreshPanel(); return;
      case 'lvl': ok = A.levelHero(id, UI.buyMult); break;
      case 'recruit': ok = A.recruit(id); if (ok) UI.toast(`${D.HEROES[id].name} the ${D.HEROES[id].cls} joins the party!`, 'heart', 'gold'); break;
      case 'forge': ok = A.buyForge(id); break;
      case 'workshop': ok = A.buyWorkshop(id); break;
      case 'legacy': ok = A.buyLegacy(id); break;
      case 'showoffer': UI.showOffer(); return;
      case 'retire': UI.confirmRetire(); return;
      case 'reset': UI.confirmReset(); return;
      case 'quit': KK.save(); window.kkNative && window.kkNative.quit(); return;
      case 'set': {
        const k = el.dataset.k; let v = el.dataset.v;
        if (v === 'true') v = true; else if (v === 'false') v = false; else if (k === 'fps') v = +v;
        UI.setSetting(k, v);
        return;
      }
    }
    if (ok) {
      KK.audio.play('buy');
      UI.dirty = true; refreshPanel();
      const again = $(`#panel-body [data-action="${el.dataset.action}"][data-id="${id}"]`);
      if (again) again.classList.add('flashbuy');
    } else KK.audio.play('deny');
  }
  function onPanelInput(e) {
    if (e.target.dataset.action === 'vol') { KK.S.settings.volume = +e.target.value; KK.audio.applySettings(); }
  }

  // ---------------------------------------------------------------- relic offer
  UI.setSetting = function (k, v) {
    const S = KK.S;
    S.settings[k] = v;
    if (k === 'sound' && v) KK.audio.init();
    KK.audio.applySettings();
    if (k === 'size') KK.render.resize();
    KK.emit('setting', { k, v });
    syncMute();
    KK.audio.play('ui'); UI.dirty = true; refreshPanel(); KK.save();
  };
  function syncMute() {
    const b = $('#hud-btns .mute');
    if (b) b.textContent = KK.S.settings.sound ? '🔊' : '🔇';
    const tb = $('#tb-sound');
    if (tb) tb.textContent = KK.S.settings.sound ? '🔊' : '🔇';
  }
  UI.syncMute = syncMute;
  let offerOpenedAt = 0, offerSel = null;
  UI.showOffer = function () {
    const S = KK.S, off = $('#relic-offer');
    if (!S.relicOffer) { off.classList.add('hidden'); return; }
    offerOpenedAt = performance.now(); offerSel = null;
    $('#toasts').innerHTML = '';
    const more = (S.relicQueue || []).length;
    off.innerHTML = `<div class="offer-title">◆ THE BOSS DROPPED A RELIC! CHOOSE ONE ◆${more ? ` <span style="opacity:.7">(${more} more waiting)</span>` : ''}</div>
      <div class="offer-cards">${S.relicOffer.map((id) => {
        const r = D.RELICS.find((x) => x.id === id);
        return `<div class="ocard ${r.rar}" data-relic="${id}"><img src="${r.rar === 'epic' && r.icon === 'gem' ? KK.SPR.iconURL.gemEpic : KK.SPR.iconURL[r.icon]}" alt="">
          <div class="onm rarity-${r.rar}">${r.name}</div><div class="orar rarity-${r.rar}">${D.RARITY[r.rar].label}</div><div class="odesc">${r.desc}</div></div>`;
      }).join('')}</div>
      <div class="offer-actions"><button class="buy" data-take="1" disabled>PICK A RELIC</button><button class="offer-later" data-later="1">decide later (it'll wait in ◆ Relics)</button></div>`;
    off.classList.remove('hidden');
    off.style.animation = 'none'; void off.offsetWidth; off.style.animation = '';
    if (UI.tab) UI.close();
  };
  function onOfferClick(e) {
    if (e.target.closest('[data-later]')) { $('#relic-offer').classList.add('hidden'); KK.audio.play('ui'); return; }
    if (performance.now() - offerOpenedAt < 600) return; // ignore clicks that were aimed at something else
    const sel = e.target.closest('.ocard');
    if (sel && !sel.classList.contains('picked')) {
      // first click selects, TAKE confirms: one stray click can't lock in a relic
      offerSel = sel.dataset.relic;
      $$('.ocard').forEach((c) => c.classList.toggle('sel', c === sel));
      const take = $('#relic-offer [data-take]');
      const r = D.RELICS.find((x) => x.id === offerSel);
      take.disabled = false; take.textContent = 'TAKE ' + r.name.toUpperCase();
      KK.audio.play('ui');
      return;
    }
    if (!e.target.closest('[data-take]') || !offerSel) return;
    const id = offerSel;
    const card = $(`.ocard[data-relic="${id}"]`);
    if (A.pickRelic(id)) {
      card.classList.add('picked');
      $$('.ocard').forEach((c) => { if (c !== card) c.style.opacity = '0.2'; });
      const r = D.RELICS.find((x) => x.id === id);
      UI.toast(`Relic acquired: ${r.name}`, r.icon, r.rar === 'epic' ? 'epic' : 'gold');
      setTimeout(() => { if (KK.S.relicOffer) UI.showOffer(); else $('#relic-offer').classList.add('hidden'); }, 520);
    }
  }

  // ---------------------------------------------------------------- modals & toasts
  UI.modal = function (html, onBind) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal">${html}</div></div>`;
    const close = () => { root.innerHTML = ''; };
    if (onBind) onBind(root.querySelector('.modal'), close);
    return close;
  };
  UI.confirmRetire = function () {
    const gain = A.renownGain();
    UI.modal(`<h2>♛ RETIRE THE PARTY?</h2>
      <p>Sir Clank and friends hang up their swords. A new generation starts the delve, stronger for it.</p>
      <div class="bigval">+${gain} RENOWN</div>
      ${KK.S.relicOffer ? `<p style="color:#ff9a9a">You have ${1 + (KK.S.relicQueue || []).length} unopened relic chest${(KK.S.relicQueue || []).length ? 's' : ''}. ${(KK.S.relicQueue || []).length ? 'They' : 'It'} will be lost.</p>` : ''}
      <p style="font-size:12px;color:var(--muted)">Resets: gold, hero levels, recruits, Forge, relics, floor.<br>Keeps: Renown, Legacy, Workshop upgrades, Embers.</p>
      <div class="row"><button class="buy" data-x="no" style="background:#3a2f4f;color:#fff;box-shadow:none">NOT YET</button><button class="buy renown" data-x="yes">RETIRE</button></div>`,
    (m, close) => {
      m.querySelector('[data-x=no]').onclick = close;
      m.querySelector('[data-x=yes]').onclick = () => {
        close();
        const g = A.retire();
        if (g) {
          W.partyX = W.partyX + 0; W.reset();
          KK.fx.flash('#ffffff', 1); KK.fx.banner(typeof g === 'number' ? 'A NEW GENERATION RISES' : 'A NEW DELVE BEGINS', typeof g === 'number' ? '+' + g + ' RENOWN' : (KK.S.bestCapTime ? 'BEAT ' + U.fmtTime(KK.S.bestCapTime) : 'NEW RUN'), '#e9a2ff', 3, { subCol: '#fff' });
          if (KK.S.omenOffer) setTimeout(UI.chooseOmen, 1200);
          else { UI.toast('Spend your Renown in the Hall of Legends!', 'crown', 'epic'); setTimeout(() => UI.open('legacy'), 900); }
          KK.save();
        }
      };
    });
  };
  /** Delve Omens: pick one modifier for the new delve (or none). */
  UI.chooseOmen = function () {
    const S = KK.S;
    if (!S.omenOffer) return;
    KK.paused = true; // the dungeon waits while you choose
    const card = (id) => {
      const o = D.OMENS.find((x) => x.id === id);
      const [up, down] = o.desc.split(/, but /i);
      const seen = ((S.achP && S.achP.omens) || []).includes(id);
      return `<button class="omen" data-omen="${id}"><img src="${KK.SPR.iconURL[o.icon]}" alt=""><b>${o.name}${seen ? '' : ' <i class="new">NEW</i>'}</b><span class="up">▲ ${up.replace(/\.$/, '')}</span>${down ? `<span class="down">▼ ${down.replace(/\.$/, '')}</span>` : ''}</button>`;
    };
    UI.modal(`<h2>CHOOSE AN OMEN</h2>
      <p style="font-size:13px">Every new delve can carry one omen: a twist that lasts until you retire. (The dungeon waits while you choose.)</p>
      <div class="omens">${S.omenOffer.map(card).join('')}</div>
      <div class="row"><button class="buy" data-omen="" style="background:#3a2f4f;color:#fff;box-shadow:none">NO OMEN</button></div>`,
    (m, close) => {
      m.addEventListener('click', (e) => {
        const b = e.target.closest('[data-omen]');
        if (!b) return;
        const id = b.dataset.omen || null;
        A.pickOmen(id);
        KK.paused = false;
        close();
        KK.audio.play('relic');
        const o = id && D.OMENS.find((x) => x.id === id);
        UI.toast(o ? `Omen: ${o.name}. Spend your Renown in the Hall of Legends!` : 'No omen this time. Spend your Renown in the Hall of Legends!', 'crown', 'epic', 5);
        setTimeout(() => { UI.open('legacy'); const h = $('.achbox') || $('#legacy-renown'); if (h) h.scrollIntoView({ block: 'start' }); }, 400);
      });
    });
  };
  UI.confirmReset = function () {
    UI.modal(`<h2>RESET EVERYTHING?</h2><p>This wipes your save completely. There is no undo.</p>
      <div class="row"><button class="buy" data-x="no" style="background:#3a2f4f;color:#fff;box-shadow:none">CANCEL</button><button class="buy" data-x="yes" style="background:#e04848;color:#fff">WIPE SAVE</button></div>`,
    (m, close) => {
      m.querySelector('[data-x=no]').onclick = close;
      m.querySelector('[data-x=yes]').onclick = () => { KK.resetting = true; KK.wipeSave(); location.reload(); };
    });
  };
  // Coming back to the PC shouldn't throw a modal over your work: auto-collect with a toast.
  UI.offline = function (secs, gold) {
    KK.fx.coinBurst(W.partyX, 30, 20);
    UI.toast(`Welcome back! While you were away (${U.fmtTime(secs)}) your heroes earned ${fmt(gold)} gold.`, 'coin', 'gold', 7);
  };
  UI.offlineModal = function (secs, gold) {
    UI.modal(`<h2>WELCOME BACK!</h2><p>You were away for <b>${U.fmtTime(secs)}</b>.<br>Your heroes kept delving and earned:</p>
      <div class="bigval">${icon('coin')} ${fmt(gold)}</div>
      <p style="font-size:12px;color:var(--muted)">Offline you earn ${Math.round(KK.mods().offline * 100)}% of your recent kill income. Type and click to go full power!</p>
      <div class="row"><button class="buy" data-x="ok">COLLECT</button></div>`,
    (m, close) => { m.querySelector('[data-x=ok]').onclick = () => { close(); KK.audio.init(); KK.fx.coinBurst(W.partyX, 30, 30); KK.audio.play('chest'); }; });
  };
  KK.on('demoComplete', () => setTimeout(() => {
    UI.demoOpen = true;
    const S = KK.S, st = S.stats;
    const stat = (k, v) => `<div><b>${v}</b><span>${k}</span></div>`;
    UI.modal(`<h2>DEMO COMPLETE!</h2>
      <p>Your party conquered the Mossy Caverns in <b>${U.fmtTime(S.bestCapTime || st.playTime)}</b>.</p>
      <div class="demo-stats">${stat('keystrokes', fmt(st.keys))}${stat('ultimates', fmt(st.ults))}${stat('bosses', fmt(st.bossKills))}${stat('in FLOW', U.fmtTime(st.flowTime))}</div>
      <p><b style="color:#ff7a2e">The Magma Depths</b> and <b style="color:#c472ff">The Hollow Void</b>, 3 more bosses, Delve Omens, the Hollow Codex, depth trophies and 36 achievements wait in the full game. Your save carries over.</p>
      <p style="font-size:12px;color:var(--muted)">Keep the strip running: every re-delve rerolls your relics, a fresh clear of floor 40 pays +6 Renown, and your best time is your score.</p>
      <div class="row"><button class="buy big" data-x="wish">♥ WISHLIST</button><button class="buy" data-x="ok" style="background:#3a2f4f;color:#fff;box-shadow:none">KEEP DELVING</button></div>`,
    (m, close) => {
      const done = () => { UI.demoOpen = false; close(); };
      m.querySelector('[data-x=ok]').onclick = done;
      m.querySelector('[data-x=wish]').onclick = () => { UI.openStore(); done(); };
    });
  }, 2500));
  KK.on('achievement', ({ def }) => { if (def && (!KK.DEMO_CAP || def.demo)) UI.toast(`🏆 Achievement: ${def.name}`, 'crown', 'gold', 5); UI.dirty = true; });
  KK.on('trophy', ({ floor, n }) => { if (floor !== 100) UI.toast(`Depth trophy for floor ${floor}: x1.05 damage & gold forever (${n} total).`, 'crown', 'gold', 6); });
  KK.on('omenPicked', () => { UI.dirty = true; });
  KK.on('codex', ({ name, rank }) => UI.toast(`Hollow Codex: ${name} rank ${rank}/4. x1.03 damage & gold forever.`, 'gem', 'epic', 6));
  KK.on('demoSealed', ({ time }) => UI.toast(`Floor ${KK.DEMO_CAP} cleared in ${U.fmtTime(time)} (best ${U.fmtTime(KK.S.bestCapTime)}). The depths are sealed in the demo: re-delve in ♛ Legacy for +6 Renown.`, 'crown', 'epic', 8));
  /** Steam store page (set KK.STORE_URL once the page exists). */
  UI.openStore = function () {
    const url = KK.STORE_URL;
    if (!url) { UI.toast('The Steam page link goes here once the store page is live.', 'heart', 'gold', 5); return; }
    if (window.kkNative && window.kkNative.openStore) window.kkNative.openStore(url); else window.open(url, '_blank');
  };
  UI.welcome = function (onStart) {
    UI.modal(`<h2>KEYSTROKE KEEP</h2>
      <p style="font-size:15px"><i>Your work is their adventure.</i></p>
      <p>A tiny party of heroes lives in the strip at the bottom of your screen. They delve on their own, but <b style="color:var(--spark)">every key you type and every click you make</b> charges them up.</p>
      <p>${KK.native ? 'Just work normally. Typing and clicking <b>anywhere on your PC</b> counts.' : 'Type in the notepad (or anywhere on the page) and watch what happens.'}</p>
      <p style="font-size:12px;color:var(--muted)">🔒 Keystroke Keep only <b>counts</b> input. It never records what you type.</p>
      <div class="row"><button class="buy big" data-x="go">START DELVING ⚔</button></div>`,
    (m, close) => { m.querySelector('[data-x=go]').onclick = () => { close(); onStart(); }; });
  };
  UI.toast = function (text, ic, cls = '', life = 3.6) {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.style.setProperty('--life', life + 's');
    el.innerHTML = (ic ? icon(ic) : '') + '<span>' + text + '</span>';
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), (life + 0.5) * 1000);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  };

  // ---------------------------------------------------------------- tutorial nudges
  function hookTutorial() {
    const T = () => KK.S.tutorial;
    const once = (key, fn) => { if (!T()[key]) { T()[key] = 1; fn(); } };
    KK.on('activity', () => { if (KK.S.stats.keys + KK.S.stats.clicks === 8) once('sparks', () => UI.toast('Each keystroke makes a Spark ⚡. Sparks fire ultimates!', 'spark', 'spark', 5)); });
    KK.on('ult', () => once('ult', () => UI.toast('Your typing just powered an ultimate! The bar under a hero fills with your Sparks: full = next ultimate.', 'spark', 'spark', 6)));
    KK.on('fervorTier', ({ to }) => { if (to === 3) once('flow', () => UI.toast('FLOW STATE! Keep typing to keep the dungeon lit.', 'spark', 'gold', 5)); });
    KK.on('floor', ({ floor }) => {
      for (const id of D.PARTY_ORDER) if (D.HEROES[id].unlockFloor === floor && !KK.S.heroes[id]) UI.toast(`${D.HEROES[id].name} the ${D.HEROES[id].cls} can be recruited in ⚔ Party!`, 'heart', 'gold', 5);
      if (floor === 20 && KK.S.retires === 0) once('retire', () => UI.toast('You can now ♛ Retire for permanent Renown (when you get stuck).', 'crown', 'epic', 6));
    });
    // the first time a retire is clearly worth it, say so once (players don't know they lose nothing)
    let runStartT = performance.now();
    KK.on('retired', () => { runStartT = performance.now(); });
    setInterval(() => {
      const g = A.renownGain();
      const key = 'retireNudge' + KK.S.retires;
      if (UI.demoOpen || (KK.DEMO_CAP && !KK.S.demoDone)) return;
      const runMin = (KK.S.runTime || 0) / 60;
      if (g >= 30 && !T()[key] && (runMin > 25 || (KK.S.retires === 0 && KK.S.maxFloorRun >= 40))) {
        once(key, () => UI.toast(`Retiring now earns +${g} Renown (${renownWorth().toLowerCase()}). Your next party gets back here fast. Open ♛ Legacy.`, 'crown', 'epic', 9));
      }
    }, 3000);
    KK.on('ratSpawn', () => once('rat', () => UI.toast('A GOLDEN RAT! Click it before it escapes!', 'coin', 'gold', 5)));
    setInterval(() => {
      if (anyAffordable() && !T().lvl) once('lvl', () => UI.toast('You can afford an upgrade. Open ⚔ Party!', 'sword', 'gold', 5));
    }, 2000);
    KK.on('levelUp', () => { T().lvl = 1; });
  }

  // ---------------------------------------------------------------- fake desktop
  function setupDesktop() {
    // starry wallpaper
    const c = $('#wall-stars');
    const draw = () => {
      c.width = innerWidth; c.height = innerHeight;
      const g = c.getContext('2d');
      for (let i = 0; i < 160; i++) {
        g.fillStyle = Math.random() > 0.8 ? '#ffd76a' : '#c9b8ea';
        g.globalAlpha = Math.random() * 0.6 + 0.1;
        const s = Math.random() > 0.9 ? 2 : 1;
        g.fillRect(Math.floor(Math.random() * c.width), Math.floor(Math.random() * c.height * 0.85), s, s);
      }
      // a big pixel moon + castle silhouette
      g.globalAlpha = 0.9; g.fillStyle = '#f4ecd0';
      const mx = c.width * 0.62, my = c.height * 0.16, r = 34;
      for (let y = -r; y <= r; y += 4) for (let x = -r; x <= r; x += 4) if (x * x + y * y < r * r) g.fillRect(mx + x, my + y, 4, 4);
      g.fillStyle = '#d8ccaa';
      for (const [x, y] of [[-12, -8], [8, 4], [-4, 14], [14, -14]]) g.fillRect(mx + x, my + y, 8, 8);
      g.globalAlpha = 1; g.fillStyle = '#140f22';
      const base = c.height - 40 - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--strip-h'));
      const cx0 = c.width * 0.52;
      g.fillRect(cx0, base - 70, 140, 70);
      for (let i = 0; i < 9; i++) g.fillRect(cx0 + i * 16, base - 78, 8, 8);
      g.fillRect(cx0 + 50, base - 140, 40, 70);
      for (let i = 0; i < 3; i++) g.fillRect(cx0 + 50 + i * 16, base - 148, 8, 8);
      g.fillStyle = '#ffd76a';
      g.fillRect(cx0 + 66, base - 120, 8, 12); g.fillRect(cx0 + 20, base - 50, 6, 8); g.fillRect(cx0 + 110, base - 46, 6, 8);
      g.fillStyle = '#100c1c';
      g.fillRect(0, base, c.width, 200);
    };
    draw();
    KK.on('resized', draw);
    // draggable windows
    $$('.window').forEach((win) => {
      const tb = win.querySelector('.titlebar');
      let drag = null;
      tb.addEventListener('mousedown', (e) => {
        if (e.target.closest('.tb-btns')) return;
        const r = win.getBoundingClientRect();
        drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        win.style.right = 'auto';
        $$('.window').forEach((w) => (w.style.zIndex = 1)); win.style.zIndex = 2;
      });
      window.addEventListener('mousemove', (e) => { if (drag) { win.style.left = Math.max(0, e.clientX - drag.dx) + 'px'; win.style.top = Math.max(0, e.clientY - drag.dy) + 'px'; } });
      window.addEventListener('mouseup', () => { drag = null; });
    });
    $$('[data-close]').forEach((x) => x.addEventListener('click', () => { $('#' + x.dataset.close).style.display = 'none'; }));
    // clock
    const clock = () => setText('#tb-clock', new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    clock(); setInterval(clock, 10000);
    $('#tb-sound').addEventListener('click', () => UI.setSetting('sound', !KK.S.settings.sound));
    // dev tools
    $$('[data-warp]').forEach((b) => b.addEventListener('click', () => {
      KK.warp = +b.dataset.warp; $$('[data-warp]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    $('#dev-autotype').addEventListener('change', (e) => { KK.input.autotype(e.target.checked); });
    $('#dev-gold').addEventListener('click', () => { const S = KK.S; KK.gainGold(Math.max(500, S.gold * 2, S.incomeRate * 300), 'dev'); KK.fx.coinBurst(W.partyX, 30, 20); });
    $('#dev-sparks').addEventListener('click', () => { KK.S.sparks = KK.mods().sparkCap; });
    $('#dev-floor').addEventListener('click', () => {
      const S = KK.S; S.floor += 5; if (KK.DEMO_CAP) S.floor = Math.min(S.floor, KK.DEMO_CAP - 1); S.maxFloorRun = Math.max(S.maxFloorRun, S.floor); S.maxFloorEver = Math.max(S.maxFloorEver, S.floor);
      W.enemies = []; W.shots = []; W.wave = 0; W.door = null; W.boss = null; UI.renderPips();
      KK.fx.banner('FLOOR ' + S.floor, 'DEV SKIP', '#7ee8f6', 1.5);
    });
    $('#dev-rat').addEventListener('click', () => W.spawnRat());
  }
})();
