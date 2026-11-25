// 묶음 안의 연속 메시지에는 작성자가 없어서 직전 메시지의 작성자로 채운다.
// 시스템 메시지는 묶음에 끼지 않는다. messages는 ID 오름차순이어야 한다.
export function fillAuthors(messages) {
  let last = null;
  return messages.map((m) => {
    if (m.type === 'system') return m;
    if (m.author.name !== null) {
      last = m.author;
      return m;
    }
    return last ? { ...m, author: last } : m;
  });
}
