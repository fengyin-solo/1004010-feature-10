/** 纯前端数据层的公共类型：与全栈版后端返回的结构保持一致，换回后端时页面不用改。 */

/** 一次状态流转的留痕：谁在什么时间把记录从哪个状态流转到了哪个状态。 */
export type StatusEvent = {
  at: string
  action: string
  from: string
  to: string
}

export type EntryRow = {
  id: number
  status: string
  pending: boolean
  abnormal: boolean
  history?: StatusEvent[]
  [field: string]: string | number | boolean | StatusEvent[] | undefined
}

export type ModuleMeta = {
  key: string
  name: string
  entity: string
  desc: string
  fields: string[]
  statuses: string[]
  actions: string[]
  actionTargets: Record<string, string>
  metrics: string[]
  /** 终态：进入这些状态后不再接受任何动作（如排水管段的「已封堵」）。 */
  terminalStatuses?: string[]
  /** 异常态：处于这些状态的记录计入运营概览的异常量；缺省按动作动词推断。 */
  abnormalStatuses?: string[]
}

export type PageResult = {
  items: EntryRow[]
  total: number
  page: number
  size: number
  /** 读取过程中的非致命异常说明（如本地数据损坏已回退），页面展示但不清空列表。 */
  notice?: string
}

export type ActionResult = {
  ok: boolean
  message: string
}

export type OverviewResult = {
  cards: { label: string; value: number }[]
  modules: { name: string; created: number; pending: number; abnormal: number }[]
  /** 读取过程中的非致命异常说明，概览页展示但保留上次统计结果。 */
  notice?: string
}
