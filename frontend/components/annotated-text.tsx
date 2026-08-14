
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { DetectedSegment, SegmentLabel } from '@/lib/domain/segments'

interface AnnotatedTextProps {
  text: string
  segments: DetectedSegment[]
  selectedId: string | null
  onSelect: (segment: DetectedSegment) => void
}

const filters: Array<{ key: 'all' | SegmentLabel; label: string }> = [
  { key: 'all', label: '全部片段' },
  { key: 'ai', label: 'AI 倾向' },
  { key: 'human', label: '人工倾向' },
  { key: 'uncertain', label: '不确定' },
]

const labels: Record<SegmentLabel, string> = {
  ai: 'AI 倾向',
  human: '人工倾向',
  uncertain: '不确定',
}

export function AnnotatedText({ text, segments, selectedId, onSelect }: AnnotatedTextProps) {
  const [filter, setFilter] = useState<'all' | SegmentLabel>('all')
  const scoredSegments = segments.filter((segment) => segment.scored !== false)
  const visibleSegments = filter === 'all' ? scoredSegments : scoredSegments.filter((segment) => segment.label === filter)

  return (
    <section className="annotated-section" aria-label="原文标注">
      <div className="annotated-heading">
        <div>
          <p className="eyebrow">TEXT MARKUP</p>
          <h2>原文里的观察</h2>
        </div>
        <div className="markup-legend" aria-label="颜色图例">
          <span><i className="legend-dot legend-ai" />AI</span>
          <span><i className="legend-dot legend-human" />人工</span>
          <span><i className="legend-dot legend-uncertain" />不确定</span>
        </div>
      </div>
      <div className="filter-row" role="tablist" aria-label="筛选标注片段">
        {filters.map((item) => (
          <button
            className={filter === item.key ? 'filter-button is-active' : 'filter-button'}
            key={item.key}
            role="tab"
            aria-selected={filter === item.key}
            type="button"
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="annotated-paper animate-fade-in" key={filter}>
        {visibleSegments.length === 0 && segments.length > 0 ? (
          <p className="empty-markup">这个筛选下没有可展示的片段。</p>
        ) : visibleSegments.length === 0 ? (
          <p className="source-only-text">{text}</p>
        ) : filter === 'all' ? (
          <p>{renderFullText(text, segments, selectedId, onSelect)}</p>
        ) : (
          renderFilteredText(text, visibleSegments, selectedId, onSelect)
        )}
      </div>
    </section>
  )
}

function renderFullText(
  text: string,
  segments: DetectedSegment[],
  selectedId: string | null,
  onSelect: (segment: DetectedSegment) => void,
) {
  let cursor = 0

  return segments.flatMap((segment) => {
    const gap = text.slice(cursor, segment.start)
    cursor = segment.end
    if (segment.scored === false) {
      return <span className="unmarked-text" key={segment.id}>{gap}{segment.text}</span>
    }
    return [
      gap ? <span className="unmarked-text" key={`${segment.id}-gap`}>{gap}</span> : null,
      <SegmentButton key={segment.id} segment={segment} selectedId={selectedId} onSelect={onSelect} />,
    ]
  }).concat(text.slice(cursor) ? [<span className="unmarked-text" key="tail">{text.slice(cursor)}</span>] : [])
}

function renderFilteredText(
  text: string,
  segments: DetectedSegment[],
  selectedId: string | null,
  onSelect: (segment: DetectedSegment) => void,
) {
  let cursor = 0
  const paragraphs = segments.reduce<Map<number, DetectedSegment[]>>((groups, segment) => {
    const current = groups.get(segment.paragraphIndex) ?? []
    current.push(segment)
    groups.set(segment.paragraphIndex, current)
    return groups
  }, new Map())

  const renderedParagraphs: ReactNode[] = []

  for (const [paragraphIndex, paragraphSegments] of paragraphs.entries()) {
    const content: ReactNode[] = []

    paragraphSegments.forEach((segment, index) => {
      content.push(
        <span key={`${segment.id}-wrapper`}>
          {text.slice(cursor, segment.start).trim()
            ? <span className="filtered-gap" aria-hidden="true">…</span>
            : index > 0 ? ' ' : null}
          <SegmentButton segment={segment} selectedId={selectedId} onSelect={onSelect} />
        </span>,
      )
      cursor = segment.end
    })

    renderedParagraphs.push(<p key={paragraphIndex}>{content}</p>)
  }

  if (text.slice(cursor).trim()) {
    renderedParagraphs.push(<p className="filtered-tail" aria-hidden="true" key="filtered-tail">…</p>)
  }

  return renderedParagraphs
}

function SegmentButton({
  segment,
  selectedId,
  onSelect,
}: {
  segment: DetectedSegment
  selectedId: string | null
  onSelect: (segment: DetectedSegment) => void
}) {
  return (
    <button
      className={`text-mark text-mark-${segment.label}${selectedId === segment.id ? ' is-selected' : ''}`}
      type="button"
      aria-label={`${labels[segment.label]}：${segment.text}`}
      data-tip={`${labels[segment.label]} · 置信度 ${Math.round(segment.confidence * 100)}%`}
      onClick={() => onSelect(segment)}
    >
      {segment.text}
    </button>
  )
}
