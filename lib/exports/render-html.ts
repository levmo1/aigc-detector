import type { DetectionReport } from '@/lib/domain/report'
import type { SegmentLabel } from '@/lib/domain/segments'

const colors: Record<SegmentLabel, string> = {
  ai: '#dc624b',
  human: '#2d7b78',
  uncertain: '#dba94f',
}

const labels: Record<SegmentLabel, string> = {
  ai: 'AI 倾向',
  human: '人工倾向',
  uncertain: '不确定',
}

export function renderHtmlReport(report: DetectionReport): string {
  const segments = renderAnnotatedText(report)
  const warnings = report.warnings.length > 0
    ? `<div class="warnings"><strong>解析提示</strong><span>${escapeHtml(report.warnings.join(' '))}</span></div>`
    : ''
  const reviewNote = report.llmReviewStatus && report.llmReviewStatus !== 'disabled'
    ? `<p class="note">单模型复核覆盖 ${report.llmReviewedSegments ?? 0}/${report.llmRequestedSegments ?? 0} 个片段；复核结果仅作为第二意见。</p>`
    : ''
  const insights = report.segments.filter((segment) => segment.scored !== false).map((segment) => `
    <article class="insight insight-${segment.label}">
      <strong>${escapeHtml(labels[segment.label])} · 特征强度 ${Math.round(segment.confidence * 100)}%</strong>
      <p>片段：${escapeHtml(segment.text)}</p>
      <p>语言特征：${escapeHtml(segment.reasons.join('；'))}</p>
      <p>修改方向：${escapeHtml(segment.suggestions.join('；'))}</p>
    </article>
  `).join('')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(report.sourceName)} - 检测报告</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 20mm; }
    :root { color: #17232a; background: #f4f1e9; font-family: "Noto Sans CJK SC", "Microsoft YaHei", sans-serif; }
    body { margin: 0; background: #f4f1e9; font-size: 12px; line-height: 1.7; }
    main { max-width: 880px; margin: 0 auto; padding: 28px 30px 50px; background: #fffdf8; }
    header { border-bottom: 1px solid #d8d0c2; padding-bottom: 24px; }
    .eyebrow { color: #dc624b; font-size: 10px; letter-spacing: .18em; }
    h1 { margin: 10px 0 5px; font-family: "Noto Serif CJK SC", "Songti SC", serif; font-size: 32px; line-height: 1.2; }
    .meta, .note { color: #526067; font-size: 11px; }
    .badge { display: inline-block; margin-top: 18px; padding: 5px 8px; color: #815d1e; border: 1px solid #dba94f; background: #fff4d8; }
    .rates { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 24px 0 12px; }
    .rate { padding: 14px; background: #f4f1e9; }
    .rate strong { display: block; margin-top: 5px; font-family: Georgia, serif; font-size: 32px; font-weight: 400; }
    .rate-ai strong { color: #dc624b; } .rate-human strong { color: #2d7b78; } .rate-uncertain strong { color: #b48022; }
    .warnings { display: flex; gap: 10px; margin: 15px 0; padding: 10px; color: #815d1e; border-left: 3px solid #dba94f; background: #fff8e7; }
    .document { margin-top: 24px; padding: 24px; border: 1px solid #d8d0c2; background: #fffdf8; font-family: "Noto Serif CJK SC", "Songti SC", serif; font-size: 15px; line-height: 2; }
    .segment { padding: 1px 2px; border-bottom: 2px solid; }
    .segment-ai { border-color: #dc624b; background: #fff0eb; } .segment-human { border-color: #2d7b78; background: #e8f5f1; } .segment-uncertain { border-color: #dba94f; background: #fff4d8; }
    .insights { margin-top: 24px; } .insight { margin-top: 10px; padding: 12px 14px; border-left: 3px solid #d8d0c2; background: #f4f1e9; } .insight-ai { border-left-color: #dc624b; } .insight-human { border-left-color: #2d7b78; } .insight-uncertain { border-left-color: #dba94f; } .insight p { margin: 5px 0 0; color: #526067; font-size: 11px; }
    .legend { margin-top: 16px; color: #526067; font-size: 10px; }
    .legend span { margin-right: 14px; } .legend i { display: inline-block; width: 7px; height: 7px; margin-right: 4px; border-radius: 50%; background: #dc624b; } .legend .human { background: #2d7b78; } .legend .uncertain { background: #dba94f; }
    footer { margin-top: 30px; padding-top: 12px; color: #526067; border-top: 1px solid #d8d0c2; font-size: 10px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">CHINESE TEXT LAB / READING REPORT</div>
      <h1>${escapeHtml(report.sourceName)}</h1>
      <div class="meta">生成时间：${escapeHtml(report.generatedAt)} · 有效字符：${report.summary.scoredCharacters.toLocaleString('zh-CN')}</div>
      <div class="badge">${escapeHtml(modeLabel(report.mode, report.llmAssisted))}</div>
    </header>
    <section class="rates">
      <div class="rate rate-ai"><span>AI 倾向</span><strong>${report.summary.aiRate}%</strong></div>
      <div class="rate rate-human"><span>人工倾向</span><strong>${report.summary.humanRate}%</strong></div>
      <div class="rate rate-uncertain"><span>不确定</span><strong>${report.summary.uncertainRate}%</strong></div>
    </section>
    <p class="note">三项比例按有效检测文本的片段覆盖比例统计，结果是语言线索，不是作者身份的绝对证明。</p>
    ${reviewNote}
    ${warnings}
    <section class="document">${segments || escapeHtml(report.text)}</section>
    <section class="insights"><h2>片段说明</h2>${insights || '<p class="note">没有可展开的片段说明。</p>'}</section>
    <div class="legend"><span><i></i>AI 倾向</span><span><i class="human"></i>人工倾向</span><span><i class="uncertain"></i>不确定</span></div>
    <footer>文脉校阅台 · 首版检测结果仅用于功能演示</footer>
  </main>
</body>
</html>`
}

function renderAnnotatedText(report: DetectionReport): string {
  let cursor = 0
  let output = ''

  for (const segment of [...report.segments].sort((left, right) => left.start - right.start)) {
    output += escapeHtml(report.text.slice(cursor, segment.start))
    if (segment.scored === false) {
      output += escapeHtml(report.text.slice(segment.start, segment.end))
      cursor = segment.end
      continue
    }
    output += `<span class="segment segment-${segment.label}" title="${escapeHtml(labels[segment.label])} · 特征强度 ${Math.round(segment.confidence * 100)}%">${escapeHtml(report.text.slice(segment.start, segment.end))}</span>`
    cursor = segment.end
  }

  return output + escapeHtml(report.text.slice(cursor))
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#039;')
}

export function modeLabel(mode: DetectionReport['mode'], llmAssisted = false): string {
  if (mode === 'mock') return 'Mock 演示模式'
  if (mode === 'rule') return llmAssisted ? '本地规则检测 + 单模型复核' : '本地规则检测'
  return '外部检测服务'
}
