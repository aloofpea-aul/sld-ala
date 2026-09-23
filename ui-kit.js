/* ===========================================================================
 *  PEAUI — ชุดกราฟิกกลางของแพลตฟอร์ม กฟส.อ่าวลึก
 *  ใช้ร่วมกันทุกแอป (SLD · สำรวจหม้อแปลง · Patrol · งานตัดต้นไม้)
 *
 *  วิธีใช้ — ใส่บรรทัดนี้ไว้ก่อนสคริปต์หลักของหน้า
 *      <script src="ui-kit.js"></script>            (แอปที่อยู่ในโฟลเดอร์ sld-ala)
 *      <script src="../ui-kit.js"></script>         (แอปที่อยู่ในโฟลเดอร์ย่อย)
 *
 *  ที่มีให้ใช้
 *      PEAUI.setTips([...])                       ทริกที่จะสลับระหว่างรอ (ตั้งต่อแอป)
 *      PEAUI.boot.start([{k,t},...])              หน้าจอเปิดแอป พร้อมรายการขั้นตอน
 *      PEAUI.boot.step(k,'run'|'done'|'skip',note)
 *      PEAUI.boot.close()
 *      PEAUI.saving.show('กำลังอัปโหลดรูป')        หน้าจอรอบันทึก
 *      PEAUI.saving.done('บันทึกสำเร็จ','รหัส ...')
 *      PEAUI.saving.fail('บันทึกไม่สำเร็จ','เหตุผล')
 *      PEAUI.loading('ข้อความ')                    HTML วงแหวนหมุน
 *      PEAUI.skeleton(3,'ข้อความ')                 HTML โครงร่างรอโหลด
 *      PEAUI.showLoading('idของกล่อง','skeleton'|'plain','ข้อความ')
 *      PEAUI.beep('ok'|'err'|'tap'|'save')        เสียง + สั่น (ปิดได้ที่ localStorage patrol_sound)
 * =========================================================================== */
