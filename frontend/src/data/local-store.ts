import { SEED_ROWS } from './seed'
import type { EntryRow } from './types'

// 本地持久化：数据放在 localStorage 里，刷新、关掉再打开都还在。
const STORAGE_KEY = 'underground-pipeline-inspection:entries'
// 读到损坏数据时先把原始内容备份到这个键，记录不能丢。
const BACKUP_KEY = `${STORAGE_KEY}:backup`

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function backupRaw(raw: string): void {
  try {
    window.localStorage.setItem(BACKUP_KEY, raw)
  } catch {
    // 备份失败（如存储已满）也不掩盖原本的读取错误
  }
}

function readStorage(): Record<string, EntryRow[]> {
  const fallback = clone(SEED_ROWS)
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback))
    } catch {
      // 存储不可写（隐私模式、配额满）：先用示例数据跑着，写操作失败时会单独报错
    }
    return fallback
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    backupRaw(raw)
    throw new Error('本地保存的管网数据已损坏，原始内容已备份、未被覆盖，可恢复备份或重置模块')
  }
  const corrupted =
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.values(parsed as Record<string, unknown>).some((value) => !Array.isArray(value))
  if (corrupted) {
    backupRaw(raw)
    throw new Error('本地保存的管网数据格式异常，原始内容已备份、未被覆盖，可恢复备份或重置模块')
  }
  return { ...fallback, ...(parsed as Record<string, EntryRow[]>) }
}

let cache: Record<string, EntryRow[]> | null = null

export function allRows(): Record<string, EntryRow[]> {
  if (cache === null) {
    cache = readStorage()
  }
  return cache
}

export function listRows(key: string): EntryRow[] {
  return allRows()[key] ?? []
}

function persist(next: Record<string, EntryRow[]>): void {
  // 先写 localStorage 再更新内存缓存：写入失败时缓存不动，两边不会各说各话
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  cache = next
}

export function saveRows(key: string, rows: EntryRow[]): void {
  persist({ ...allRows(), [key]: rows })
}

export function resetRows(key: string): EntryRow[] {
  const rows = clone(SEED_ROWS[key] ?? [])
  let base: Record<string, EntryRow[]>
  try {
    base = allRows()
  } catch {
    // 已有数据损坏时以示例数据为底重新播种，给页面一条恢复路径（损坏原文仍在备份键里）
    base = clone(SEED_ROWS)
  }
  persist({ ...base, [key]: rows })
  return rows
}

export function storageKey(): string {
  return STORAGE_KEY
}
