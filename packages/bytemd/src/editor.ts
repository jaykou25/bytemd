import './addon/confirm.css'
// @ts-ignore
import useConfirm from './addon/confirm.js'
import { icons } from './icons'
import type {
  BytemdPlugin,
  BytemdAction,
  EditorProps,
  BytemdLocale,
  BytemdEditorContext,
} from './types'
import { getMdParser } from './utils'
import type { Editor, Position } from 'codemirror'
import type CodeMirror from 'codemirror'
import factory from 'codemirror-ssr'
import 'codemirror-ssr/addon/dialog/dialog.css'
import useDialog from 'codemirror-ssr/addon/dialog/dialog.js'
import usePlaceholder from 'codemirror-ssr/addon/display/placeholder.js'
import useContinuelist from 'codemirror-ssr/addon/edit/continuelist.js'
import useOverlay from 'codemirror-ssr/addon/mode/overlay.js'
import useGfm from 'codemirror-ssr/mode/gfm/gfm.js'
import useMarkdown from 'codemirror-ssr/mode/markdown/markdown.js'
import useXml from 'codemirror-ssr/mode/xml/xml.js'
import useYamlFrontmatter from 'codemirror-ssr/mode/yaml-frontmatter/yaml-frontmatter.js'
import useYaml from 'codemirror-ssr/mode/yaml/yaml.js'
import { isEqual } from 'lodash-es'
import selectFiles from 'select-files'
import { visit } from 'unist-util-visit'
import { v1, v4 } from 'uuid'

export function createCodeMirror() {
  const codemirror = factory()
  usePlaceholder(codemirror)
  useOverlay(codemirror)
  useXml(codemirror) // inline html highlight
  useMarkdown(codemirror)
  useGfm(codemirror)
  useYaml(codemirror)
  useYamlFrontmatter(codemirror)
  useContinuelist(codemirror)
  useDialog(codemirror)
  useConfirm(codemirror)
  return codemirror
}

export type EditorUtils = ReturnType<typeof createEditorUtils>

export function createEditorUtils(
  codemirror: typeof CodeMirror,
  editor: Editor
) {
  return {
    /**
     * Wrap text with decorators, for example:
     *
     * `text -> *text*`
     */
    wrapText(before: string, after = before) {
      const range = editor.somethingSelected()
        ? editor.listSelections()[0] // only handle the first selection
        : editor.findWordAt(editor.getCursor())

      const from = range.from() // use from/to instead of anchor/head for reverse select
      const to = range.to()
      const text = editor.getRange(from, to)
      const fromBefore = codemirror.Pos(from.line, from.ch - before.length)
      const toAfter = codemirror.Pos(to.line, to.ch + after.length)

      if (
        editor.getRange(fromBefore, from) === before &&
        editor.getRange(to, toAfter) === after
      ) {
        editor.replaceRange(text, fromBefore, toAfter)
        editor.setSelection(
          fromBefore,
          codemirror.Pos(fromBefore.line, fromBefore.ch + text.length)
        )
      } else {
        editor.replaceRange(before + text + after, from, to)

        // select the original text
        const cursor = editor.getCursor()
        editor.setSelection(
          codemirror.Pos(cursor.line, cursor.ch - after.length - text.length),
          codemirror.Pos(cursor.line, cursor.ch - after.length)
        )
      }
    },
    /**
     * replace multiple lines
     *
     * `line -> # line`
     */
    replaceLines(replace: Parameters<Array<string>['map']>[0]) {
      const [selection] = editor.listSelections()

      const range = [
        codemirror.Pos(selection.from().line, 0),
        codemirror.Pos(selection.to().line),
      ] as const
      const lines = editor.getRange(...range).split('\n')
      editor.replaceRange(lines.map(replace).join('\n'), ...range)
      editor.setSelection(...range)
    },
    /**
     * Append a block based on the cursor position
     */
    appendBlock(content: string): Position {
      const cursor = editor.getCursor()
      // find the first blank line

      let emptyLine = -1
      for (let i = cursor.line; i < editor.lineCount(); i++) {
        if (!editor.getLine(i).trim()) {
          emptyLine = i
          break
        }
      }
      if (emptyLine === -1) {
        // insert a new line to the bottom
        editor.replaceRange('\n', codemirror.Pos(editor.lineCount()))
        emptyLine = editor.lineCount()
      }

      editor.replaceRange('\n' + content, codemirror.Pos(emptyLine))
      return codemirror.Pos(emptyLine + 1, 0)
    },
    /**
     * Triggers a virtual file input and let user select files
     *
     * https://www.npmjs.com/package/select-files
     */
    selectFiles,
  }
}

