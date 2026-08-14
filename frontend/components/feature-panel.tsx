import type { DetectedSegment } from '@/lib/domain/segments'

interface FeaturePanelProps {
  segment: DetectedSegment | null
}

export function FeaturePanel({ segment }: FeaturePanelProps) {
  if (!segment) {
    return (
      <aside className="feature-panel feature-panel-empty animate-fade-in" aria-label="片段详情">
        <span className="panel-index">DETAIL / 00</span>
        <h2>选中一句文字</h2>
        <p>点击左侧任意标注片段，这里会显示它的置信度、语言特征和可执行的修改方向。</p>
      </aside>
    )
  }

  return (
    <aside className="feature-panel animate-fade-in" aria-label="片段详情" key={segment.id}>
      <span className="panel-index">DETAIL / {segment.id.toUpperCase()}</span>
      <h2>片段观察</h2>
      <div className={`panel-label panel-label-${segment.label}`}>{labelFor(segment.label)}</div>
      <div className="confidence-line">
        <span>片段置信度</span>
        <strong>{Math.round(segment.confidence * 100)}%</strong>
      </div>
      <div className="feature-group">
        <h3>疑似语言特征</h3>
        <ul>
          {segment.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </div>
      <div className="feature-group suggestion-group">
        <h3>修改方向</h3>
        <ul>
          {segment.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
        </ul>
      </div>
    </aside>
  )
}

function labelFor(label: DetectedSegment['label']): string {
  return label === 'ai' ? 'AI 倾向' : label === 'human' ? '人工倾向' : '不确定'
}
