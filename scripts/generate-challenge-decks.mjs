/**
 * Builds the offline PowerPoint decks shipped in `public/decks`.
 *
 *   node scripts/generate-challenge-decks.mjs
 *
 * The decks are written by hand as Office Open XML inside a minimal ZIP writer so
 * the repository needs no extra dependency. Every slide carries a built-in
 * animated timer: a timer bar shrinks over the slide duration and the slide
 * advances on its own through `advTm`.
 */
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const decksDir = resolve(rootDir, 'public', 'decks')

const THEME = {
  bg: 'FFF4E6',
  surface: 'FFFFFF',
  teal: '027479',
  orange: 'F48220',
  red: 'BE392A',
  creme: 'FFF6CC',
  text: '20292B',
  muted: '52666A',
  border: 'E8D9C9',
}

const SLIDE_WIDTH = 12192000
const SLIDE_HEIGHT = 6858000
const TIMER_DURATION_MS = 30000
const EMOJI_PER_QUESTION = 4

/* ------------------------------------------------------------------ ZIP ---- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (let index = 0; index < buffer.length; index += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[index]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

function writeZip(entries) {
  const chunks = []
  const central = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const raw = Buffer.from(entry.text, 'utf8')
    const compressed = deflateRawSync(raw, { level: 9 })
    const useDeflate = compressed.length < raw.length
    const payload = useDeflate ? compressed : raw
    const method = useDeflate ? 8 : 0

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0x21, 12)
    local.writeUInt32LE(crc32(raw), 14)
    local.writeUInt32LE(payload.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)

    chunks.push(local, name, payload)

    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(20, 6)
    header.writeUInt16LE(0, 8)
    header.writeUInt16LE(method, 10)
    header.writeUInt16LE(0, 12)
    header.writeUInt16LE(0x21, 14)
    header.writeUInt32LE(crc32(raw), 16)
    header.writeUInt32LE(payload.length, 20)
    header.writeUInt32LE(raw.length, 24)
    header.writeUInt16LE(name.length, 28)
    header.writeUInt16LE(0, 30)
    header.writeUInt16LE(0, 32)
    header.writeUInt16LE(0, 34)
    header.writeUInt16LE(0, 36)
    header.writeUInt32LE(0, 38)
    header.writeUInt32LE(offset, 42)
    central.push(header, name)

    offset += local.length + name.length + payload.length
  }

  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...chunks, directory, end])
}

/* ------------------------------------------------------------- OOXML ------ */

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const NAMESPACES = [
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"',
].join(' ')

function textBox({ id, name, x, y, width, height, runs, align = 'ctr', anchor = 'ctr' }) {
  const paragraphs = runs
    .map(
      (run) => `<a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="en-US" sz="${run.size}"${run.bold ? ' b="1"' : ''} dirty="0">` +
        `<a:solidFill><a:srgbClr val="${run.color}"/></a:solidFill>` +
        `<a:latin typeface="${run.font ?? 'Segoe UI'}"/><a:cs typeface="${run.font ?? 'Segoe UI'}"/>` +
        `</a:rPr><a:t>${escapeXml(run.text)}</a:t></a:r></a:p>`
    )
    .join('')

  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchor}"><a:normAutofit/></a:bodyPr>` +
    `<a:lstStyle/>${paragraphs}</p:txBody></p:sp>`
  )
}

function rect({ id, name, x, y, width, height, fill, line }) {
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm>` +
    `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 8000"/></a:avLst></a:prstGeom>` +
    `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` +
    `<a:ln w="12700"><a:solidFill><a:srgbClr val="${line ?? fill}"/></a:solidFill></a:ln>` +
    `</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`
  )
}

function timerBar(id) {
  const width = 10000000
  const height = 220000
  const x = (SLIDE_WIDTH - width) / 2
  const y = SLIDE_HEIGHT - 700000
  return rect({ id, name: 'TimerBar', x, y, width, height, fill: THEME.orange })
}

/**
 * Built-in animated timer: the bar is scaled from full width to nothing across
 * the slide duration, so it visibly drains before the slide advances itself.
 */
function timerAnimation(id) {
  return (
    `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>` +
    `<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
    `<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
    `<p:par><p:cTn id="5" presetID="53" presetClass="emph" presetSubtype="0" fill="hold" nodeType="withEffect">` +
    `<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
    `<p:animScale><p:cBhvr><p:cTn id="6" dur="${TIMER_DURATION_MS}" fill="hold"/>` +
    `<p:tgtEl><p:spTgt spid="${id}"/></p:tgtEl></p:cBhvr>` +
    `<p:from x="100000" y="100000"/><p:to x="0" y="100000"/></p:animScale>` +
    `</p:childTnLst></p:cTn></p:par>` +
    `</p:childTnLst></p:cTn></p:par>` +
    `</p:childTnLst></p:cTn></p:par>` +
    `</p:childTnLst></p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
    `</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`
  )
}

