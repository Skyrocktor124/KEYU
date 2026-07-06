import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/** localStorage 持久化 hook：学习记录全部存在本地，换设备可通过导出/导入迁移 */
export function useLocalStorage<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 存储已满等异常时静默失败，不影响学习流程
    }
  }, [key, value]);
  return [value, setValue];
}
