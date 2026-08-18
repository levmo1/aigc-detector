import { apiUrl } from '@/frontend/api'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RuleGroup, RulePattern } from '@/lib/rules/engine'
import { createRuleEngine, validateRegexPattern } from '@/lib/rules/engine'
import { builtinFeatures } from '@/lib/rules/features'

interface RuleLibraryResponse {
  groups: RuleGroup[]
  thresholds?: { segmentAIScore: number; segmentUncertainScore: number; minimumAIRuleGroups?: number }
  revision?: number
  features: Record<string, { weight: number; note?: string }>
  error?: { message?: string }
}

interface PreviewResult {
  label: string
  hits: string[]
  features: string[]
}

export function RulesManager() {
  const [groups, setGroups] = useState<RuleGroup[]>([])
  const [features, setFeatures] = useState<RuleLibraryResponse['features']>({})
  const [thresholds, setThresholds] = useState({ segmentAIScore: 3, segmentUncertainScore: 1, minimumAIRuleGroups: 2 })
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [newRule, setNewRule] = useState({ groupId: '', pattern: '', weight: 2, note: '', excludes: '' })
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
    }
  }, [])

  const loadLibrary = useCallback(async () => {
    const response = await fetch(apiUrl('/api/rules'))
    const body = await response.json() as RuleLibraryResponse
    if (!response.ok) throw new Error('无法读取规则库。')
    return body
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadLibrary()
      .then((body) => {
        if (cancelled) return
        setGroups(body.groups)
        setFeatures(body.features)
        setRevision(body.revision ?? 0)
        if (body.thresholds) setThresholds((current) => ({ ...current, ...body.thresholds }))
        setNewRule((current) => ({ ...current, groupId: body.groups[0]?.id ?? '' }))
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '无法读取规则库。')
      })

    return () => {
      cancelled = true
    }
  }, [loadLibrary])

  const addRule = () => {
    const pattern = newRule.pattern.trim()
    if (!pattern || !newRule.groupId) return

    const regexError = validateRegexPattern(pattern)
    if (regexError) {
      setError(`规则「${pattern}」无效：${regexError}`)
      return
    }

    setError(null)
    setGroups((current) => current.map((group) => {
      if (group.id !== newRule.groupId) return group
      const rule: RulePattern = {
        pattern,
        weight: Math.min(10, Math.max(1, newRule.weight)),
        excludes: newRule.excludes
          .split(/[，,]/u)
          .map((item) => item.trim())
          .filter(Boolean),
        note: newRule.note.trim() || undefined,
      }
      return { ...group, rules: [...group.rules, rule] }
    }))
    setNewRule((current) => ({ ...current, pattern: '', note: '', excludes: '' }))
  }

  const removeRule = (groupId: string, ruleIndex: number) => {
    setGroups((current) => current.map((group) => (
      group.id === groupId
        ? { ...group, rules: group.rules.filter((_, index) => index !== ruleIndex) }
        : group
    )))
  }

  const saveRulesPayload = async (nextGroups: RuleGroup[], nextThresholds = thresholds) => {
    setSaved(false)
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/rules'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ groups: nextGroups, thresholds: nextThresholds }),
      })
      const body = await response.json() as RuleLibraryResponse
      if (!response.ok) throw new Error(body.error?.message ?? '保存失败，请检查规则格式。')
      setGroups(body.groups)
      setRevision(body.revision ?? revision)
      if (body.thresholds) setThresholds((current) => ({ ...current, ...body.thresholds }))
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), 2000)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败。')
    }
  }

  const saveRules = async () => saveRulesPayload(groups)

  const resetRules = async () => {
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/rules'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          groups: [],
          thresholds: { segmentAIScore: 3, segmentUncertainScore: 1, minimumAIRuleGroups: 2 },
        }),
      })
      const body = await response.json() as RuleLibraryResponse
      if (!response.ok) throw new Error(body.error?.message ?? '重置失败。')
      setGroups(body.groups)
      setRevision(body.revision ?? revision)
      if (body.thresholds) setThresholds((current) => ({ ...current, ...body.thresholds }))
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), 2000)
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : '重置失败。')
    }
  }

  const rollbackRules = async () => {
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/rules/rollback'), { method: 'POST' })
      const body = await response.json() as RuleLibraryResponse
      if (!response.ok) throw new Error(body.error?.message ?? '撤销失败。')
      setGroups(body.groups)
      setRevision(body.revision ?? revision)
      if (body.thresholds) setThresholds((current) => ({ ...current, ...body.thresholds }))
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), 2000)
    } catch (rollbackError) {
      setError(rollbackError instanceof Error ? rollbackError.message : '撤销失败。')
    }
  }

  const exportRules = async () => {
    try {
      const response = await fetch(apiUrl('/api/rules/export'))
      if (!response.ok) throw new Error('导出规则失败。')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'aigc-rules.json'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : '导出规则失败。')
    }
  }

  const importRules = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const parsed = JSON.parse(await file.text()) as { groups?: RuleGroup[]; thresholds?: RuleLibraryResponse['thresholds'] }
      if (!Array.isArray(parsed.groups)) throw new Error('文件中没有找到规则组。')
      const importedThresholds = { ...thresholds, ...parsed.thresholds }
      await saveRulesPayload(parsed.groups, importedThresholds)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : '导入规则失败。')
    }
  }

  const runPreview = () => {
    if (!previewText.trim()) return
    const engine = createRuleEngine({ groups, thresholds, features: builtinFeatures })
    const evaluations = engine.evaluate([{
      id: 'preview',
      text: previewText,
      start: 0,
      end: previewText.length,
      paragraphIndex: 0,
    }])
    const evaluation = evaluations[0]
    const label = engine.classify(evaluation.score, evaluation.ruleGroupCount)
    setPreview({
      label: label === 'ai' ? 'AI 倾向' : label === 'human' ? '人工倾向' : '不确定',
      hits: evaluation.hits.map((hit) => `${hit.groupName}：${hit.rule.pattern}`),
      features: Object.entries(evaluation.featureScores)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => `${name}（${value}）`),
    })
  }

  const revisionLabel = revision > 0 ? `v${revision}` : '默认'

  return (
    <div className="rules-manager">
      <div className="rules-toolbar">
        <div>
          <p className="eyebrow">RULE LIBRARY</p>
          <h2>检测规则</h2>
          <p>词条与正则按组计分，命中多项时叠加权重；统计特征由引擎内置。</p>
        </div>
        <div className="rules-actions">
          <button className="secondary-button" type="button" onClick={exportRules}>导出</button>
          <button className="secondary-button" type="button" onClick={() => importInputRef.current?.click()}>导入</button>
          <button className="secondary-button" type="button" onClick={() => void rollbackRules}>撤销上次保存</button>
          <button className="secondary-button" type="button" onClick={resetRules}>恢复默认</button>
          <button className="primary-button" type="button" onClick={saveRules}>
            {saved ? '已保存 ✓' : '保存规则'}
          </button>
        </div>
      </div>

      <input
        ref={importInputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        onChange={(event) => void importRules(event)}
      />

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="rules-layout">
        <div className="rules-groups">
          {groups.map((group) => (
            <section className="rule-group-card" key={group.id}>
              <header>
                <h3>{group.name}</h3>
                <span className="rule-group-id">{group.id} · 组权重 {group.weight} · 单组最多 {group.maxContribution ?? 6} 分</span>
              </header>
              <ul>
                {group.rules.map((rule, ruleIndex) => (
                  <li key={`${group.id}-${ruleIndex}`}>
                    <code>{rule.pattern}</code>
                    <span className="rule-weight">×{rule.weight}</span>
                    {rule.excludes?.length ? <small>排除：{rule.excludes.join('、')}</small> : null}
                    {rule.note ? <small>{rule.note}</small> : null}
                    <button
                      className="rule-remove"
                      type="button"
                      aria-label={`删除规则 ${rule.pattern}`}
                      onClick={() => removeRule(group.id, ruleIndex)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="rule-add-row">
                <select
                  aria-label="新规则所属组"
                  value={newRule.groupId}
                  onChange={(event) => setNewRule((current) => ({ ...current, groupId: event.target.value }))}
                >
                  {groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}
                </select>
                <input
                  aria-label="新规则内容"
                  placeholder="词条或正则，如：不容忽视"
                  value={newRule.pattern}
                  onChange={(event) => setNewRule((current) => ({ ...current, pattern: event.target.value }))}
                />
                <input
                  aria-label="新规则权重"
                  type="number"
                  min={1}
                  max={10}
                  value={newRule.weight}
                  onChange={(event) => setNewRule((current) => ({ ...current, weight: Number(event.target.value) }))}
                />
                <input
                  aria-label="新规则说明"
                  placeholder="说明（可选）"
                  value={newRule.note}
                  onChange={(event) => setNewRule((current) => ({ ...current, note: event.target.value }))}
                />
                <input
                  aria-label="新规则排除词"
                  placeholder="排除词（逗号分隔，可选）"
                  value={newRule.excludes}
                  onChange={(event) => setNewRule((current) => ({ ...current, excludes: event.target.value }))}
                />
                <button className="secondary-button" type="button" onClick={addRule}>添加规则</button>
              </div>
            </section>
          ))}
        </div>

        <aside className="rules-side">
          <section className="rule-thresholds-card">
            <div className="rule-card-heading">
              <div>
                <h3>判定阈值</h3>
                <small>当前修订 {revisionLabel}</small>
              </div>
            </div>
            <label>
              <span>AI 分数阈值</span>
              <input
                aria-label="AI 分数阈值"
                type="number"
                min={1}
                max={20}
                value={thresholds.segmentAIScore}
                onChange={(event) => setThresholds((current) => ({ ...current, segmentAIScore: Number(event.target.value) }))}
              />
            </label>
            <label>
              <span>不确定分数阈值</span>
              <input
                aria-label="不确定分数阈值"
                type="number"
                min={0}
                max={10}
                value={thresholds.segmentUncertainScore}
                onChange={(event) => setThresholds((current) => ({ ...current, segmentUncertainScore: Number(event.target.value) }))}
              />
            </label>
            <label>
              <span>最少规则组数</span>
              <input
                aria-label="最少规则组数"
                type="number"
                min={2}
                max={10}
                value={thresholds.minimumAIRuleGroups}
                onChange={(event) => setThresholds((current) => ({ ...current, minimumAIRuleGroups: Number(event.target.value) }))}
              />
            </label>
          </section>

          <section className="rule-features-card">
            <h3>内置统计特征</h3>
            <ul>
              {Object.entries(features).map(([name, feature]) => (
                <li key={name}>
                  <strong>{name}</strong>
                  <span className="rule-weight">×{feature.weight}</span>
                  {feature.note ? <small>{feature.note}</small> : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="rule-preview-card">
            <h3>命中预览</h3>
            <label className="sr-only" htmlFor="rule-preview-text">预览文本</label>
            <textarea
              id="rule-preview-text"
              aria-label="预览文本"
              value={previewText}
              onChange={(event) => setPreviewText(event.target.value)}
              placeholder="粘贴一段文字，查看当前规则会命中哪些特征"
            />
            <button className="secondary-button" type="button" onClick={runPreview}>预览检测</button>
            {preview ? (
              <div className="preview-result">
                <p><strong>结果：{preview.label}</strong></p>
                {preview.hits.length > 0 ? (
                  <ul>{preview.hits.map((hit) => <li key={hit}>{hit}</li>)}</ul>
                ) : (
                  <p className="preview-empty">未命中任何规则。</p>
                )}
                {preview.features.length > 0 ? (
                  <ul className="preview-features">
                    {preview.features.map((feature) => <li key={feature}>统计特征：{feature}</li>)}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  )
}
