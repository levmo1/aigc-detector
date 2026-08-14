import { apiUrl } from '@/frontend/api'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RuleGroup, RulePattern } from '@/lib/rules/engine'
import { createRuleEngine, validateRegexPattern } from '@/lib/rules/engine'
import { builtinFeatures } from '@/lib/rules/features'

interface RuleLibraryResponse {
  groups: RuleGroup[]
  thresholds?: { segmentAIScore: number; segmentUncertainScore: number }
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
  const [thresholds, setThresholds] = useState({ segmentAIScore: 3, segmentUncertainScore: 1 })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [newRule, setNewRule] = useState({ groupId: '', pattern: '', weight: 2, note: '' })
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        if (body.thresholds) setThresholds(body.thresholds)
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
        note: newRule.note.trim() || undefined,
      }
      return { ...group, rules: [...group.rules, rule] }
    }))
    setNewRule((current) => ({ ...current, pattern: '', note: '' }))
  }

  const removeRule = (groupId: string, ruleIndex: number) => {
    setGroups((current) => current.map((group) => (
      group.id === groupId
        ? { ...group, rules: group.rules.filter((_, index) => index !== ruleIndex) }
        : group
    )))
  }

  const saveRules = async () => {
    setSaved(false)
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/rules'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ groups }),
      })
      const body = await response.json() as RuleLibraryResponse
      if (!response.ok) throw new Error(body.error?.message ?? '保存失败，请检查规则格式。')
      setGroups(body.groups)
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), 2000)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败。')
    }
  }

  const resetRules = async () => {
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/rules'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ groups: [] }),
      })
      const body = await response.json() as RuleLibraryResponse
      if (!response.ok) throw new Error(body.error?.message ?? '重置失败。')
      setGroups(body.groups)
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), 2000)
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : '重置失败。')
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
    const label = engine.classify(evaluation.score)
    setPreview({
      label: label === 'ai' ? 'AI 倾向' : label === 'human' ? '人工倾向' : '不确定',
      hits: evaluation.hits.map((hit) => `${hit.groupName}：${hit.rule.pattern}`),
      features: Object.entries(evaluation.featureScores)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => `${name}（${value}）`),
    })
  }

  return (
    <div className="rules-manager">
      <div className="rules-toolbar">
        <div>
          <p className="eyebrow">RULE LIBRARY</p>
          <h2>检测规则</h2>
          <p>词条与正则按组计分，命中多项时叠加权重；统计特征由引擎内置。</p>
        </div>
        <div className="rules-actions">
          <button className="secondary-button" type="button" onClick={resetRules}>恢复默认</button>
          <button className="primary-button" type="button" onClick={saveRules}>
            {saved ? '已保存 ✓' : '保存规则'}
          </button>
        </div>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="rules-layout">
        <div className="rules-groups">
          {groups.map((group) => (
            <section className="rule-group-card" key={group.id}>
              <header>
                <h3>{group.name}</h3>
                <span className="rule-group-id">{group.id} · 组权重 {group.weight}</span>
              </header>
              <ul>
                {group.rules.map((rule, ruleIndex) => (
                  <li key={`${group.id}-${ruleIndex}`}>
                    <code>{rule.pattern}</code>
                    <span className="rule-weight">×{rule.weight}</span>
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
                <button className="secondary-button" type="button" onClick={addRule}>添加规则</button>
              </div>
            </section>
          ))}
        </div>

        <aside className="rules-side">
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