(function () {
  const PURPLE = '#4b2e83', GOLD = '#ffc400', GREEN = '#2e7d32', RED = '#c62828';

  /* ---------- ทริกระหว่างรอ — แต่ละแอปตั้งของตัวเองได้ ---------- */
  let TIPS = [
    '📡 ทุกแอปในแพลตฟอร์มใช้ฐานข้อมูลเดียวกัน แก้ที่เดียวเห็นพร้อมกันทุกที่',
    '🔍 ค้นหาได้ทั้งรหัสอุปกรณ์ เลขหม้อแปลง และชื่อจุดติดตั้ง',
    '🧭 กดปุ่มเข็มทิศบนแผนที่ จะเห็นทิศที่มือถือหันอยู่',
    '📷 ถ่ายรูปให้เห็นทั้งต้นเสาและจุดที่เป็นปัญหาในรูปเดียว',
    '💾 ทุกการแก้ไขถูกบันทึกว่าใครแก้ เมื่อไหร่ จากอะไรเป็นอะไร'
  ];

  /* ---------- สไตล์ ---------- */
  const CSS = `
  .peaui-ov{position:fixed;inset:0;z-index:12000;display:none;align-items:center;justify-content:center;padding:24px;
    background:linear-gradient(170deg,#f6f5f2 0%,#eeeaf5 100%);}
  .peaui-ov.show{display:flex;}
  .peaui-box{text-align:center;max-width:370px;width:100%;font-family:inherit;}
  .peaui-art{margin-bottom:12px;}
  @keyframes peaui-spin{to{transform:rotate(360deg);}}
  @keyframes peaui-flash{0%,100%{opacity:.25;}50%{opacity:1;}}
  @keyframes peaui-in{from{transform:scale(.85);opacity:0;}to{transform:scale(1);opacity:1;}}
  @keyframes peaui-shim{0%{background-position:100% 0;}100%{background-position:0 0;}}
  .peaui-ring-go{transform-origin:60px 60px;animation:peaui-spin 1.05s linear infinite;}
  .peaui-bolt{animation:peaui-flash 1.1s ease-in-out infinite;}
  .peaui-ok .peaui-ring-go{animation:none;stroke:${GREEN};stroke-dasharray:314;}
  .peaui-bad .peaui-ring-go{animation:none;stroke:${RED};stroke-dasharray:314;}
  .peaui-title{font-size:19px;font-weight:700;color:${PURPLE};}
  .peaui-sub{font-size:13px;color:#4e4b45;margin-top:4px;line-height:1.6;}
  .peaui-steps{margin:16px 0 10px;text-align:left;background:#fff;border:1px solid #e3e0da;border-radius:10px;padding:11px 13px;}
  .peaui-step{display:flex;align-items:center;gap:9px;font-size:13.5px;padding:4px 0;color:#6b6860;}
  .peaui-step .ic{width:19px;height:19px;flex:0 0 auto;border-radius:50%;border:2px solid #e3e0da;
    display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;}
  .peaui-step.run .ic{border-color:${PURPLE};border-right-color:transparent;animation:peaui-spin .8s linear infinite;}
  .peaui-step.done{color:#26241f;} .peaui-step.done .ic{background:${GREEN};border-color:${GREEN};}
  .peaui-step.skip .ic{background:#bbb;border-color:#bbb;}
  .peaui-step .note{margin-left:auto;font-size:12px;color:#6b6860;}
  .peaui-bar{height:5px;background:#e3e0da;border-radius:3px;overflow:hidden;}
  .peaui-bar-go{height:100%;width:0;background:${PURPLE};transition:width .35s ease;}
  .peaui-tip{margin-top:16px;background:#fff;border:1px solid #e3e0da;border-radius:10px;padding:13px;
    font-size:13.5px;line-height:1.75;color:#26241f;min-height:74px;display:flex;align-items:center;justify-content:center;}
  .peaui-skip{margin-top:12px;width:100%;padding:8px;border-radius:8px;border:1.5px solid ${PURPLE};
    background:#fff;color:${PURPLE};font:inherit;font-size:13px;cursor:pointer;}
  .peaui-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:26px 14px;gap:10px;color:#4e4b45;font-size:13.5px;text-align:center;}
  .peaui-spin{width:34px;height:34px;border-radius:50%;border:3.5px solid #e3e0da;border-top-color:${PURPLE};
    animation:peaui-spin .85s linear infinite;}
  .peaui-skel{background:#fff;border:1px solid #e3e0da;border-radius:10px;padding:12px;margin-bottom:8px;}
  .peaui-sk{height:11px;border-radius:6px;animation:peaui-shim 1.3s ease infinite;
    background:linear-gradient(90deg,#eeece8 25%,#f7f6f4 37%,#eeece8 63%);background-size:400% 100%;}
  `;

  function logoSvg(cls) {
    return `<svg viewBox="0 0 120 120" width="108" height="108" class="${cls || ''}" style="animation:peaui-in .45s ease;">
      <circle cx="60" cy="60" r="50" fill="none" stroke="#e3e0da" stroke-width="7"/>
      <circle class="peaui-ring-go" cx="60" cy="60" r="50" fill="none" stroke="${PURPLE}" stroke-width="7"
              stroke-linecap="round" stroke-dasharray="70 244"/>
      <g fill="${PURPLE}">
        <rect x="56" y="34" width="8" height="58"/><rect x="34" y="40" width="52" height="6"/>
        <rect x="41" y="56" width="38" height="5"/>
        <circle cx="36" cy="37" r="4"/><circle cx="60" cy="37" r="4"/><circle cx="84" cy="37" r="4"/>
      </g>
      <polygon class="peaui-bolt" points="74,62 92,62 81,79 95,79 70,105 77,86 65,86" fill="${GOLD}"/>
    </svg>`;
  }

  function el(id) { return document.getElementById(id); }
  function ensureDom() {
    if (el('peauiBoot')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const wrap = document.createElement('div');
    wrap.innerHTML =
      `<div class="peaui-ov" id="peauiBoot"><div class="peaui-box">
         <div class="peaui-art" id="peauiBootArt">${logoSvg()}</div>
         <div class="peaui-title" id="peauiBootTitle"></div>
         <div class="peaui-sub" id="peauiBootSub"></div>
         <div class="peaui-steps" id="peauiSteps"></div>
         <div class="peaui-bar"><div class="peaui-bar-go" id="peauiBar"></div></div>
         <div class="peaui-tip" id="peauiBootTip"></div>
         <button type="button" class="peaui-skip" id="peauiSkip">เข้าใช้งานเลย</button>
       </div></div>
       <div class="peaui-ov" id="peauiSave" style="background:rgba(246,245,242,.96);"><div class="peaui-box">
         <div class="peaui-art" id="peauiSaveArt">${logoSvg()}</div>
         <div class="peaui-title" id="peauiSaveTitle">กำลังบันทึก ...</div>
         <div class="peaui-sub" id="peauiSaveSub"></div>
         <div class="peaui-tip" id="peauiSaveTip"></div>
       </div></div>`;
    document.body.appendChild(wrap);
  }

  /* ---------- เสียง ---------- */
  let actx = null;
  function beep(kind) {
    if (localStorage.getItem('patrol_sound') === 'off') return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const notes = kind === 'ok' ? [[880, 0, .12], [1318, .12, .2]]
        : kind === 'err' ? [[220, 0, .18], [165, .18, .28]]
        : kind === 'save' ? [[660, 0, .1], [880, .1, .1], [1318, .2, .25]]
        : [[700, 0, .07]];
      notes.forEach(([f, t, dur]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = kind === 'err' ? 'square' : 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(.0001, actx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(.25, actx.currentTime + t + .02);
        g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + t + dur);
        o.connect(g); g.connect(actx.destination);
        o.start(actx.currentTime + t); o.stop(actx.currentTime + t + dur + .02);
      });
      if (navigator.vibrate) navigator.vibrate(kind === 'err' ? [80, 60, 80] : kind === 'tap' ? 15 : 50);
    } catch (e) {}
  }

  /* ---------- ทริกสลับ ---------- */
  function startTips(id, timer) {
    const box = el(id);
    if (!box || !TIPS.length) return null;
    let i = Math.floor(Math.random() * TIPS.length);
    box.textContent = TIPS[i];
    return setInterval(() => { i = (i + 1) % TIPS.length; box.textContent = TIPS[i]; }, 2800);
  }

  /* ---------- หน้าจอเปิดแอป ---------- */
  const boot = (function () {
    let steps = [], state = {}, tipTimer = null, closed = true, guard = null;
    function render() {
      const done = steps.filter(s => state[s.k] === 'done' || state[s.k] === 'skip').length;
      const bar = el('peauiBar');
      if (bar) bar.style.width = (steps.length ? Math.round(done / steps.length * 100) : 0) + '%';
      const box = el('peauiSteps');
      if (!box) return;
      box.innerHTML = steps.map(s => {
        const st = state[s.k] || '', ic = st === 'done' ? '✓' : st === 'skip' ? '–' : '';
        const note = state[s.k + '_n'] ? `<span class="note">${state[s.k + '_n']}</span>` : '';
        return `<div class="peaui-step ${st}"><span class="ic">${ic}</span><span>${s.t}</span>${note}</div>`;
      }).join('');
    }
    return {
      start(list, opts) {
        ensureDom();
        opts = opts || {};
        steps = list || []; state = {}; closed = false;
        el('peauiBootTitle').textContent = opts.title || document.title || '';
        el('peauiBootSub').textContent = opts.sub || '';
        el('peauiSteps').style.display = steps.length ? '' : 'none';
        el('peauiBar').parentElement.style.display = steps.length ? '' : 'none';
        el('peauiBoot').classList.add('show');
        render();
        clearInterval(tipTimer); tipTimer = startTips('peauiBootTip');
        el('peauiSkip').onclick = () => boot.close(true);
        clearTimeout(guard);
        guard = setTimeout(() => boot.close(), opts.maxWait || 12000);   // กันค้างไม่ว่ากรณีใด
      },
      step(k, st, note) { state[k] = st; if (note != null) state[k + '_n'] = note; render(); },
      close(manual) {
        if (closed) return;
        closed = true;
        clearInterval(tipTimer); clearTimeout(guard);
        const ov = el('peauiBoot');
        if (ov) ov.classList.remove('show');
        if (!manual) beep('tap');
      },
      get isOpen() { return !closed; }
    };
  })();

  /* ---------- หน้าจอรอบันทึก ---------- */
  const saving = (function () {
    let tipTimer = null;
    function art(cls) {
      const a = el('peauiSaveArt');
      if (a) a.innerHTML = logoSvg(cls || '');
    }
    return {
      show(sub) {
        ensureDom();
        el('peauiSaveTitle').textContent = 'กำลังบันทึก ...';
        el('peauiSaveSub').textContent = sub || 'กำลังส่งข้อมูลขึ้นระบบ';
        art('');
        el('peauiSave').classList.add('show');
        clearInterval(tipTimer); tipTimer = startTips('peauiSaveTip');
      },
      done(title, sub) {
        ensureDom();
        el('peauiSaveTitle').textContent = title || 'บันทึกสำเร็จ';
        el('peauiSaveSub').textContent = sub || '';
        art('peaui-ok');
        beep('save');
        clearInterval(tipTimer);
        setTimeout(saving.hide, 1100);
      },
      fail(title, sub) {
        ensureDom();
        el('peauiSaveTitle').textContent = title || 'บันทึกไม่สำเร็จ';
        el('peauiSaveSub').textContent = sub || '';
        art('peaui-bad');
        beep('err');
        clearInterval(tipTimer);
        setTimeout(saving.hide, 2200);
      },
      hide() {
        clearInterval(tipTimer);
        const ov = el('peauiSave');
        if (ov) ov.classList.remove('show');
      }
    };
  })();

  /* ---------- โครงร่างรอโหลด ---------- */
  function loading(msg) {
    return `<div class="peaui-loading"><div class="peaui-spin"></div><div>${msg || 'กำลังโหลดข้อมูล ...'}</div></div>`;
  }
  function skeleton(n, msg) {
    let html = msg ? `<div class="peaui-loading" style="padding:6px 0 10px;">${msg}</div>` : '';
    for (let i = 0; i < (n || 3); i++) {
      html += `<div class="peaui-skel"><div class="peaui-sk" style="width:55%;"></div>
        <div class="peaui-sk" style="width:85%;margin-top:8px;height:9px;"></div>
        <div class="peaui-sk" style="width:40%;margin-top:7px;height:9px;"></div></div>`;
    }
    return html;
  }
  function showLoading(id, kind, msg) {
    const box = el(id);
    if (box) box.innerHTML = kind === 'skeleton' ? skeleton(3, msg) : loading(msg);
  }

  window.PEAUI = {
    boot, saving, beep, loading, skeleton, showLoading,
    setTips(list) { if (Array.isArray(list) && list.length) TIPS = list; },
    ready: ensureDom
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureDom);
  else ensureDom();
})();
