// 디스코드 ID(스노플레이크)는 64비트라 Number로 바꾸면 값이 깨진다. 계산과 비교는 BigInt로 한다.

export const snowflakeTime = (id) => Number((BigInt(id) >> 22n) + 1420070400000n);

// ID 오름차순(오래된 것부터). 같은 ID는 나중에 수집한 것을 남긴다.
export function sortUnique(messages) {
  const byId = new Map(messages.map((m) => [m.id, m]));
  return [...byId.values()]
    .map((m) => [BigInt(m.id), m])
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, m]) => m);
}
