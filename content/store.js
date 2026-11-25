// chrome.storage.local 읽기/쓰기
window.DCE = window.DCE || {};

DCE.store = {
  // 확장을 다시 로드하면 이미 열려 있던 탭의 스크립트는 chrome.*를 쓸 수 없다.
  assertAlive() {
    if (!globalThis.chrome?.runtime?.id) {
      throw new Error('확장이 다시 로드됐어요. 디스코드 탭을 새로고침해주세요.');
    }
  },
  async get(key) {
    this.assertAlive();
    return (await chrome.storage.local.get(key))[key];
  },
  async set(key, value) {
    this.assertAlive();
    await chrome.storage.local.set({ [key]: value });
  },
};
