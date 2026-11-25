// 디스코드 화면 오른쪽 아래 패널. 확장 아이콘을 누르면 열리고 닫힌다. 닫아도 수집은 계속된다.
(() => {
  const CSS = `
    :host { position: fixed; right: 16px; bottom: 80px; z-index: 2147483647; }
    section { box-sizing: border-box; display: grid; gap: 8px; width: 280px; padding: 12px; border-radius: 8px; background: #1e1f22; color: #f2f3f5; font: 14px/1.5 system-ui, sans-serif; box-shadow: 0 4px 16px rgb(0 0 0 / 50%); }
    h2 { margin: 0; font-size: 14px; }
    button { padding: 8px; border: 0; border-radius: 4px; background: #2b8a7e; color: #fff; font: inherit; cursor: pointer; }
    button:hover { background: #237267; }
    button.plain { background: #3f4147; }
    button.plain:hover { background: #4e5058; }
    button:disabled { opacity: 0.5; cursor: default; }
    button:focus-visible, textarea:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    #controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    p { margin: 0; }
    p:empty { display: none; }
    textarea { box-sizing: border-box; width: 100%; font: 12px/1.4 monospace; }
    [hidden], #controls[hidden] { display: none; }
  `;
  const ACTIVE = ['running', 'paused', 'hidden'];
  let host = null;
  let timer = null;

  const two = (n) => String(n).padStart(2, '0');

  function duration(ms) {
    const s = Math.floor(ms / 1000);
    const rest = `${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`;
    return s < 3600 ? rest : `${Math.floor(s / 3600)}:${rest}`;
  }

  function day(time) {
    const d = new Date(time);
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  }

  function progressText(s) {
    if (s.count === undefined) return ''; // 아직 시작하지 않았다
    return [
      `수집 ${s.count.toLocaleString()}개`,
      s.oldestTime && day(s.oldestTime),
      `${Math.floor(s.progress * 100)}%`,
      duration(s.elapsed),
    ].filter(Boolean).join(' · ');
  }

  function noticeText(s) {
    const text = {
      starting: '준비하고 있어요.',
      paused: '일시정지했어요.',
      hidden: '디스코드 창이 화면에 보여야 수집돼요',
      done: s.reachedStart ? (s.gaps ? '첫 메시지까지 올라갔어요.' : '첫 메시지까지 다 모았어요.') : '옛 글이 더 있는데 불러오지 못해 멈췄어요. 모은 메시지는 저장했어요. 잠시 뒤 다시 수집해보세요.',
      stopped: '중지했어요. 모은 메시지는 저장했어요.',
      error: s.error,
    }[s.state] ?? '';
    return [
      text,
      s.gaps && `중간에 건너뛴 곳이 ${s.gaps}군데 있어요. 다시 수집하면 채워져요.`,
      s.failed && `메시지 ${s.failed}개는 읽지 못했어요.`,
    ].filter(Boolean).join(' ');
  }

  function open() {
    host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
    root.innerHTML = `
      <section aria-label="디스코드 채팅 백업">
        <h2>디스코드 채팅 백업</h2>
        <button type="button" id="start">이 채널 전체 수집</button>
        <div id="controls">
          <button type="button" id="pause"></button>
          <button type="button" id="stop" class="plain">중지</button>
        </div>
        <p id="progress"></p>
        <p id="notice" role="status"></p>
        <button type="button" id="export" class="plain">내보내기 페이지</button>
        <button type="button" id="diagnose" class="plain">DOM 진단</button>
        <p id="diagnosis" role="status"></p>
        <textarea id="report" rows="8" readonly hidden aria-label="진단 결과"></textarea>
      </section>`;
    const $ = (id) => root.getElementById(id);
    let failure = ''; // 버튼을 눌렀는데 시작하지 못한 이유

    function render() {
      const s = DCE.collector.status();
      const active = ACTIVE.includes(s.state);
      $('start').hidden = active;
      $('start').disabled = s.state === 'starting';
      $('controls').hidden = !active;
      $('pause').textContent = s.state === 'paused' ? '이어하기' : '일시정지';
      $('progress').textContent = progressText(s);
      // 같은 글을 다시 쓰면 화면 낭독기가 매초 읽는다.
      const notice = failure || noticeText(s);
      if ($('notice').textContent !== notice) $('notice').textContent = notice;
    }

    const onClick = (id, action) =>
      $(id).addEventListener('click', async () => {
        failure = '';
        try {
          DCE.store.assertAlive();
          await action();
        } catch (error) {
          failure = error.message;
        }
        render();
      });

    onClick('start', () => DCE.collector.start());
    onClick('stop', () => DCE.collector.stop());
    onClick('pause', () => (DCE.collector.status().state === 'paused' ? DCE.collector.resume() : DCE.collector.pause()));
    onClick('export', () =>
      chrome.runtime.sendMessage({ type: 'dce:open-export', newWindow: ACTIVE.includes(DCE.collector.status().state) }),
    );

    $('diagnose').addEventListener('click', async () => {
      const output = $('report');
      output.hidden = true;
      try {
        DCE.store.assertAlive();
        const json = DCE.diagnose();
        const kb = Math.ceil(DCE.byteLength(json) / 1024);
        try {
          await navigator.clipboard.writeText(json);
          $('diagnosis').textContent = `복사됨 (${kb} KB)`;
        } catch {
          $('diagnosis').textContent = `클립보드에 복사하지 못했어요. 아래 글을 Ctrl+C로 복사해주세요. (${kb} KB)`;
          output.value = json;
          output.hidden = false;
          output.select();
        }
      } catch (error) {
        $('diagnosis').textContent = `진단하지 못했어요. ${error.message}`;
      }
    });

    // 막지 않으면 디스코드가 키 입력을 채팅 입력창으로 가져간다.
    for (const type of ['keydown', 'keypress', 'keyup']) {
      host.addEventListener(type, (event) => event.stopPropagation());
    }

    DCE.collector.onChange = render;
    timer = setInterval(render, 1000);
    render();
    document.body.append(host);
  }

  function close() {
    clearInterval(timer);
    DCE.collector.onChange = () => {};
    host.remove();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'dce:toggle-panel') return;
    if (host?.isConnected) close();
    else open();
    sendResponse({ ok: true });
  });
})();
