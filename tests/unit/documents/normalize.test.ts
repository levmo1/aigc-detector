import { describe, expect, it } from 'vitest'
import { isNonScoredParagraph, isNonScoredSegment, normalizeText, splitIntoSegments } from '@/lib/documents/normalize'

describe('normalizeText', () => {
  it('normalizes line endings, surrounding spaces, and blank lines', () => {
    expect(normalizeText('  第一段。 \r\n\r\n\r\n 第二段。  ')).toBe('第一段。\n\n第二段。')
  })
})

describe('splitIntoSegments', () => {
  it('splits sentences while preserving paragraph indexes and source offsets', () => {
    const text = '第一段第一句。第二句！\n\n第二段？'
    const segments = splitIntoSegments(text)

    expect(segments.map((segment) => segment.text)).toEqual(['第一段第一句。', '第二句！', '第二段？'])
    expect(segments.map((segment) => segment.paragraphIndex)).toEqual([0, 0, 1])
    expect(segments.every((segment) => text.slice(segment.start, segment.end) === segment.text)).toBe(true)
    expect(segments.every((segment) => segment.scored === true)).toBe(true)
  })

  it('marks table-of-contents lines and reference entries as unscored', () => {
    const text = '目 录\n一、引言 ..... 3\n\n[1] A. Esteva et al., "Deep neural networks," Nature, vol. 542, pp. 115-118, 2017.\n\n正文第一句。第二句。'
    const segments = splitIntoSegments(text)

    const unscored = segments.filter((segment) => segment.scored === false)
    expect(unscored.length).toBe(3)
    expect(unscored[0].text).toContain('目 录')
    expect(unscored[1].text).toContain('引言')
    expect(unscored[2].text).toContain('[1] A. Esteva')
    expect(segments.find((segment) => segment.text.includes('正文第一句'))?.scored).toBe(true)
  })

  it('marks short headings as unscored', () => {
    const text = '一、引言\n\n这是正文段落，包含完整的句子结构。'
    const segments = splitIntoSegments(text)

    expect(segments.find((segment) => segment.text === '一、引言')?.scored).toBe(false)
    expect(segments.find((segment) => segment.text.includes('这是正文段落'))?.scored).toBe(true)
  })

  it('splits structural lines glued to body paragraphs within a page', () => {
    const text = '一、引言\n人工智能与医疗的结合，被很多人视为现代医学最具想象力的方向。\n\n参考文献\n[1] A. Esteva et al., "Skin cancer," Nature, vol. 542, 2017.\n\n正文段落包含完整句子。'
    const segments = splitIntoSegments(text)

    const heading = segments.find((segment) => segment.text.trim() === '一、引言')
    const referenceTitle = segments.find((segment) => segment.text.trim() === '参考文献')
    const referenceEntry = segments.find((segment) => segment.text.startsWith('[1]'))
    const body = segments.find((segment) => segment.text.includes('人工智能与医疗的结合'))

    expect(heading?.scored).toBe(false)
    expect(referenceTitle?.scored).toBe(false)
    expect(referenceEntry?.scored).toBe(false)
    expect(body?.scored).toBe(true)
  })

  it('marks multi-line reference entries as unscored within a mixed page', () => {
    const text = '正文段落包含完整句子。\n参考文献\n[1] A. Esteva et al., "Skin cancer," Nature, vol. 542, no. 7639, pp. 115-118, Feb. 2017.\n[2] B. Author et al., "Other work," JAMA, vol. 1, pp. 1-2, 2020.\n\n新段落包含完整句子。'
    const segments = splitIntoSegments(text)

    const body = segments.find((segment) => segment.text.includes('正文段落'))
    const firstContinuation = segments.find((segment) => segment.text.includes('Feb. 2017'))
    const secondEntry = segments.find((segment) => segment.text.startsWith('[2]'))
    const newParagraph = segments.find((segment) => segment.text.includes('新段落'))

    expect(body?.scored).toBe(true)
    expect(firstContinuation?.scored).toBe(false)
    expect(secondEntry?.scored).toBe(false)
    expect(newParagraph?.scored).toBe(true)
  })
})

describe('isNonScoredParagraph', () => {
  it('flags dotted table-of-contents lines', () => {
    expect(isNonScoredParagraph('三、应用现状 ..... 3')).toBe(true)
  })

  it('flags reference entries', () => {
    expect(isNonScoredParagraph('[1] A. Esteva et al., "Skin cancer," Nature, vol. 542, 2017.')).toBe(true)
  })

  it('flags latin-heavy citation text', () => {
    expect(isNonScoredParagraph('Deep Medicine: How AI Can Make Healthcare Human Again. Basic Books, 2019.')).toBe(true)
  })

  it('keeps normal paragraphs scored', () => {
    expect(isNonScoredParagraph('人工智能与医疗的结合，被很多人视为现代医学最具想象力的方向。')).toBe(false)
  })
})

describe('isNonScoredSegment', () => {
  it('flags short unpunctuated headings', () => {
    expect(isNonScoredSegment('二、发展历程：从专家系统到深度学习')).toBe(true)
    expect(isNonScoredSegment('（一）医学影像诊断')).toBe(true)
  })

  it('keeps normal sentences scored', () => {
    expect(isNonScoredSegment('医学影像诊断是进展最快的方向。')).toBe(false)
  })
})

describe('splitIntoSegments line-wrapped body text', () => {
  it('does not mark short line-wrapped body lines as unscored', () => {
    const text = '本文提出一种新的检测方法\n该方法基于规则引擎。\n实验表明，该方法在中文论文上\n表现良好，误报率较低。'
    const segments = splitIntoSegments(text)

    const unscored = segments.filter((segment) => segment.scored === false)
    expect(unscored).toEqual([])
    expect(segments.every((segment) => segment.scored === true)).toBe(true)
  })

  it('still marks numbered headings as unscored', () => {
    const text = '一、引言\n人工智能与医疗的结合，被很多人视为现代医学最具想象力的方向。'
    const segments = splitIntoSegments(text)

    expect(segments.find((segment) => segment.text.trim() === '一、引言')?.scored).toBe(false)
    expect(segments.find((segment) => segment.text.includes('人工智能与医疗的结合'))?.scored).toBe(true)
  })
})
