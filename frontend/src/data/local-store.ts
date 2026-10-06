import { SEED_ROWS } from './seed'
import type { EntryRow } from './types'

// 本地持久化：数据放在 localStorage 里，刷新、关掉再打开都还在。
const STORAGE_KEY = 'underground-pipeline-inspection:entries'
// 数据损坏时把原始内容挪到这个键下备份，绝不直接覆盖，记录不丢。
const CORRUPT_BACKUP_KEY = `${STORAGE_KEY}:corrupt-backup`

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// 最近一次读写存储时遇到的非致命异常：页面据此提示「为什么看到的是旧数据/示例数据」。
let lastIssue: string | null = null

export function storageIssue(): string | null {
  return lastIssue
}

function persist(value: Record<string, EntryRow[]>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    lastIssue = null
  } catch (error) {
    lastIssue = `写入本地存储失败（${reasonOf(error)}），本次修改只保留在当前会话，刷新后可能回退`
  }
}

function backupCorrupt(raw: string): void {
  try {
    window.localStorage.setItem(CORRUPT_BACKUP_KEY, raw)
  } catch {
    // 备份写不进去也不再碰主键，避免二次破坏原始数据
  }
}

function readStorage(): Record<string, EntryRow[]> {
  const fallback = clone(SEED_ROWS)
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback
  }
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    lastIssue = `读取本地存储失败（${reasonOf(error)}），本次会话先展示示例数据，已保存的记录不会被改动`
    return fallback
  }
  if (!raw) {
    persist(fallback)
    return fallback
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, EntryRow[]>
    lastIssue = null
    return { ...fallback, ...parsed }
  } catch {
    // 数据损坏：备份原始内容后回退到示例数据，主键保持原样，记录不丢
    backupCorrupt(raw)
    lastIssue = `本地缓存的数据已损坏，原始内容已备份到浏览器存储的「${CORRUPT_BACKUP_KEY}」键下；当前展示示例数据，此前的记录没有丢失`
    return fallback
  }
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

export function saveRows(key: string, rows: EntryRow[]): void {
  const next = { ...allRows(), [key]: rows }
  cache = next
  if (typeof window !== 'undefined' && window.localStorage) {
    persist(next)
  }
}

export function resetRows(key: string): EntryRow[] {
  const rows = clone(SEED_ROWS[key] ?? [])
  saveRows(key, rows)
  return rows
}

export function storageKey(): string {
  return STORAGE_KEY
}
