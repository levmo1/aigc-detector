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
        <p>点击左侧任意标注片段，这里会显示它的特征强度、语言特征和可执行的修改方向。</p>
      </aside>
    )
  }

  return (
    <aside className="feature-panel animate-fade-in" aria-label="片段详情" key={segment.id}>
      <span className="panel-index">DETAIL / {segment.id.toUpperCase()}</span>
      <h2>片段观察</h2>
      <div className={`panel-label panel-label-${segment.label}`}>{labelFor(segment.label)}</div>
      <div className="confidence-line">
        <span>片段特征强度</span>
        <strong>{Math.round(segment.confidence * 100)}%</strong>
      </div>
      <p className="feature-note">特征强度表示当前线索的相对强弱，不是准确率或作者身份概率。</p>
      <div className="feature-group">
        <h3>疑似语言特征</h3>
        <ul>
          {segment.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </div>
      {segment.llmLabel ? (
        <div className="feature-group review-group">
          <h3>单模型二次复核</h3>
          <p className="review-result-line">
            模型倾向：{labelFor(segment.llmLabel)}{typeof segment.llmConfidence === 'number' ? ` · ${Math.round(segment.llmConfidence * 100)}%` : ''}
          </p>
          {segment.llmReasons?.length ? (
            <ul>
              {segment.llmReasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
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
