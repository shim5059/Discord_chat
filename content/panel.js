// 디스코드 화면 오른쪽 아래 패널. 확장 아이콘을 누르면 열리고 닫힌다.
(() => {
  const CSS = `
    :host { position: fixed; right: 16px; bottom: 80px; z-index: 2147483647; }
    section { box-sizing: border-box; width: 280px; padding: 12px; border-radius: 8px; background: #1e1f22; color: #f2f3f5; font: 14px/1.5 system-ui, sans-serif; box-shadow: 0 4px 16px rgb(0 0 0 / 50%); }
    h2 { margin: 0 0 8px; font-size: 14px; }
    button { width: 100%; padding: 8px; border: 0; border-radius: 4px; background: #2b8a7e; color: #fff; font: inherit; cursor: pointer; }
    button:hover { background: #237267; }
    button:focus-visible, textarea:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    p { margin: 8px 0 0; }
    p:empty { display: none; }
    textarea { box-sizing: border-box; width: 100%; margin-top: 8px; font: 12px/1.4 monospace; }
    [hidden] { display: none; }
  `;
  let host = null;

  function open() {
    host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
    root.innerHTML = `
      <section aria-label="디스코드 채팅 백업">
        <h2>디스코드 채팅 백업</h2>
        <button type="button">DOM 진단</button>
        <p role="status"></p>
        <textarea rows="8" readonly hidden aria-label="진단 결과"></textarea>
      </section>`;
    const status = root.querySelector('p');
    const output = root.querySelector('textarea');

    root.querySelector('button').addEventListener('click', async () => {
      output.hidden = true;
      try {
        DCE.store.assertAlive();
        const json = DCE.diagnose();
        const kb = Math.ceil(DCE.byteLength(json) / 1024);
        try {
          await navigator.clipboard.writeText(json);
          status.textContent = `복사됨 (${kb} KB)`;
        } catch {
          status.textContent = `클립보드에 복사하지 못했어요. 아래 글을 Ctrl+C로 복사해주세요. (${kb} KB)`;
          output.value = json;
          output.hidden = false;
          output.select();
        }
      } catch (error) {
        status.textContent = `진단하지 못했어요. ${error.message}`;
      }
    });

    // 막지 않으면 디스코드가 키 입력을 채팅 입력창으로 가져간다.
    for (const type of ['keydown', 'keypress', 'keyup']) {
      host.addEventListener(type, (event) => event.stopPropagation());
    }
    document.body.append(host);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'dce:toggle-panel') return;
    if (host?.isConnected) host.remove();
    else open();
    sendResponse({ ok: true });
  });
})();
