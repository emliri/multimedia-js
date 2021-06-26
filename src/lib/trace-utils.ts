const MMJS_TRACE_STORAGE_PREFIX = 'mmjs:trace::';

export function traceNamedList (name: string, data: any) {
  name = MMJS_TRACE_STORAGE_PREFIX + name;
  if (!localStorage) return;
  const list: Array<any> = JSON.parse(localStorage.getItem(name) || '[]');
  list.push(data);
  localStorage.setItem(name, JSON.stringify(list));
}

export function traceClearAll () {
  if (!localStorage) return;
  const rmKey: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i).startsWith(MMJS_TRACE_STORAGE_PREFIX)) {
      rmKey.push(localStorage.key(i));
    }
  }
  rmKey.forEach(key => localStorage.removeItem(key));
}
