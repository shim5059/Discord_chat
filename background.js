// 서비스 워커는 쉬면 꺼지므로 상태를 들고 있지 않는다.
chrome.action.onClicked.addListener(async (tab) => {
  // 권한이 없는 사이트에서는 tab.url이 비어 있다.
  if (!tab.url?.startsWith('https://discord.com/')) {
    await chrome.tabs.create({ url: 'https://discord.com/app' });
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'dce:toggle-panel' });
  } catch {
    // 확장을 설치하거나 다시 로드하기 전에 열린 탭에는 응답할 스크립트가 없다.
    await chrome.tabs.reload(tab.id);
  }
});
