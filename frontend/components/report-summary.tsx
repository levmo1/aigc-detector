import type { DetectionSummary } from '@/lib/domain/report'
import type { DetectorMode } from '@/lib/detection/types'
import { RateValue } from './rate-value'

interface ReportSummaryProps {
  summary: DetectionSummary
  mode: DetectorMode
}

const modeLabels: Record<DetectorMode, string> = {
  mock: 'Mock 演示模式',
  rule: '本地规则检测',
  external: '外部检测服务',
}

const rateCards = [
  { key: 'aiRate', label: 'AI 倾向', color: 'vermilion' },
  { key: 'humanRate', label: '人工倾向', color: 'teal' },
  { key: 'uncertainRate', label: '不确定', color: 'mustard' },
] as const

export function ReportSummary({ summary, mode }: ReportSummaryProps) {
  const hasScoredContent = summary.scoredCharacters > 0

  return (
    <section className="report-summary" aria-label="检测结果摘要">
      <div className="report-summary-heading">
        <div>
          <p className="eyebrow">READING RESULT</p>
          <h2>这篇文字的组成</h2>
        </div>
        <span className="demo-badge">{modeLabels[mode]}</span>
      </div>
      {hasScoredContent ? (
        <>
          <div className="rate-grid">
            {rateCards.map((card, index) => (
              <div className={`rate-card rate-card-${card.color} animate-mark-pop stagger-${Math.min(index + 1, 4)}`} key={card.key}>
                <span>{card.label}</span>
                <RateValue value={summary[card.key]} />
                <i aria-hidden="true" />
              </div>
            ))}
          </div>
          <p className="summary-note">
            按有效检测文本的片段覆盖比例统计，共 {summary.scoredCharacters.toLocaleString('zh-CN')} 个有效字符。
            结果是语言线索，不是作者身份的绝对证明。
          </p>
        </>
      ) : (
        <p className="summary-empty" role="note">
          没有可参与评分的正文内容：文档可能只包含标题、目录或参考文献。请确认上传的文档包含正文段落。
        </p>
      )}
    </section>
  )
}
