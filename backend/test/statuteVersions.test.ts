import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getLatestStatuteVersions } from '../src/util/parse.js'
import { extractTextFromAkomaNtoso, extractTextFromFinlexHtml, diffTexts, splitVersionLabels } from '../src/util/statuteCompare.js'

const B = 'https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act/statute-consolidated'

test('latest version is picked for statute numbers with a hyphen', () => {
  const latest = getLatestStatuteVersions([
    `${B}/1889/39-001/fin@20250845`,
    `${B}/1889/39-001/fin@20261163`,
    `${B}/1889/39-001/fin@20260415`,
  ])
  assert.deepEqual(latest, [`${B}/1889/39-001/fin@20261163`])
})

test('version numbers are compared numerically', () => {
  const latest = getLatestStatuteVersions([
    `${B}/2024/5/swe@2024541`,
    `${B}/2024/5/swe@20241040`,
    `${B}/2003/434/fin@20250541`,
    `${B}/2003/434/fin@20190432`,
  ])
  assert.deepEqual(latest.sort(), [`${B}/2003/434/fin@20250541`, `${B}/2024/5/swe@20241040`])
})

test('versionless uri is kept as is', () => {
  assert.deepEqual(getLatestStatuteVersions([`${B}/2003/82/fin@`]), [`${B}/2003/82/fin@`])
})

// Builds a page like www.finlex.fi: the statute is in the Next.js RSC payload
const rscPage = (payload: string) =>
  `<html><body><script>self.__next_f.push([1,${JSON.stringify(payload)}])</script></body></html>`

test('finlex text extraction reads RSC text rows', () => {
  const long = 'Pitkä kappale, jossa on ääkkösiä.'
  const payload =
    `1:["$","section",null,{"lang":"fi","className":"x__akomaNtoso","children":["$L2"]}]\n`
    + `2:["$","p",null,{"children":["1 §","$3"]}]\n`
    + `3:T${Buffer.byteLength(long, 'utf8').toString(16)},${long}`
    + `4:["$","p",null,{"className":"x__contentAbsent","children":"Tästä säädöksestä on saatavilla vain perustiedot"}]\n`
  assert.equal(extractTextFromFinlexHtml(rscPage(payload), 'fi'), `1 §${long}`)
  assert.equal(extractTextFromFinlexHtml(rscPage(payload), 'sv'), null)
})

test('akomantoso text extraction skips metadata and renders version labels', () => {
  const xml = `<akomaNtoso xmlns:finlex="http://data.finlex.fi/schema/finlex"><act>
    <meta><identification>META</identification></meta>
    <preface><p>OTSIKKO</p></preface>
    <body><section finlex:originalVersionLabel="5.7.2019/809"><num>3 a §</num><heading>Otsikko</heading>
      <subsection><content><p>Teksti.</p></content></subsection></section></body></act></akomaNtoso>`
  const text = extractTextFromAkomaNtoso(xml)
  assert.ok(!text.includes('META') && !text.includes('OTSIKKO'))
  assert.match(text, /3 a §/)
  assert.match(text, /\(5\.7\.2019\/809\)/)
})

test('diff ignores spacing around punctuation and reports changed words', () => {
  assert.deepEqual(diffTexts('kirkkolaissa (1054/1993).', 'kirkkolaissa ( 1054/1993 ) .'), [])
  const hunks = diffTexts('enintään 130 euroa vuodessa', 'enintään 200 euroa vuodessa')
  assert.equal(hunks.length, 1)
  assert.equal(hunks[0].tenttilex, '130')
  assert.equal(hunks[0].finlex, '200')
})

test('version label already in the heading text is not repeated', () => {
  const xml = `<akomaNtoso xmlns:finlex="http://data.finlex.fi/schema/finlex"><act><body>
    <section><num>112 §</num><heading finlex:originalVersionLabel="9.7.2026/733">Otsikko <ref>(9.7.2026/733)</ref></heading>
      <subsection><content><p>Teksti.</p></content></subsection></section></body></act></akomaNtoso>`
  assert.equal(extractTextFromAkomaNtoso(xml).match(/9\.7\.2026\/733/g)?.length, 1)
})

test('section and its separately amended heading both show their labels', () => {
  const xml = `<akomaNtoso xmlns:finlex="http://data.finlex.fi/schema/finlex"><act><body>
    <section finlex:originalVersionLabel="4.5.2018/301"><num>1 §</num>
      <heading finlex:originalVersionLabel="29.3.2019/371">Otsikko <ref>(29.3.2019/371)</ref></heading>
      <subsection><content><p>Teksti.</p></content></subsection></section></body></act></akomaNtoso>`
  const text = extractTextFromAkomaNtoso(xml)
  assert.equal(text.match(/29\.3\.2019\/371/g)?.length, 1)
  assert.equal(text.match(/4\.5\.2018\/301/g)?.length, 1)
})

test('label printed twice in a row on finlex.fi is counted once', () => {
  assert.deepEqual(splitVersionLabels('Liite (1.3.2018/164) (1.3.2018/164) Teksti', true).labels, ['(1.3.2018/164)'])
  assert.deepEqual(splitVersionLabels('Liite (1.3.2018/164) (1.3.2018/164) Teksti').labels.length, 2)
})