function slideXml(shapes, timing) {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sld ${NAMESPACES}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${THEME.bg}"/></a:solidFill>` +
    `<a:effectLst/></p:bgPr></p:bg><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>` +
    `<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
    shapes.join('') +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
    `<p:transition spd="med" advClick="1" advTm="${TIMER_DURATION_MS}"><p:fade/></p:transition>` +
    timing +
    `</p:sld>`
  )
}

function themeXml() {
  const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Guard The Heart">` +
    `<a:themeElements><a:clrScheme name="Guard The Heart">` +
    `<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>` +
    `<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
    `<a:dk2><a:srgbClr val="${THEME.text}"/></a:dk2>` +
    `<a:lt2><a:srgbClr val="${THEME.bg}"/></a:lt2>` +
    `<a:accent1><a:srgbClr val="${THEME.teal}"/></a:accent1>` +
    `<a:accent2><a:srgbClr val="${THEME.orange}"/></a:accent2>` +
    `<a:accent3><a:srgbClr val="${THEME.red}"/></a:accent3>` +
    `<a:accent4><a:srgbClr val="${THEME.creme}"/></a:accent4>` +
    `<a:accent5><a:srgbClr val="${THEME.muted}"/></a:accent5>` +
    `<a:accent6><a:srgbClr val="${THEME.border}"/></a:accent6>` +
    `<a:hlink><a:srgbClr val="${THEME.teal}"/></a:hlink><a:folHlink><a:srgbClr val="${THEME.muted}"/></a:folHlink>` +
    `</a:clrScheme><a:fontScheme name="Guard The Heart">` +
    `<a:majorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
    `<a:minorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>` +
    `</a:fontScheme><a:fmtScheme name="Guard The Heart">` +
    `<a:fillStyleLst>${fill}${fill}${fill}</a:fillStyleLst>` +
    `<a:lnStyleLst>` +
    `<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>` +
    `<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>` +
    `<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>` +
    `</a:lnStyleLst>` +
    `<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>` +
    `<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>` +
    `<a:bgFillStyleLst>${fill}${fill}${fill}</a:bgFillStyleLst>` +
    `</a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`
  )
}

const EMPTY_TREE =
  `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
  `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>` +
  `</p:grpSpPr></p:spTree>`

function slideMasterXml() {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sldMaster ${NAMESPACES}><p:cSld>${EMPTY_TREE}</p:cSld>` +
    `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" ` +
    `accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
    `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`
  )
}

function slideLayoutXml() {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<p:sldLayout ${NAMESPACES} type="blank" preserve="1"><p:cSld name="Blank">${EMPTY_TREE}</p:cSld>` +
    `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`
  )
}

function relationships(entries) {
  const items = entries
    .map(
      (entry) =>
        `<Relationship Id="${entry.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${entry.type}" Target="${entry.target}"/>`
    )
    .join('')
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items}</Relationships>`
  )
}

function buildPresentation(slides) {
  const slideIds = slides
    .map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`)
    .join('')

  const entries = [
    {
      name: '[Content_Types].xml',
      text:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
        `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>` +
        `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>` +
        `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
        slides
          .map(
            (_, index) =>
              `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
          )
          .join('') +
        `</Types>`,
    },
    {
      name: '_rels/.rels',
      text: relationships([
        {
          id: 'rId1',
          type: 'officeDocument',
          target: 'ppt/presentation.xml',
        },
      ]),
    },
    {
      name: 'ppt/presentation.xml',
      text:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<p:presentation ${NAMESPACES} saveSubsetFonts="1">` +
        `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
        `<p:sldIdLst>${slideIds}</p:sldIdLst>` +
        `<p:sldSz cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}"/><p:notesSz cx="${SLIDE_HEIGHT}" cy="${SLIDE_WIDTH}"/>` +
        `</p:presentation>`,
    },
    {
      name: 'ppt/_rels/presentation.xml.rels',
      text: relationships([
        { id: 'rId1', type: 'slideMaster', target: 'slideMasters/slideMaster1.xml' },
        ...slides.map((_, index) => ({
          id: `rId${index + 2}`,
          type: 'slide',
          target: `slides/slide${index + 1}.xml`,
        })),
        {
          id: `rId${slides.length + 2}`,
          type: 'theme',
          target: 'theme/theme1.xml',
        },
      ]),
    },
    { name: 'ppt/theme/theme1.xml', text: themeXml() },
    { name: 'ppt/slideMasters/slideMaster1.xml', text: slideMasterXml() },
    {
      name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
      text: relationships([
        { id: 'rId1', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' },
        { id: 'rId2', type: 'theme', target: '../theme/theme1.xml' },
      ]),
    },
    { name: 'ppt/slideLayouts/slideLayout1.xml', text: slideLayoutXml() },
    {
      name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      text: relationships([
        { id: 'rId1', type: 'slideMaster', target: '../slideMasters/slideMaster1.xml' },
      ]),
    },
    ...slides.flatMap((slide, index) => [
      {
        name: `ppt/slides/slide${index + 1}.xml`,
        text: slideXml(slide.shapes, timerAnimation(slide.timerId)),
      },
      {
        name: `ppt/slides/_rels/slide${index + 1}.xml.rels`,
        text: relationships([
          { id: 'rId1', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' },
        ]),
      },
    ]),
  ]

  return writeZip(entries)
}

