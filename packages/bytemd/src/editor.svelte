<svelte:options immutable={true} />

<script lang="ts">
  import en from '../locales/en.json'
  import {
    createCodeMirror,
    createEditorUtils,
    findStartIndex,
    getBuiltinActions,
    handleImageUpload,
    isHeader,
    getUuidByClass,
    showPlaying,
    hidePlaying,
    syncTomatoWidget,
    updateTomatoInfoByViewportChange,
    syncTomatoCount,
    hasCountWidget,
    getMultiLineInfo,
  } from './editor'
  import Help from './help.svelte'
  import { icons } from './icons'
  import Status from './status.svelte'
  import Toc from './toc.svelte'
  import Toolbar from './toolbar.svelte'
  import type {
    BytemdEditorContext,
    BytemdPlugin,
    EditorProps as Props,
  } from './types'
  import Viewer from './viewer.svelte'
  import type { Editor, KeyMap } from 'codemirror'
  import type { Root, Element } from 'hast'
  import { debounce, throttle } from 'lodash-es'
  import { onMount, createEventDispatcher, onDestroy, tick } from 'svelte'
  import type { VFile } from 'vfile'

  export let value: Props['value'] = ''
  export let plugins: NonNullable<Props['plugins']> = []
  export let sanitize: Props['sanitize'] = undefined
  export let remarkRehype: Props['remarkRehype'] = undefined
  export let mode: NonNullable<Props['mode']> = 'auto'
  export let previewDebounce: NonNullable<Props['previewDebounce']> = 300
  export let placeholder: Props['placeholder'] = undefined
  export let editorConfig: Props['editorConfig'] = undefined
  export let locale: Props['locale'] = undefined
  export let uploadImages: Props['uploadImages'] = undefined
  export let overridePreview: Props['overridePreview'] = undefined
  export let maxLength: NonNullable<Props['maxLength']> = Infinity
  export let tomatoLineInfo: any = {}
  export let tomatoCountInfo: any = {}
  export let playingUuid: string | undefined

  $: mergedLocale = { ...en, ...locale }
  const dispatch = createEventDispatcher<{
    change: { value: string }
    play: { value: string }
    tomatoLineInfoChange: { value: any }
  }>()

  $: actions = getBuiltinActions(mergedLocale, plugins, uploadImages)
  $: split = mode === 'split' || (mode === 'auto' && containerWidth >= 800)
  $: ((_) => {
    // reset active tab
    if (split) activeTab = false
  })(split)

  let root: HTMLElement
  let editorEl: HTMLElement
  let previewEl: HTMLElement
  let containerWidth = Infinity // TODO: first screen

  let codemirror: ReturnType<typeof createCodeMirror>
  let editor: Editor
  let activeTab: false | 'write' | 'preview'
  let fullscreen = false
  let sidebar: false | 'help' | 'toc' = false

  $: styles = (() => {
    let edit: string
    let preview: string

    if (split && activeTab === false) {
      if (sidebar) {
        edit = `width:calc(50% - ${sidebar ? 140 : 0}px)`
        preview = `width:calc(50% - ${sidebar ? 140 : 0}px)`
      } else {
        edit = 'width:50%'
        preview = 'width:50%'
      }
    } else if (activeTab === 'preview') {
      edit = 'display:none'
      preview = `width:calc(100% - ${sidebar ? 280 : 0}px)`
    } else {
      edit = `width:calc(100% - ${sidebar ? 280 : 0}px)`
      preview = 'display:none'
      // TODO: use width:0 to make scroll sync work until
      // the position calculation improved (causes white screen after switching to editor only)
    }

    return { edit, preview }
  })()

  $: if (playingUuid) {
    showPlaying(playingUuid)
  } else {
    hidePlaying()
  }

  $: if (editor) {
    syncTomatoWidget(editor.getDoc(), tomatoLineInfo, tomatoCountInfo)
  }

  $: if (editor) {
    syncTomatoCount(tomatoCountInfo)
  }

  $: context = (() => {
    const context: BytemdEditorContext = {
      // @ts-ignore
      codemirror,
      editor,
      root,
      // @ts-ignore
      ...createEditorUtils(codemirror, editor),
    }
    return context
  })()

  let cbs: ReturnType<NonNullable<BytemdPlugin['editorEffect']>>[] = []
  let keyMap: KeyMap = {}

  function on() {
    // console.log('on', plugins);
    cbs = plugins.map((p) => p.editorEffect?.(context))

    keyMap = {}
    // TODO: nested shortcuts
    actions.leftActions.forEach(({ handler }) => {
      if (handler?.type === 'action' && handler.shortcut) {
        keyMap[handler.shortcut] = () => {
          handler.click(context)
        }
      }
    })
    editor.addKeyMap(keyMap)
  }
  function off() {
    // console.log('off', plugins);
    cbs.forEach((cb) => cb && cb())

    editor?.removeKeyMap(keyMap) // onDestroy runs at SSR, optional chaining here
  }

  let debouncedValue = value
  const setDebouncedValue = debounce((value: string) => {
    debouncedValue = value

    overridePreview?.(previewEl, {
      value: debouncedValue,
      plugins,
      sanitize,
      remarkRehype,
    })
  }, previewDebounce)
  $: setDebouncedValue(value)

  $: if (editor && value !== editor.getValue()) {
    editor.setValue(value)
  }

  $: if (editor && plugins) {
    off()
    tick().then(() => {
      on()
    })
  }

  // Scroll sync vars
  let syncEnabled = true
  let editCalled = false
  let previewCalled = false
  let editPs: number[]
  let previewPs: number[]
  let hast: Root = { type: 'root', children: [] }
  let vfile: VFile
  let currentBlockIndex = 0

  onMount(async () => {
    codemirror = createCodeMirror()

    editor = codemirror(editorEl, {
      value,
      mode: 'yaml-frontmatter',
      lineWrapping: true,
      tabSize: 8, // keep consistent with preview: https://developer.mozilla.org/en-US/docs/Web/CSS/tab-size#formal_definition
      indentUnit: 4, // nested ordered list does not work with 2 spaces
      extraKeys: {
        Enter: 'newlineAndIndentContinueMarkdownList',
      }, // https://github.com/codemirror/CodeMirror/blob/c955a0fb02d9a09cf98b775cb94589e4980303c1/mode/markdown/index.html#L359
      ...editorConfig,
      placeholder,
      lineNumbers: true,
    })

    const doc = editor.getDoc()

    syncTomatoWidget(doc, tomatoLineInfo, tomatoCountInfo)
    // 对没有uuid的header初始化
    console.log('svelte onmount:', { value, tomatoLineInfo })
    updateTomatoInfoByViewportChange(doc, tomatoLineInfo, dispatch)

    editor.on('viewportChange', (ins) => {
      // 增加行, 减行, 滚动都会引起viewportChange
      // 需要更新lineIndex
      updateTomatoInfoByViewportChange(ins.getDoc(), tomatoLineInfo, dispatch)
    })

    // 监听click事件
    document
      .querySelector('.CodeMirror-code')
      ?.addEventListener('click', (e) => {
        const btn = e.target?.closest('.linewidget-playbtn')
        if (btn) {
          const uuid = getUuidByClass(btn.className)
          const text =
            btn.parentNode.querySelector('.CodeMirror-line').innerText
          dispatch('play', { value: { uuid, text } })
        }
      })

    // https://github.com/codemirror/CodeMirror/issues/2428#issuecomment-39315423
    // https://github.com/codemirror/CodeMirror/issues/988#issuecomment-392232020
    editor.addKeyMap({
      Tab: 'indentMore',
      'Shift-Tab': 'indentLess',
    })

    editor.on('focus', (ins, e) => {})

    editor.on('cursorActivity', (ins) => {
      if (ins.state.confirmationOpen) {
        ins.closeConfirmation()
      }
    })

    editor.on('keydown', (ins, e) => {
      if (e.code === 'Enter' && ins.state.confirmationOpen) {
        // codemirror.e_stop(e)
        codemirror.e_preventDefault(e)
      }
    })

    editor.on('beforeChange', (ins, change) => {
      const {
        from: { line: fromLine, ch: fromCh },
        to: { line, ch },
        text,
        origin,
      } = change

      if (ins.state.isConfirm) {
        ins.state.isConfirm = false
        return
      }

      console.log('before change', change)

      // !处理行上有番茄的情况
      // 多行删除要考虑末行dom移除问题.
      // 1. 首行全删除 -> 末行到0位 :末行不会删dom
      //              -> 末行非0位 :末行会删!
      // 2. 首行没全删除 -> 末行都会删!
      const { hasTomatoCount, tomatoLineInfo, headerWillChanged } =
        getMultiLineInfo(ins, change)

      if (hasTomatoCount) {
        const lines = tomatoLineInfo
          .map(
            (info, index) =>
              `<tr><td>${index + 1}</td><td class="t-text">${
                info.text
              }</td><td>${info.count}</td></tr>`
          )
          .join('')
        const confirmText = `<table><tr><td class="t-index">序号</td><td class="t-text">段落内容</td><td class="t-count">蕃茄数</td></tr>${lines}</table>`

        ins.openConfirmation(confirmText, {
          title: '此操作会移除段落上的番茄数据',
          footerTitle: '确认要执行此操作吗?',
          onConfirm: () => {
            console.log('confirm')
            ins.state.isConfirm = true
            ins.replaceRange(
              text,
              { line: fromLine, ch: fromCh },
              { line, ch },
              origin
            )
            setTimeout(() => {
              updateTomatoInfoByViewportChange(ins, tomatoLineInfo, dispatch)
            }, 50)
          },
        })

        change.cancel()
      } else {
        if (headerWillChanged)
          updateTomatoInfoByViewportChange(ins, tomatoLineInfo, dispatch)
      }
    })

    editor.on('change', (ins, change) => {
      const {
        from: { line: fromLine },
        to: { line },
      } = change

      // 在change事件里lsyncTomatoWidget的styles还没有被渲染出来, 看起来是有延时的.
      const lineText = ins.getLine(line)

      if (change.origin === '+input') {
        // 这里change后, doc.eachLine里输入行的样式获取不到
        if (isHeader(lineText)) {
          setTimeout(() => {
            updateTomatoInfoByViewportChange(ins, tomatoLineInfo, dispatch)
          }, 100)
        }
      }

      // if (change.origin === '+delete') {
      //   // 只考虑单行删除
      //   if (fromLine === line) {
      //     const text = ins.getLine(line)
      //     if (!isHeader(text)) {
      //       updateTomatoInfoByViewportChange(ins, tomatoLineInfo, dispatch)
      //     }
      //   }
      // }

      dispatch('change', { value: editor.getValue() })
      console.log('selvte dispatch change', { value: editor.getValue() })
    })

    const updateBlockPositions = throttle(() => {
      editPs = []
      previewPs = []

      const scrollInfo = editor.getScrollInfo()
      const body = previewEl.childNodes[0]
      if (!(body instanceof HTMLElement)) return

      const leftNodes = hast.children.filter(
        (v): v is Element => v.type === 'element'
      )
      const rightNodes = [...body.childNodes].filter(
        (v): v is HTMLElement => v instanceof HTMLElement
      )

      for (let i = 0; i < leftNodes.length; i++) {
        const leftNode = leftNodes[i]
        const rightNode = rightNodes[i]

        // if there is no position info, move to the next node
        if (!leftNode.position) {
          continue
        }

        const left =
          editor.heightAtLine(leftNode.position.start.line - 1, 'local') /
          (scrollInfo.height - scrollInfo.clientHeight)
        const right =
          (rightNode.offsetTop - body.offsetTop) /
          (previewEl.scrollHeight - previewEl.clientHeight)

        if (left >= 1 || right >= 1) {
          break
        }

        editPs.push(left)
        previewPs.push(right)
      }

      editPs.push(1)
      previewPs.push(1)
      // console.log(editPs, previewPs);
    }, 1000)
    const editorScrollHandler = () => {
      if (overridePreview) return

      if (!syncEnabled) return

      if (previewCalled) {
        previewCalled = false
        return
      }

      updateBlockPositions()

      const info = editor.getScrollInfo()
      const leftRatio = info.top / (info.height - info.clientHeight)

      const startIndex = findStartIndex(leftRatio, editPs)

      const rightRatio =
        ((leftRatio - editPs[startIndex]) *
          (previewPs[startIndex + 1] - previewPs[startIndex])) /
          (editPs[startIndex + 1] - editPs[startIndex]) +
        previewPs[startIndex]
      // const rightRatio = rightPs[startIndex]; // for testing

      previewEl.scrollTo(
        0,
        rightRatio * (previewEl.scrollHeight - previewEl.clientHeight)
      )
      editCalled = true
    }
    const previewScrollHandler = () => {
      if (overridePreview) return

      // find the current block in the view
      updateBlockPositions()
      currentBlockIndex = findStartIndex(
        previewEl.scrollTop / (previewEl.scrollHeight - previewEl.offsetHeight),
        previewPs
      )

      if (!syncEnabled) return

      if (editCalled) {
        editCalled = false
        return
      }

      const rightRatio =
        previewEl.scrollTop / (previewEl.scrollHeight - previewEl.clientHeight)

      const startIndex = findStartIndex(rightRatio, previewPs)

      const leftRatio =
        ((rightRatio - previewPs[startIndex]) *
          (editPs[startIndex + 1] - editPs[startIndex])) /
          (previewPs[startIndex + 1] - previewPs[startIndex]) +
        editPs[startIndex]

      if (isNaN(leftRatio)) {
        return
      }

      const info = editor.getScrollInfo()
      editor.scrollTo(0, leftRatio * (info.height - info.clientHeight))
      previewCalled = true
    }

    editor.on('scroll', editorScrollHandler)
    previewEl.addEventListener('scroll', previewScrollHandler, {
      passive: true,
    })

    // handle image drop and paste
    const handleImages = async (
      e: Event,
      itemList: DataTransferItemList | undefined
    ) => {
      if (!uploadImages) return

      const files = Array.from(itemList ?? [])
        .map((item) => {
          if (item.type.startsWith('image/')) {
            return item.getAsFile()
          }
        })
        .filter((f): f is File => f != null)

      if (files.length) {
        e.preventDefault() // important
        await handleImageUpload(context, uploadImages, files)
      }
    }

    editor.on('drop', async (_, e) => {
      handleImages(e, e.dataTransfer?.items)
    })
    editor.on('paste', async (_, e) => {
      handleImages(e, e.clipboardData?.items)
    })

    // @ts-ignore
    new ResizeObserver((entries) => {
      containerWidth = entries[0].contentRect.width
      // console.log(containerWidth);
    }).observe(root, { box: 'border-box' })

    // No need to call `on` because cm instance would change once after init
  })
  onDestroy(off)
