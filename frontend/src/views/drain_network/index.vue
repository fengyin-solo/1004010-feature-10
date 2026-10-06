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
        <template v-for="row in rows" :key="String(row.id)">
          <tr>
            <td v-for="column in columns" :key="column">{{ row[column] ?? '—' }}</td>
            <td>{{ row.status }}</td>
            <td class="row-actions">
              <button
                v-for="action in actions"
                :key="action"
                class="link"
                type="button"
                :disabled="isTerminal(row)"
                :title="isTerminal(row) ? `已${row.status}，不能再生成新的预警` : ''"
                @click="runAction(action, row)"
              >
                {{ action }}
              </button>
              <button class="link" type="button" @click="toggleHistory(row)">
                {{ expandedId === Number(row.id) ? '收起历史' : '预警历史' }}
              </button>
            </td>
          </tr>
          <tr v-if="expandedId === Number(row.id)" class="history-row">
            <td :colspan="columns.length + 2">
              <template v-if="row.history?.length">
                <p v-for="(event, index) in row.history" :key="index" class="history-item">
                  {{ event.at }} · {{ event.action }} · {{ event.from }} → {{ event.to }}
                </p>
              </template>
              <span v-else class="history-empty">暂无预警记录</span>
            </td>
          </tr>
        </template>
        <tr v-if="!rows.length">
          <td :colspan="columns.length + 2" class="empty-state">暂无排水管网数据，可先登记排水管段</td>
        </tr>
      </tbody>
    </table>

    <footer class="page-foot">
      <span>共 {{ total }} 条排水管网记录</span>
      <span v-if="noticeMessage" class="notice-text">{{ noticeMessage }}</span>
      <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  downloadEntries,
  listEntries,
  moduleMeta,
  runAction as applyAction,
} from '@/api/local-service'
import type { EntryRow } from '@/data/types'

const meta = moduleMeta('drain_network')
const columns = ["管段编号", "上游节点", "下游节点", "管段长度", "断面尺寸", "设计坡度", "排水能力", "运行状况"]
const actions = ["标记淤积", "预警溢流", "确认封堵"]
const statuses = ["正常", "淤积预警", "溢流风险", "已封堵"]

const rows = ref<EntryRow[]>([])
// 未筛选的全量数据：统计卡和状态图例以它为准，筛选条件不影响风险提示
const moduleRows = ref<EntryRow[]>([])
const total = ref(0)
const errorMessage = ref('')
const noticeMessage = ref('')
const expandedId = ref<number | null>(null)
const filters = ref<Record<string, string>>({})
const filterFields = columns.slice(0, 3)

function countByStatus(status: string): number {
  return moduleRows.value.filter((row) => String(row.status) === status).length
}

const stats = computed(() => [
  { label: '管段总数', value: moduleRows.value.length },
  { label: '淤积预警管段', value: countByStatus('淤积预警') },
  { label: '溢流风险管段', value: countByStatus('溢流风险') },
])

const statusSummary = computed(() =>
  statuses.map((status: string) => ({ status, count: countByStatus(status) })),
)

const terminalStatuses = meta.terminalStatuses ?? []

function isTerminal(row: EntryRow): boolean {
  return terminalStatuses.includes(String(row.status))
}

function toggleHistory(row: EntryRow) {
  const id = Number(row.id)
  expandedId.value = expandedId.value === id ? null : id
}

function resetFilters() {
  filters.value = {}
  reload()
}

function exportRows() {
  downloadEntries(meta.key)
}

function openCreate() {
  errorMessage.value = '排水管段登记入口尚未接入审批流'
}

function runAction(action: string, row: EntryRow) {
  errorMessage.value = ''
  noticeMessage.value = ''
  const result = applyAction(meta.key, Number(row.id), action)
  if (!result.ok) {
    errorMessage.value = result.message
    return
  }
  noticeMessage.value = result.message
  reload()
}

function reload() {
  errorMessage.value = ''
  try {
    const payload = listEntries(meta.key, filters.value)
    rows.value = payload.items
    total.value = payload.total
    const full = listEntries(meta.key)
    moduleRows.value = full.items
    noticeMessage.value = payload.notice ?? full.notice ?? ''
  } catch (error) {
    // 读取失败：保留上次加载的结果，只说明原因，不清空列表
    errorMessage.value = error instanceof Error ? error.message : '排水管网列表读取失败'
  }
}

onMounted(reload)
</script>