/* -------------------------------------------------------------- decks ---- */

const MARGIN = 640000
const CONTENT_WIDTH = SLIDE_WIDTH - MARGIN * 2

function frame(title, subtitle) {
  const shapes = [
    rect({
      id: 2,
      name: 'Header',
      x: MARGIN,
      y: 300000,
      width: CONTENT_WIDTH,
      height: 900000,
      fill: THEME.teal,
    }),
    textBox({
      id: 3,
      name: 'Title',
      x: MARGIN + 200000,
      y: 380000,
      width: CONTENT_WIDTH - 400000,
      height: 740000,
      runs: [{ text: title, size: 2800, bold: true, color: THEME.bg }],
    }),
  ]
  if (subtitle) {
    shapes.push(
      textBox({
        id: 4,
        name: 'Subtitle',
        x: MARGIN,
        y: 1300000,
        width: CONTENT_WIDTH,
        height: 500000,
        runs: [{ text: subtitle, size: 1600, color: THEME.muted }],
      })
    )
  }
  return shapes
}

function bodyBox(runs, y = 1950000, height = 3400000) {
  return [
    textBox({
      id: 90,
      name: 'Body',
      x: MARGIN,
      y,
      width: CONTENT_WIDTH,
      height,
      runs,
      align: 'ctr',
    }),
  ]
}

function buildSlide(shapes) {
  return { shapes: [...shapes, timerBar(80)], timerId: 80 }
}

function buildEmojiDeck() {
  const data = JSON.parse(readFileSync(resolve(rootDir, 'src/data/emoji-decode.json'), 'utf8'))
  const questions = data.questions
  const slides = []

  slides.push(
    buildSlide(
      frame('Emoji Decode', `${questions.length} questions · ${EMOJI_PER_QUESTION} emoji each · 30 second timer`).concat(
        bodyBox(
          [
            {
              text: `Read all ${EMOJI_PER_QUESTION} emoji together, then decode the answer.`,
              size: 2400,
              bold: true,
              color: THEME.text,
            },
            { text: 'Ten points per decoded answer.', size: 1800, color: THEME.muted },
            { text: 'Presenter: advance slides manually or let the timer run.', size: 1600, color: THEME.muted },
          ],
          2300000,
          2800000
        )
      )
    )
  )

  questions.forEach((question, index) => {
    slides.push(
      buildSlide(
        frame(`Question ${index + 1} of ${questions.length}`, 'Type the decoded word').concat(
          bodyBox(
            [
              {
                text: question.emojis.join('  '),
                size: 12000,
                color: THEME.text,
                font: 'Segoe UI Emoji',
              },
              {
                text: `${EMOJI_PER_QUESTION} emoji · one answer`,
                size: 1400,
                color: THEME.muted,
              },
              { text: question.hint, size: 2000, color: THEME.muted },
              { text: 'Answer: ______________________', size: 1800, color: THEME.teal },
            ],
            1750000,
            3900000
          )
        )
      )
    )
  })

  const answerRuns = questions.map((question, index) => ({
    text: `${index + 1}. ${question.emojis.join(' ')}  ${question.answer}`,
    size: 1400,
    color: THEME.text,
  }))
  slides.push(
    buildSlide(frame('Answer key', `All ${questions.length} decoded words`).concat(bodyBox(answerRuns, 1750000, 4000000)))
  )

  return slides
}

