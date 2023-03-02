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
      cheatsheet: '```' + locale.codeLang + '↵',
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

// 单纯靠正则来判断header是不准确的, 比如在yaml格式下 # 是代表注释
export const isHeader = (text: string) => {
  return /^#+ /.test(text)
}

export const isHeaderByStyle = (styles: string[] = []) => {
  return (styles || []).some((style) => style?.toString().includes('header'))
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
  return widgets.some((widget) => widget.className.includes('tomatowidget'))
}

export const hasCountWidget = (widgets: any[] = []) => {
  const widget = widgets.find((widget) =>
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

// 显示和隐藏playicon和tomatoCount
export const syncTomatoWidget = (
  doc: any,
  tomatoLineInfo: any,
  tomatoCountInfo: any
) => {
  const lineUuidMap = reverseTomatoLineInfo(tomatoLineInfo)
  // 移除widget, 要用codemirror的方法来移除, 仅仅移掉dom可能会有问题, 因为editor上的widgets信息还会在

  /*
    根据tomatoLineInfo的信息来同步widgets
    1. 有widget, tomatoLineInfo上没有这个信息, 则删除.
    2. 无widget, tomatoLineInfo上有信息, 则添加
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
        const widgets = lineHandle.widgets.filter((widget) =>
          widget.className.includes('tomatowidget')
        )
        widgets.forEach((widget) => widget.clear())
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

    // 为每一行赋上一个代表行号的class
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
  当value发生变化时, 更新tomatoLineInfo. 第四个参数value只是用来观测的
*/
export const updateTomatoLineInfo = (
  doc: any,
  tomatoLineInfo: any,
  dispatch: any,
  value: any
) => {
  const newTomatoLineInfo: { [key: string]: string } = {}
  const lineUuidMap = reverseTomatoLineInfo(tomatoLineInfo)

  doc.eachLine((line: any) => {
    const lineIndex = doc.getLineNumber(line)
    if (lineIndex === undefined) return

    /*
      遍历每行来生成一个新的tomatoLineInfo, 然后比较这个info跟先前的值是不是一样, 如果不一样, 那触发dispatch
      1. 如果行上有widgets, 
      2. 如果行是header, 生成uuid
    */

    if (isHeaderByStyle(line.styles)) {
      if (hasPlayWidget(line.widgets)) {
        const widgetClassName = line.widgets.find((widget: any) =>
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
    dispatch('tomatoLineInfoChange', { value: newTomatoLineInfo })
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

export const syncTomatoCount = (tomatoCountInfo: any) => {
  Object.keys(tomatoCountInfo).forEach((uuid) => {
    const span: HTMLElement | null = document.querySelector(
      `.tomatocount_${uuid} > span`
    )
    if (span) {
      const text = span.innerText
      const count = tomatoCountInfo[uuid]
        ? tomatoCountInfo[uuid].toString()
        : ''
      if (text !== count) {
        span.innerText = count
      }
    }
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

export const getLineIndexByClass = (classList: string = '') => {
  const list = classList.split(' ')
  const indexClass = list.find((name) => name.includes('lineIndex'))
  if (indexClass) {
    return +indexClass.split('-')[1]
  }
}

export const showPlaying = (doc: any, uuid: string) => {
  hidePlaying()

  // 隐藏playicon
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
    const div = document.createElement('div')
    div.className = 'tomatoPlaying viewerPlaying'
    target.append(div)
  }
}
export const hideViewerPlaying = (body: any) => {
  body?.classList.remove('playing')

  body?.querySelectorAll('.viewerPlaying').forEach((ele: any) => ele.remove())
}

export const hidePlaying = () => {
  document.querySelectorAll('.tomatoPlaying').forEach((ele) => ele.remove())

  const codeBody = document.querySelector('.CodeMirror-code')
  codeBody?.classList.remove('playing')
}

// 在beforeChange事件里, 利用change对象, 来得到将会变成的文字内容
// 仅考虑单行的情况
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

  // 行首换行行为, 保留原来的文字
  if (fromCh === 0 && ch === 0 && origin === '+input') {
    return textBefore
  }

  if (text.length > 1) {
    return x + replacement
  }

  return x + replacement + y
}

// 仅考虑多行的情况
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

// 判断文字的样式是否会变化, 比如从header变到普通或者普通变成header
export const isFormatWillChange = (textBefore: string, textAfter: string) => {
  return isHeader(textBefore) !== isHeader(textAfter)
}

/*
  根据editor的change对象来获取信息, 是否有tomatoCount, 是否有header格式等.
  单行跟多行先分开来处理
  单行:
  1. 删除 (origin: +delete, text: [''])
  2. 输入文字英文(origin: +input, text: ['8'])
  3. 输入文字中文会触发两次beforeChange
    第一次: origin: *compose, text: [' ']
    第二次: origin: *compose, text: ['中国']
  4. 粘贴文字(origin: paste, text: ['## 8'])
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

  // 单行情况
  if (fromLine === line) {
    const lineHandle = editor.getLineHandle(fromLine)
    // !这个lineText是change前的!!
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
    /* 多行情况
    处理多行情况要考虑行的留存, 大部分情况下都是保留的起始行. 
    只有一种情况是保留的末行(即from和to的ch都为0)
    保留末行的处理逻辑很简单, 只需要考虑末行外的其它行

    保留首行的处理逻辑是除首行外其它行都会被销毁, 所以其它行需要考虑有无番茄数.
    而首行需要先进行合并, 然后根据合并后的结果看它是否有番茄数
    */

    // 保留末行
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
      // 保留首行
      for (let i = fromLine; i <= line; i++) {
        const lineHandle = editor.getLineHandle(i)
        // !这个lineText是change前的!!
        const lineText = lineHandle.text

        if (i === fromLine) {
          // 首行
          const textUp = editor.getLine(fromLine)
          const textDown = editor.getLine(line)
          const textAfter = getLineTextAfterMulti(textUp, textDown, change)
          if (!isHeader(textAfter) && hasCountWidget(lineHandle.widgets)) {
            hasTomatoCount = true
            const count = getTomatoCount(lineHandle.widgets)

            tomatoLineInfo.push({ line: i, text: lineHandle.text, count })
          }
        } else {
          // 其它行
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
