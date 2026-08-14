import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from 'docx'
import type { DetectionReport } from '@/lib/domain/report'
import type { SegmentLabel } from '@/lib/domain/segments'
import { modeLabel } from './render-html'

const colors: Record<SegmentLabel, string> = {
  ai: 'DC624B',
  human: '2D7B78',
  uncertain: 'B48022',
}

const labels: Record<SegmentLabel, string> = {
  ai: 'AI 倾向',
  human: '人工倾向',
  uncertain: '不确定',
}

export async function renderDocxReport(report: DetectionReport): Promise<Buffer> {
  const document = new Document({
    sections: [{
      children: [
        new Paragraph({ text: '中文论文 AIGC 检测报告', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: report.sourceName, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: `${modeLabel(report.mode)} · 有效字符 ${report.summary.scoredCharacters}` }),
        new Table({
          rows: [
            new TableRow({ children: [cell('AI 倾向'), cell(`${report.summary.aiRate}%`)] }),
            new TableRow({ children: [cell('人工倾向'), cell(`${report.summary.humanRate}%`)] }),
            new TableRow({ children: [cell('不确定'), cell(`${report.summary.uncertainRate}%`)] }),
          ],
        }),
        new Paragraph({ text: '检测说明', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: '三项比例按有效检测文本的片段覆盖比例统计，结果是语言线索，不是作者身份的绝对证明。' }),
        ...report.warnings.map((warning) => new Paragraph({ text: `解析提示：${warning}` })),
        new Paragraph({ text: '原文标注', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ children: renderAnnotatedRuns(report) }),
        ...report.segments.filter((segment) => segment.scored !== false).flatMap((segment) => [
          new Paragraph({
            children: [
              new TextRun({ text: `[${labels[segment.label]} ${Math.round(segment.confidence * 100)}%] `, bold: true, color: colors[segment.label] }),
              new TextRun({ text: segment.text }),
            ],
          }),
          new Paragraph({ text: `语言特征：${segment.reasons.join('；')}` }),
          new Paragraph({ text: `修改方向：${segment.suggestions.join('；')}` }),
        ]),
      ],
    }],
  })

  return Packer.toBuffer(document)
}

function cell(text: string): TableCell {
  return new TableCell({ children: [new Paragraph({ text })] })
}

function renderAnnotatedRuns(report: DetectionReport): TextRun[] {
  let cursor = 0
  const runs: TextRun[] = []

  for (const segment of [...report.segments].sort((left, right) => left.start - right.start)) {
    if (segment.start > cursor) {
      runs.push(new TextRun({ text: report.text.slice(cursor, segment.start) }))
    }
    if (segment.scored === false) {
      runs.push(new TextRun({ text: report.text.slice(segment.start, segment.end) }))
      cursor = segment.end
      continue
    }
    runs.push(new TextRun({
      text: report.text.slice(segment.start, segment.end),
      bold: true,
      color: colors[segment.label],
    }))
    cursor = segment.end
  }

  if (cursor < report.text.length) {
    runs.push(new TextRun({ text: report.text.slice(cursor) }))
  }

  return runs.length > 0 ? runs : [new TextRun({ text: report.text })]
}