function buildIncidentTrailDeck() {
  const data = JSON.parse(readFileSync(resolve(rootDir, 'src/data/incident-trail.json'), 'utf8'))
  const slides = []

  slides.push(
    buildSlide(
      frame('Incident Trail', '5 crime scenes · 5 clues · 25 information pieces').concat(
        bodyBox(
          [
            { text: 'Read the scene, then find the clue that closes it.', size: 2200, bold: true, color: THEME.text },
            { text: 'Each information piece carries its own answer sheet.', size: 1800, color: THEME.muted },
            { text: 'Twenty points per scene closed with the right clue.', size: 1600, color: THEME.muted },
          ],
          2300000,
          2800000
        )
      )
    )
  )

  data.scenes.forEach((scene, index) => {
    slides.push(
      buildSlide(
        frame(`Crime scene ${index + 1}: ${scene.title}`, 'Question').concat(
          bodyBox(
            [
              { text: scene.question, size: 3000, bold: true, color: THEME.text },
              { text: 'Answer: ______________________', size: 1800, color: THEME.teal },
            ],
            2300000,
            2600000
          )
        )
      )
    )
  })

  slides.push(
    buildSlide(
      frame('Clue tray', 'Five clues, one per crime scene').concat(
        bodyBox(
          data.clues.map((clue) => ({
            text: `${clue.text}  (piece #${clue.informationIndex + 1})`,
            size: 1700,
            color: THEME.text,
          })),
          1850000,
          3700000
        )
      )
    )
  )

  data.information.forEach((piece, index) => {
    slides.push(
      buildSlide(
        frame(`Information #${index + 1}: ${piece.headline}`, 'Piece and answer sheet').concat(
          bodyBox(
            [
              { text: piece.detail, size: 2000, color: THEME.text },
              { text: `Answer sheet: ${piece.answerSheet}`, size: 1700, color: THEME.teal },
            ],
            1950000,
            3600000
          )
        )
      )
    )
  })

  slides.push(
    buildSlide(
      frame('Case closed', 'Trail summary').concat(
        bodyBox(
          data.scenes.map((scene) => ({
            text: `${scene.title}: ${scene.answer}`,
            size: 1700,
            color: THEME.text,
          })),
          1850000,
          3700000
        )
      )
    )
  )

  return slides
}

/* ---------------------------------------------------------- validation --- */

function assertWellFormed(xml, name) {
  const stack = []
  const tagPattern = /<(\/?)([A-Za-z_][\w.-]*)([^>]*?)(\/?)>/g
  let match
  while ((match = tagPattern.exec(xml)) !== null) {
    const [, closing, tag, attributes, selfClosing] = match
    if (attributes.startsWith('?') || attributes.endsWith('?')) continue
    if (selfClosing === '/') continue
    if (closing === '/') {
      const open = stack.pop()
      if (open !== tag) throw new Error(`${name}: expected </${open}> but found </${tag}>`)
    } else {
      stack.push(tag)
    }
  }
  if (stack.length > 0) throw new Error(`${name}: unclosed tags ${stack.join(', ')}`)
}

function verifyArchive(buffer, expectedSlideCount) {
  const endIndex = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (endIndex < 0) throw new Error('missing end of central directory record')
  const entryCount = buffer.readUInt16LE(endIndex + 10)
  let cursor = buffer.readUInt32LE(endIndex + 16)

  const names = []
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('corrupt central directory entry')
    const compressedSize = buffer.readUInt32LE(cursor + 20)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const localOffset = buffer.readUInt32LE(cursor + 42)
    names.push(buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength))

    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const method = buffer.readUInt16LE(localOffset + 8)
    const payload = buffer.subarray(dataStart, dataStart + compressedSize)
    const text = method === 8 ? inflateRawSync(payload).toString('utf8') : payload.toString('utf8')
    assertWellFormed(text, names.at(-1))

    cursor += 46 + nameLength + extraLength + commentLength
  }

  const slides = names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
  if (slides.length !== expectedSlideCount) {
    throw new Error(`expected ${expectedSlideCount} slides but found ${slides.length}`)
  }
  return slides.length
}

function writeDeck(name, slides) {
  const archive = buildPresentation(slides)
  const slideCount = verifyArchive(archive, slides.length)
  const target = resolve(decksDir, name)
  writeFileSync(target, archive)
  return { target, slideCount, bytes: archive.length }
}

mkdirSync(decksDir, { recursive: true })

const decks = [
  { name: 'emoji-decode.pptx', slides: buildEmojiDeck() },
  { name: 'incident-trail.pptx', slides: buildIncidentTrailDeck() },
]

for (const deck of decks) {
  const result = writeDeck(deck.name, deck.slides)
  console.log(
    `${deck.name}: ${result.slideCount} slides, ${(result.bytes / 1024).toFixed(1)} kB -> ${result.target}`
  )
}