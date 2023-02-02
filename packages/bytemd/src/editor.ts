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
import usePlaceholder from 'codemirror-ssr/addon/display/placeholder.js'
import useContinuelist from 'codemirror-ssr/addon/edit/continuelist.js'
import useOverlay from 'codemirror-ssr/addon/mode/overlay.js'
import useGfm from 'codemirror-ssr/mode/gfm/gfm.js'
import useMarkdown from 'codemirror-ssr/mode/markdown/markdown.js'
import useXml from 'codemirror-ssr/mode/xml/xml.js'
import useYamlFrontmatter from 'codemirror-ssr/mode/yaml-frontmatter/yaml-frontmatter.js'
import useYaml from 'codemirror-ssr/mode/yaml/yaml.js'
import selectFiles from 'select-files'
import { v1 } from 'uuid'

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

export const hasPlayWidget = (widgets: any[] = []) => {
  return widgets.some((widget) => widget.className.includes('tomatowidget'))
}

// 显示和隐藏playicon和tomatoCount
export const syncTomatoWidget = (
  doc: any,
  tomatoLineInfo: any,
  tomatoCountInfo: any
) => {
  const lineUuidMap = reverseTomatoLineInfo(tomatoLineInfo)
  // 隐藏
  // dom的操作可能是异步的
  document.querySelectorAll('.tomatowidget').forEach((node) => {
    const uuid = getUuidByClass(node.className)
    if (uuid) {
      if (tomatoLineInfo[uuid] === undefined) {
        node.remove()
      }
    }
  })

  // 显示
  Object.keys(lineUuidMap).forEach((lineIndex) => {
    const line = doc.getLineHandle(+lineIndex)

    if (!hasPlayWidget(line.widgets)) {
      const uuid = lineUuidMap[lineIndex]
      addPlayIcon(doc, +lineIndex, uuid)

      showTomatoCount(doc, +lineIndex, tomatoCountInfo[uuid], uuid)
    }
  })
}

export const updateTomatoInfoByViewportChange = (
  doc: any,
  tomatoLineInfo: any,
  dispatch: any
) => {
  let tomatoLineInfoChange = false

  doc.eachLine((line: any) => {
    const lineIndex = doc.getLineNumber(line)

    if (lineIndex !== undefined) {
      // 如果行上有widgets, 更新行数
      if (hasPlayWidget(line.widgets)) {
        const widgetClassName = line.widgets.find((widget: any) =>
          widget.className.includes('tomatowidget')
        ).className
        const uuid = getUuidByClass(widgetClassName)
        if (uuid) {
          const oldLine = tomatoLineInfo[uuid]
          if (oldLine !== undefined && oldLine !== lineIndex) {
            tomatoLineInfo[uuid] = lineIndex
            tomatoLineInfoChange = true
          }
        }
      }

      if (isHeaderByStyle(line.styles) && !hasPlayWidget(line.widgets)) {
        const uuid = v1()
        tomatoLineInfo[uuid] = lineIndex
        tomatoLineInfoChange = true
      }

      // 删除的情况不需要考虑style, 只要不符合header格式都要删除. 因为在删除模式下header的样式会保留
      if (!isHeader(line.text) && hasPlayWidget(line.widgets)) {
        const widget = line.widgets.find((widget: any) =>
          widget.className.includes('tomatowidget')
        )
        const uuid = getUuidByClass(widget.className)
        if (uuid) {
          delete tomatoLineInfo[uuid]
          tomatoLineInfoChange = true
        }
      }
    }
  })

  if (tomatoLineInfoChange) {
    dispatch('tomatoLineInfoChange', { value: tomatoLineInfo })
  }
}

export const showTomatoCount = (
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
      const count = tomatoCountInfo[uuid].toString()
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

export const showPlaying = (uuid: string) => {
  hidePlaying()

  // 隐藏playicon
  const codeBody = document.querySelector('.CodeMirror-code')
  codeBody?.classList.add('playing')

  const div = document.createElement('div')
  div.className = 'tomatoPlaying'
  const target = document.querySelector(`.playbtn_${uuid}`)
  if (target) {
    target.parentNode?.append(div)
  }
}

export const hidePlaying = () => {
  document.querySelectorAll('.tomatoPlaying').forEach((ele) => ele.remove())

  const codeBody = document.querySelector('.CodeMirror-code')
  codeBody?.classList.remove('playing')
}
