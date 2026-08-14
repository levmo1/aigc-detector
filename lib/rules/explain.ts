import type { SegmentEvaluation } from './engine'

const groupReasons: Record<string, (phrases: string[]) => string> = {
  'summary-catchphrase': (phrases) => `用「${phrases[0]}」这类话收尾，是 AI 写总结时最常见的套路，人通常直接说结论`,
  fillers: (phrases) => `出现「${phrases[0]}」这类冗余引导语，AI 习惯用它们凑过渡，真人很少这么写`,
  connectors: (phrases) => `「${phrases[0]}」等连接词用得太密，读起来像模板拼接`,
  'vague-attribution': (phrases) => `用「${phrases[0]}」下结论却没有给出具体来源，AI 经常这样含糊归因`,
  'theory-framing': (phrases) => `用「${phrases[0]}」这样的理论框架开头，是 AI 起笔的典型句式`,
  'positive-conclusion': (phrases) => `「${phrases[0]}」这类空泛评价没有具体内容，AI 爱用它们凑意义`,
  'ai-words': (phrases) => `使用了「${phrases[0]}」等 AI 高频词，这类词在真人写作里出现频率低`,
  'copula-stacking': (phrases) => `「${phrases[0]}」这种名词化套话是 AI 的招牌表达`,
  'case-proof': (phrases) => `「${phrases[0]}」是 AI 总结案例时套用的固定句式`,
  enumeration: (phrases) => `用「${phrases[0]}」这样的编号结构逐条罗列，机械感强`,
  'parallel-structure': (phrases) => `句子排比过于整齐（${phrases[0]}），真人写作不会这么工整`,
  punctuation: (phrases) => `破折号「${phrases[0]}」使用频繁，AI 爱用它代替自然停顿`,
  'significance-puffery': (phrases) => `「${phrases[0]}」这类过度拔高重要性的说法，AI 写作里非常常见`,
  'negative-parallel': (phrases) => `「${phrases[0]}」这样的对仗句式用得多，显得模式化`,
  'superficial-analysis': (phrases) => `句子末尾附加「${phrases[0]}」式的空泛评价，AI 的常见收尾`,
  'attribution-emphasis': (phrases) => `强调「${phrases[0]}」之类的媒体覆盖，AI 常用它证明重要性`,
}

const featureReasons: Record<string, string> = {
  sentenceLengthVariance: '这一段句子长短几乎一样，过于工整，真人写作的句子长短会有明显起伏',
  nGramRepeat: '出现了重复的用词模式，AI 容易反复使用同样的措辞',
  transitionDensity: '转折和连接词密度过高，读起来像模板拼接',
  punctuationDensity: '破折号、冒号用得太密，AI 习惯用标点替代自然的句子停顿',
  lexicalDiversity: '用词范围偏窄，重复表达多，真人写作的用词会更丰富',
  ruleOfThree: '连续三句结构几乎相同（三连排比），AI 特别爱用这种整齐结构',
}

const groupSuggestions: Record<string, string> = {
  'summary-catchphrase': '删掉总结套话，直接写清楚结论是什么、为什么，例如把「综上所述」换成具体判断',
  fillers: '删除「值得注意的是」等填充短语，让句子直接开始说内容',
  connectors: '减少连接词，能用逗号或短句说清的就不用「然而」「与此同时」',
  'vague-attribution': '给「专家认为」「研究表明」补上具体出处；说不出处就删掉这句',
  'theory-framing': '不要用理论框架开头，先写你观察到的具体现象，再决定是否引入理论',
  'positive-conclusion': '删掉空泛的意义评价，换成这篇论文里具体的发现或数据',
  'ai-words': '把 AI 高频词换成更具体的动词，例如「深刻揭示了」改为「说明」「表明」',
  'copula-stacking': '把「作为……的重要载体」这类名词化套话改写成正常句子，例如「语言承载着……」「X 是……」',
  'case-proof': '不要套「此案例印证了」，直接描述案例里发生了什么、说明了什么',
  enumeration: '打破「首先/其次/再次」的编号结构，把最重要的一点先说透，其余自然带出',
  'parallel-structure': '打破整齐的排比，让每句话的长短和结构都不一样，重要的内容多写几句',
  punctuation: '减少破折号，把插入语改写成独立句子',
  'significance-puffery': '删掉「里程碑」「奠定基础」这类拔高说法，用具体成果说话',
  'negative-parallel': '减少「不仅是……更是」式的对仗，直接陈述事实',
  'superficial-analysis': '删掉句子末尾空泛的「彰显了」「体现了」，或补充具体证据',
  'attribution-emphasis': '删掉对媒体覆盖的强调，直接写内容本身',
}

export function explainHits(evaluation: SegmentEvaluation): string[] {
  const reasons: string[] = []
  const seen = new Set<string>()

  for (const hit of evaluation.hits) {
    if (seen.has(hit.groupId)) continue
    seen.add(hit.groupId)

    const explainer = groupReasons[hit.groupId]
    if (explainer) {
      reasons.push(explainer(hit.matches.slice(0, 3)))
    } else {
      reasons.push(`命中了自定义规则「${hit.groupName}」（${hit.rule.pattern}），这类表达在人工写作中相对少见`)
    }
  }

  for (const [name, value] of Object.entries(evaluation.featureScores)) {
    if (value > 0 && featureReasons[name]) reasons.push(featureReasons[name])
  }

  return reasons
}

export function explainNoHits(): string {
  return '未发现明显的 AI 写作特征（没有高频套话、排比或模板句式），更可能是人工写作'
}

export function buildSuggestions(evaluation: SegmentEvaluation): string[] {
  const suggestions = new Set<string>()
  const seen = new Set<string>()

  for (const hit of evaluation.hits) {
    const suggestion = groupSuggestions[hit.groupId]
    if (suggestion && !seen.has(hit.groupId)) {
      suggestions.add(suggestion)
      seen.add(hit.groupId)
    }
  }

  if (suggestions.size === 0) {
    suggestions.add('如果这是初稿，建议通读一遍，检查是否依赖了模板化表达；可以补充自己的观察和具体数据')
  }

  if (suggestions.size === 1 && evaluation.hits.length > 0) {
    suggestions.add('重写时注意打破句子结构的整齐感：长短句交替，重要的内容多写几句，次要的一笔带过')
  }

  return [...suggestions].slice(0, 3)
}