export function findStartIndex(num: number, nums: number[]) {
  let startIndex = nums.length - 2
  for (let i = 0; i < nums.length; i++) {
    if (num < nums[i]) {
      startIndex = i - 1
      break
    }
  }
  startIndex = Math.max(startIndex, 0) // ensure >= 0
  return startIndex
}

const getShortcutWithPrefix = (key: string, shift = false) => {
  const shiftPrefix = shift ? 'Shift-' : ''
  const CmdPrefix =
    typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
      ? 'Cmd-'
      : 'Ctrl-'
  return shiftPrefix + CmdPrefix + key
}

export async function handleImageUpload(
  { editor, appendBlock, codemirror }: BytemdEditorContext,
  uploadImages: NonNullable<EditorProps['uploadImages']>,
  files: File[]
) {
  const imgs = await uploadImages(files)
  const pos = appendBlock(
    imgs
      .map(({ url, alt, title }, i) => {
        alt = alt ?? files[i].name
        return `![${alt}](${url}${title ? ` "${title}"` : ''})`
      })
      .join('\n\n')
  )
  editor.setSelection(pos, codemirror.Pos(pos.line + imgs.length * 2 - 2))
  editor.focus()
}

export function getBuiltinActions(
  locale: BytemdLocale,
  plugins: BytemdPlugin[],
  uploadImages: EditorProps['uploadImages']
): { leftActions: BytemdAction[]; rightActions: BytemdAction[] } {
  const leftActions: BytemdAction[] = [
    {
      icon: icons.H,
      handler: {
        type: 'dropdown',
        actions: [1, 2, 3, 4, 5, 6].map((level) => ({
          title: locale[`h${level}` as keyof BytemdLocale],
          icon: [
            icons.H1,
            icons.H2,
            icons.H3,
            icons.LevelFourTitle,
            icons.LevelFiveTitle,
            icons.LevelSixTitle,
          ][level - 1],
          cheatsheet:
            level <= 3
              ? `${'#'.repeat(level)} ${locale.headingText}`
              : undefined,
          handler: {
            type: 'action',
            click({ replaceLines, editor }) {
              replaceLines((line) => {
                line = line.trim().replace(/^#*/, '').trim()
                line = '#'.repeat(level) + ' ' + line
                return line
              })
              editor.focus()
            },
          },
        })),
      },
    },
    {
      title: locale.bold,
      icon: icons.TextBold,
      cheatsheet: `**${locale.boldText}**`,
      handler: {
        type: 'action',
        shortcut: getShortcutWithPrefix('B'),
        click({ wrapText, editor }) {
          wrapText('**')
          editor.focus()
        },
      },
    },
    {
      title: locale.italic,
      icon: icons.TextItalic,
      cheatsheet: `*${locale.italicText}*`,
      handler: {
        type: 'action',
        shortcut: getShortcutWithPrefix('I'),
        click({ wrapText, editor }) {
          wrapText('*')
          editor.focus()
        },
      },
    },
    {
      title: locale.quote,
      icon: icons.Quote,
      cheatsheet: `> ${locale.quotedText}`,
      handler: {
        type: 'action',
        click({ replaceLines, editor }) {
          replaceLines((line) => '> ' + line)
          editor.focus()
        },
      },
    },
    {
      title: locale.link,
      icon: icons.LinkOne,
      cheatsheet: `[${locale.linkText}](url)`,
      handler: {
        type: 'action',
        shortcut: getShortcutWithPrefix('K'),
        click({ editor, wrapText, codemirror }) {
          wrapText('[', '](url)')
          const cursor = editor.getCursor()
          editor.setSelection(
            codemirror.Pos(cursor.line, cursor.ch + 2),
            codemirror.Pos(cursor.line, cursor.ch + 5)
          )
          editor.focus()
        },
      },
    },
    {
      title: locale.image,
      icon: icons.Pic,
      cheatsheet: `![${locale.imageAlt}](url "${locale.imageTitle}")`,
      handler: uploadImages
        ? {
            type: 'action',
            shortcut: getShortcutWithPrefix('I', true),
            async click(ctx) {
              const fileList = await selectFiles({
                accept: 'image/*',
                multiple: true,
              })

              if (fileList?.length) {
                await handleImageUpload(ctx, uploadImages, Array.from(fileList))
              }
            },
          }
        : undefined,
    },
    {
      title: locale.code,
      icon: icons.Code,
      cheatsheet: '`' + locale.codeText + '`',
      handler: {
        type: 'action',
        shortcut: getShortcutWithPrefix('K', true),
        click({ wrapText, editor }) {
          wrapText('`')
          editor.focus()
        },
      },
    },
    {
      title: locale.codeBlock,
      icon: icons.CodeBrackets,
      cheatsheet: '```' + locale.codeLang + '???',
      handler: {
        type: 'action',
        shortcut: getShortcutWithPrefix('C', true),
        click({ editor, appendBlock, codemirror }) {
          const pos = appendBlock('```js\n```')
          editor.setSelection(
            codemirror.Pos(pos.line, 3),
            codemirror.Pos(pos.line, 5)
          )
          editor.focus()
        },
      },
    },
    {
      title: locale.ul,
      icon: icons.ListTwo,
      cheatsheet: `- ${locale.ulItem}`,
      handler: {
        type: 'action',
        shortcut: getShortcutWithPrefix('U', true),
        click({ replaceLines, editor }) {
          replaceLines((line) => '- ' + line)
          editor.focus()
        },
      },
    },
    {
      title: locale.ol,
      icon: icons.OrderedList,
      cheatsheet: `1. ${locale.olItem}`,
      handler: {
        type: 'action',
        shortcut: getShortcutWithPrefix('O', true),
        click({ replaceLines, editor }) {
          replaceLines((line, i) => `${i + 1}. ${line}`)
          editor.focus()
        },
      },
    },
    {
      title: locale.hr,
      icon: icons.DividingLine,
      cheatsheet: '---',
    },
  ]
  const rightActions: BytemdAction[] = []
  plugins.forEach(({ actions }) => {
    if (actions) {
      actions.forEach((action) => {
        if (!action.position || action.position !== 'right')
          leftActions.push(action)
        else rightActions.unshift(action)
      })
    }
  })
  return {
    leftActions,
    rightActions,
  }
}

// ????????????????????????header???????????????, ?????????yaml????????? # ???????????????
export const isHeading = (text: string) => {
  return /^#+ /.test(text)
}

/**
 * ???????????????listItem
 */
export const isListItem = (text: string) => {
  return /\s*\d+\. /.test(text) || /\s*\* /.test(text)
}

export const addPlayIcon = (doc: any, index: number, uuid?: string) => {
  const icon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M7.752 5.439l10.508 6.13a.5.5 0 0 1 0 .863l-10.508 6.13A.5.5 0 0 1 7 18.128V5.871a.5.5 0 0 1 .752-.432z"/></svg>'
  const span = document.createElement('span')
  span.classList.add('playBtn')
  span.innerHTML = icon
  doc.addLineWidget(index, span, {
    className: `linewidget-playbtn tomatowidget playbtn_${uuid || v1()}`,
  })
}

export const hasPlayWidget = (widgets = []) => {
  return (widgets || []).some((widget: any) =>
    widget.className.includes('tomatowidget')
  )
}

export const hasCountWidget = (widgets: any[] = []) => {
  const widget = (widgets || []).find((widget) =>
    widget.className.includes('tomatocount')
  )
  if (widget) {
    const count = widget.node.innerText

    return !!count && +count > 0
  }

  return false
}

export const getTomatoCount = (widgets: any[] = []) => {
  const widget = widgets.find((widget) =>
    widget.className.includes('tomatocount')
  )
  if (widget) {
    const count = widget.node.innerText

    return count
  }

  return 0
}

// ???????????????playicon???tomatoCount
export const syncTomatoWidget = (
  doc: any,
  tomatoLineInfo: any,
  tomatoCountInfo: any
) => {
  const lineUuidMap = reverseTomatoLineInfo(tomatoLineInfo)
  // ??????widget, ??????codemirror??????????????????, ????????????dom??????????????????, ??????editor??????widgets???????????????

  /*
    ??????tomatoLineInfo??????????????????widgets
    1. ???widget, tomatoLineInfo?????????????????????, ?????????; ?????????, ?????????count
    2. ???widget, tomatoLineInfo????????????, ?????????
  */

  doc.eachLine((lineHandle: any) => {
    const lineIndex = doc.getLineNumber(lineHandle)

    if (hasPlayWidget(lineHandle.widgets)) {
      const widgetClassName = lineHandle.widgets.find((widget: any) =>
        widget.className.includes('tomatowidget')
      ).className
      const uuid = getUuidByClass(widgetClassName) || ''
      if (tomatoLineInfo[uuid] === undefined) {
        // remove widgets
        const widgets = lineHandle.widgets.filter((widget: any) =>
          widget.className.includes('tomatowidget')
        )
        widgets.forEach((widget: any) => widget.clear())
      } else {
        // update count
        lineHandle.widgets
          .find((widget: any) =>
            widget.className.includes('linewidget-tomatocount')
          )
          ?.clear()
        addTomatoCount(doc, +lineIndex, tomatoCountInfo[uuid], uuid)
      }
    } else {
      if (lineUuidMap[lineIndex]) {
        const uuid = lineUuidMap[lineIndex]
        addPlayIcon(doc, +lineIndex, uuid)

        addTomatoCount(doc, +lineIndex, tomatoCountInfo[uuid], uuid)
      }
    }
  })
}

export const updateLineIndex = (doc: any, value: any) => {
  doc.eachLine((line: any) => {
    const lineIndex = doc.getLineNumber(line)
    if (lineIndex === undefined) return

    // ???????????????????????????????????????class
    if (getLineIndexByClass(line.wrapClass) !== lineIndex) {
      doc.removeLineClass(lineIndex, 'wrapper')
      doc.addLineClass(
        lineIndex,
        'wrapper',
        `lineWrapper lineIndex-${lineIndex}`
      )
    }
  })
}

/* 
  ???value???????????????, ??????tomatoLineInfo. 
  ????????????????????????, ???md??????????????????, ???????????????????????????????????????
*/
export const updateTomatoLineInfo2 = (
  value: string,
  plugins: any,
  doc: any,
  tomatoLineInfo: any,
  dispatch: any
) => {
  const newTomatoLineInfo: { [key: string]: number } = {}
  const lineUuidMap = reverseTomatoLineInfo(tomatoLineInfo)

  const mdParser = getMdParser(plugins)
  try {
    const tree = mdParser.parse(value)
    visit(tree, ['heading', 'listItem'], (node) => {
      if (node.position) {
        const lineIndex = node.position.start.line - 1
        const lineHandle = doc.getLineHandle(lineIndex)

        /*
          ??????????????????tomatoLineInfo, ??????????????????info??????????????????????????????, ???????????????, ?????????dispatch
          1. ???????????????widgets, ????????????uuid???index 
          2. ?????????tomatoLineInfo??????uuid, ?????????????????????uuid
        */

        if (hasPlayWidget(lineHandle.widgets)) {
          const widgetClassName = lineHandle.widgets.find((widget: any) =>
            widget.className.includes('tomatowidget')
          ).className
          const uuid = getUuidByClass(widgetClassName)
          if (uuid) {
            newTomatoLineInfo[uuid] = lineIndex
          }
        } else {
          const uuid = lineUuidMap[lineIndex] || v4()
          newTomatoLineInfo[uuid] = lineIndex
        }
      }
    })

    if (!isEqual(tomatoLineInfo, newTomatoLineInfo)) {
      console.log('dispatch tomatoLineInfoChange')
      dispatch('tomatoLineInfoChange', { value: newTomatoLineInfo })
    }
  } catch (e) {
    console.log('parse error', e)
  }
}

export const addTomatoCount = (
  doc: any,
  index: number,
  count: number,
  uuid: string
) => {
  const span = document.createElement('span')
  span.classList.add('tomatoCount')
  if (count) {
    span.innerText = count.toString()
  }
  doc.addLineWidget(index, span, {
    className: `linewidget-tomatocount tomatowidget tomatocount_${uuid}`,
  })
}

export const reverseTomatoLineInfo = (info: any) => {
  const result: any = {}
  Object.keys(info).forEach((uuid: string) => {
    const line = info[uuid]
    result[line] = uuid
  })

  return result
}

export const getUuidByClass = (nameList: string) => {
  const list = nameList.split(' ')
  const uuidClass = list.find((name) => name.includes('_'))
  if (uuidClass) {
    return uuidClass.split('_')[1]
  }
}

export const getUuidByWidgets = (widgets: any) => {
  const widgetClassName = (widgets || []).find((widget: any) =>
    widget.className.includes('tomatowidget')
  )?.className

  return getUuidByClass(widgetClassName || '')
}

export const getLineIndexByClass = (classList: string = '') => {
  const list = classList.split(' ')
  const indexClass = list.find((name) => name.includes('lineIndex'))
  if (indexClass) {
    return +indexClass.split('-')[1]
  }
}

export const showPlaying = (doc: any, uuid: string) => {
  hidePlaying(doc)

  // ??????playicon
  const codeBody = document.querySelector('.CodeMirror-code')
  codeBody?.classList.add('playing')

  const span = document.createElement('span')
  const target = document.querySelector(`.playbtn_${uuid}`)
  if (target) {
    const wrapper = target.closest('.lineWrapper')
    const lineIndex = getLineIndexByClass(wrapper?.className)
    doc.addLineWidget(lineIndex, span, { className: 'tomatoPlaying' })
  }
}

export const showViewerPlaying = (body: any, uuid: string) => {
  hideViewerPlaying(body)

  body.classList.add('playing')
  const target = body.querySelector(`.playbtn_${uuid}`)
  if (target) {
    // ??????, ????????????, ??????????????????line-height (?????????????????????)
    const div = document.createElement('div')
    div.className = 'tomatoPlayingWrapper'

    if (target.tagName === 'LI') div.classList.add('liWrapper')

    // innerFont ????????????wrapper????????????, ??????line-height???????????????
    div.innerHTML = `
     <span class='innerFont'>0</span>
     <div class='innerWrapper'>
        <span class='viewerPlaying'></span>
      </div>
    `
    target.append(div)
  }
}
export const hideViewerPlaying = (body: any) => {
  body?.classList.remove('playing')

  body?.querySelectorAll('.viewerPlaying').forEach((ele: any) => ele.remove())
}

/**
 * ??????????????????dom
 */
export const hidePlaying = (doc: any) => {
  doc.eachLine((lineHandle: any) => {
    ;(lineHandle.widgets || [])
      .find((widget: any) => widget.className.includes('tomatoPlaying'))
      ?.clear()
  })

  const codeBody = document.querySelector('.CodeMirror-code')
  codeBody?.classList.remove('playing')
}

// ???beforeChange?????????, ??????change??????, ????????????????????????????????????
// ????????????????????????
export const getLineTextAfter = (textBefore: string, change: any) => {
  const {
    origin,
    text,
    from: { ch: fromCh },
    to: { ch },
  } = change

  const x = textBefore.substring(0, fromCh)
  const replacement = text[0]
  const y = textBefore.substring(ch)

  // ??????????????????, ?????????????????????
  if (fromCh === 0 && ch === 0 && origin === '+input') {
    return textBefore
  }

  if (text.length > 1) {
    return x + replacement
  }

  return x + replacement + y
}

// ????????????????????????
export const getLineTextAfterMulti = (
  textUp: string,
  textDown: string,
  change: any
) => {
  const {
    origin,
    text,
    from: { ch: fromCh },
    to: { ch },
  } = change
  const x = textUp.substring(0, fromCh)
  const replacement = text[0]
  const y = textDown.substring(ch)

  if (text.length > 1) {
    return x + replacement
  }

  return x + replacement + y
}

/**
 * ??????????????????uuid???????????????
 * @returns boolean
 */
export const formatWillBreak = (lineHandle: any, change: any) => {
  const textBefore = lineHandle.text
  return (
    hasPlayWidget(lineHandle.widgets) &&
    !isFormatText(getLineTextAfter(textBefore, change))
  )
}

/**
 * ???????????????????????????????????????
 * 1. heading??????
 * 2. listItem??????
 *
 * ??????????????????
 */
export const isFormatText = (text: string) => {
  return isHeading(text) || isListItem(text)
}

// ????????????????????????????????????, ?????????header??????????????????????????????header
export const isFormatWillChange = (textBefore: string, textAfter: string) => {
  return isFormatText(textBefore) !== isFormatText(textAfter)
}

/*
  ??????editor???change?????????????????????, ?????????tomatoCount, ?????????header?????????.
  ?????????????????????????????????
  ??????:
  1. ?????? (origin: +delete, text: [''])
  2. ??????????????????(origin: +input, text: ['8'])
  3. ?????????????????????????????????beforeChange
    ?????????: origin: *compose, text: [' ']
    ?????????: origin: *compose, text: ['??????']
  4. ????????????(origin: paste, text: ['## 8'])
*/

export const getMultiLineInfo = (
  editor: any,
  change: any
): {
  hasTomatoCount: boolean
  tomatoLineInfo: any[]
} => {
  const {
    from: { line: fromLine, ch: fromCh },
    to: { line, ch },
  } = change

  let hasTomatoCount = false
  const tomatoLineInfo: any[] = []

  // ????????????
  if (fromLine === line) {
    const lineHandle = editor.getLineHandle(fromLine)
    // !??????lineText???change??????!!
    const lineText = lineHandle.text
    const textAfter = getLineTextAfter(lineText, change)
    if (isFormatWillChange(lineText, textAfter)) {
      if (hasCountWidget(lineHandle.widgets)) {
        hasTomatoCount = true
        const count = getTomatoCount(lineHandle.widgets)

        tomatoLineInfo.push({ line, text: lineText, count })
      }
    }
  } else {
    /* ????????????
    ???????????????????????????????????????, ??????????????????????????????????????????. 
    ????????????????????????????????????(???from???to???ch??????0)
    ????????????????????????????????????, ????????????????????????????????????

    ??????????????????????????????????????????????????????????????????, ??????????????????????????????????????????.
    ??????????????????????????????, ??????????????????????????????????????????????????????
    */

    // ????????????
    if (fromCh === 0 && ch === 0) {
      for (let i = fromLine; i < line; i++) {
        const lineHandle = editor.getLineHandle(i)
        if (hasCountWidget(lineHandle.widgets)) {
          hasTomatoCount = true
          const count = getTomatoCount(lineHandle.widgets)

          tomatoLineInfo.push({ line: i, text: lineHandle.text, count })
        }
      }
    } else {
      // ????????????
      for (let i = fromLine; i <= line; i++) {
        const lineHandle = editor.getLineHandle(i)

        if (i === fromLine) {
          // ??????
          const textUp = editor.getLine(fromLine)
          const textDown = editor.getLine(line)
          const textAfter = getLineTextAfterMulti(textUp, textDown, change)
          if (!isFormatText(textAfter) && hasCountWidget(lineHandle.widgets)) {
            hasTomatoCount = true
            const count = getTomatoCount(lineHandle.widgets)

            tomatoLineInfo.push({ line: i, text: lineHandle.text, count })
          }
        } else {
          // ?????????
          if (hasCountWidget(lineHandle.widgets)) {
            hasTomatoCount = true
            const count = getTomatoCount(lineHandle.widgets)
            tomatoLineInfo.push({ line: i, text: lineHandle.text, count })
          }
        }
      }
    }
  }

  return { hasTomatoCount, tomatoLineInfo }
}

export const lineChangeHasPlayingUuid = (
  editor: any,
  change: any,
  playingUuid?: string
) => {
  const {
    from: { line: fromLine, ch: fromCh },
    to: { line, ch },
  } = change

  let result = false

  // ????????????
  if (fromLine === line) {
    const lineHandle = editor.getLineHandle(fromLine)

    if (formatWillBreak(lineHandle, change)) {
      const uuid = getUuidByWidgets(lineHandle.widgets)
      if (uuid === playingUuid) {
        return true
      }
    }
  } else {
    /* ????????????
      ???????????????????????????????????????, ??????????????????????????????????????????. 
      ????????????????????????????????????(???from???to???ch??????0)
      ????????????????????????????????????, ????????????????????????????????????

      ??????????????????????????????????????????????????????????????????, ??????????????????????????????????????????.
      ??????????????????????????????, ??????????????????????????????????????????????????????
    */

    // ????????????
    if (fromCh === 0 && ch === 0) {
      for (let i = fromLine; i < line; i++) {
        const lineHandle = editor.getLineHandle(i)
        if (hasPlayWidget(lineHandle.widgets)) {
          const uuid = getUuidByWidgets(lineHandle.widgets)
          if (playingUuid === uuid) {
            result = true
            break
          }
        }
      }
      if (result) return result
    } else {
      // ????????????
      for (let i = fromLine; i <= line; i++) {
        const lineHandle = editor.getLineHandle(i)
        // !??????lineText???change??????!!
        const lineText = lineHandle.text

        if (i === fromLine) {
          // ??????
          const textUp = editor.getLine(fromLine)
          const textDown = editor.getLine(line)
          const textAfter = getLineTextAfterMulti(textUp, textDown, change)
          if (!isFormatText(textAfter) && hasPlayWidget(lineHandle.widgets)) {
            const uuid = getUuidByWidgets(lineHandle.widgets)
            if (uuid === playingUuid) {
              result = true
              break
            }
          }
        } else {
          // ?????????
          if (hasPlayWidget(lineHandle.widgets)) {
            const uuid = getUuidByWidgets(lineHandle.widgets)
            if (uuid === playingUuid) {
              result = true
              break
            }
          }
        }
      }
      if (result) return result
    }
  }
  return result
}
