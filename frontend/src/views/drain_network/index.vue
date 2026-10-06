<template>
  <section class="page" data-module="drain_network">
    <header class="page-head">
      <div>
        <h2>排水管网管理</h2>
        <p class="page-desc">维护排水管段，围绕管段编号、上游节点、下游节点、管段长度做登记、筛选与状态流转。</p>
      </div>
      <div class="page-actions">
        <button class="btn primary" type="button" @click="openCreate">登记排水管段</button>
        <button class="btn" type="button" @click="exportRows">导出排水管网清单</button>
      </div>
    </header>

    <div class="stat-row">
      <article v-for="item in stats" :key="item.label" class="stat-card">
        <span class="stat-label">{{ item.label }}</span>
        <strong class="stat-value">{{ item.value }}</strong>
      </article>
    </div>

    <p class="status-legend">
      <span v-for="item in statusSummary" :key="item.status" class="legend-item">
        {{ item.status }}：{{ item.count }}
      </span>
    </p>

    <form class="filter-bar" @submit.prevent="reload">
      <label v-for="field in filterFields" :key="field" class="filter-item">
        <span>{{ field }}</span>
        <input v-model="filters[field]" :placeholder="`按${field}检索`" />
      </label>
      <button class="btn" type="submit">查询</button>
      <button class="btn ghost" type="button" @click="resetFilters">重置条件</button>
    </form>

    <table class="data-table">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column">{{ column }}</th>
          <th>当前状态</th>
          <th>可执行动作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="String(row.id)">
          <td v-for="column in columns" :key="column">{{ row[column] ?? '—' }}</td>
          <td>{{ row.status }}</td>
          <td class="row-actions">
            <button
              v-for="action in actions"
              :key="action"
              class="link"
              type="button"
              :disabled="isTerminal(row)"
              :title="isTerminal(row) ? '管段已封堵，不能再生成新的预警，历史预警仍可查看' : ''"
              @click="runAction(action, row)"
            >
              {{ action }}
            </button>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td :colspan="columns.length + 2" class="empty-state">暂无排水管网数据，可先登记排水管段</td>
        </tr>
      </tbody>
    </table>

    <footer class="page-foot">
      <span>共 {{ total }} 条排水管网记录</span>
      <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
      <button v-if="loadFailed" class="link" type="button" @click="recoverSeed">
        读取失败，点此重置为示例数据（损坏原文已备份）
      </button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  downloadEntries,
  listEntries,
  moduleMeta,
  resetModule,
  runAction as applyAction,
} from '@/api/local-service'
import type { EntryRow } from '@/data/types'

const meta = moduleMeta('drain_network')
const columns = ["管段编号", "上游节点", "下游节点", "管段长度", "断面尺寸", "设计坡度", "排水能力", "运行状况"]
const actions = ["标记淤积", "预警溢流", "确认封堵"]
const statuses = ["正常", "淤积预警", "溢流风险", "已封堵"]
const terminalStatuses = meta.terminalStatuses ?? []

const rows = ref<EntryRow[]>([])
const total = ref(0)
const errorMessage = ref('')
const loadFailed = ref(false)
const filters = ref<Record<string, string>>({})
const filterFields = columns.slice(0, 3)

function countByStatus(status: string): number {
  return rows.value.filter((row) => String(row.status) === status).length
}

// 风险提示跟着列表数据走：状态一变，卡片、图例、筛选结果一起更新
const stats = computed(() => [
  { label: '管段总数', value: rows.value.length },
  { label: '淤积预警管段', value: countByStatus('淤积预警') },
  { label: '溢流风险管段', value: countByStatus('溢流风险') },
])

const statusSummary = computed(() =>
  statuses.map((status: string) => ({
    status,
    count: countByStatus(status),
  })),
)

function isTerminal(row: EntryRow): boolean {
  return terminalStatuses.includes(String(row.status))
}

function resetFilters() {
  filters.value = {}
  reload()
}

function exportRows() {
  try {
    downloadEntries(meta.key)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '排水管网清单导出失败'
  }
}

function openCreate() {
  errorMessage.value = '排水管段登记入口尚未接入审批流'
}

function runAction(action: string, row: EntryRow) {
  errorMessage.value = ''
  const result = applyAction(meta.key, Number(row.id), action)
  if (!result.ok) {
    errorMessage.value = result.message
    return
  }
  reload()
}

function recoverSeed() {
  errorMessage.value = ''
  try {
    resetModule(meta.key)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '重置排水管网数据失败'
    return
  }
  reload()
}

function reload() {
  errorMessage.value = ''
  try {
    const payload = listEntries(meta.key, filters.value)
    rows.value = payload.items
    total.value = payload.total
    loadFailed.value = false
  } catch (error) {
    // 读取失败：保留上次结果，只说明原因，不清空列表
    loadFailed.value = true
    errorMessage.value = error instanceof Error ? error.message : '排水管网列表读取失败'
  }
}

onMounted(reload)
</script>