</script>

<div
  class="bytemd"
  class:bytemd-split={split && activeTab === false}
  class:bytemd-fullscreen={fullscreen}
  bind:this={root}
>
  <Toolbar
    {context}
    {split}
    {activeTab}
    {sidebar}
    {fullscreen}
    rightAfferentActions={actions.rightActions}
    locale={mergedLocale}
    actions={actions.leftActions}
    on:key={(e) => {
      editor.setOption('keyMap', e.detail)
      editor.focus()
    }}
    on:tab={(e) => {
      const v = e.detail
      if (split) {
        activeTab = activeTab === v ? false : v
      } else {
        activeTab = v
      }

      if (activeTab === 'write') {
        tick().then(() => {
          editor && editor.focus()
        })
      }

      if (v === 'write') {
        tick().then(() => {
          // https://github.com/bytedance/bytemd/issues/232
          // https://github.com/codemirror/codemirror5/issues/3270
          editor && editor.setSize(null, null)
        })
      }
    }}
    on:click={(e) => {
      switch (e.detail) {
        case 'fullscreen':
          fullscreen = !fullscreen
          break
        case 'help':
          sidebar = sidebar === 'help' ? false : 'help'
          break
        case 'toc':
          sidebar = sidebar === 'toc' ? false : 'toc'
          break
      }
    }}
  />
  <div class="bytemd-body">
    <div class="bytemd-editor" style={styles.edit} bind:this={editorEl} />
    <div bind:this={previewEl} class="bytemd-preview" style={styles.preview}>
      {#if !overridePreview && (split || activeTab === 'preview')}
        <Viewer
          value={debouncedValue}
          {plugins}
          {sanitize}
          {remarkRehype}
          on:hast={(e) => {
            hast = e.detail.hast
            vfile = e.detail.file
          }}
        />
      {/if}
    </div>
    <div class="bytemd-sidebar" class:bytemd-hidden={sidebar === false}>
      <div
        class="bytemd-sidebar-close"
        on:click={() => {
          sidebar = false
        }}
        on:keydown|self={(e) => {
          if (['Enter', 'Space'].includes(e.code)) {
            sidebar = false
          }
        }}
      >
        {@html icons.Close}
      </div>
      <Help
        locale={mergedLocale}
        actions={actions.leftActions}
        visible={sidebar === 'help'}
      />
      <Toc
        {hast}
        locale={mergedLocale}
        {currentBlockIndex}
        on:click={(e) => {
          const headings = previewEl.querySelectorAll('h1,h2,h3,h4,h5,h6')
          headings[e.detail].scrollIntoView()
        }}
        visible={sidebar === 'toc'}
      />
    </div>
  </div>
  <Status
    locale={mergedLocale}
    showSync={!overridePreview && split}
    value={debouncedValue}
    {syncEnabled}
    islimited={value.length > maxLength}
    on:sync={(e) => {
      syncEnabled = e.detail
    }}
    on:top={() => {
      editor.scrollTo(null, 0)
      previewEl.scrollTo({ top: 0 })
    }}
  />
</div>
