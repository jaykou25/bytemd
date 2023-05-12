<svelte:options immutable={true} />

<script lang="ts">
  import en from '../locales/en.json'
  import {
    createCodeMirror,
    createEditorUtils,
    findStartIndex,
    getBuiltinActions,
    handleImageUpload,
    getUuidByClass,
    showPlaying,
    hidePlaying,
    syncTomatoWidget,
    getMultiLineInfo,
    updateLineIndex,
    updateTomatoLineInfo2,
    lineChangeHasPlayingUuid,
  } from './editor'
  import Toolbar from './toolbar.svelte'
  import type {
    BytemdEditorContext,
    BytemdPlugin,
    EditorProps as Props,
  } from './types'
  import { isAndroid, isIos } from './utils'
  import weui from './weuisimple'
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
  export let tomatoLineInfo: any = {}
  export let tomatoCountInfo: any = {}
  export let playingUuid: string | undefined
  export let status: 'loading' | 'saved' | 'failed' | undefined
  export let todoName: string | undefined = undefined

  $: mergedLocale = { ...en, ...locale }
  const dispatch = createEventDispatcher<{
    change: { value: string }
    play: { value: { text?: string; uuid?: string } }
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

  // 这里的顺序是重要的
  $: if (editor && value !== editor.getValue()) {
    editor.setValue(value)
  }

  $: if (editor) {
    console.log('更新line相关')
    updateLineIndex(editor.getDoc(), value)
    /**
     2023.3.3 
     在react端使用这个应用, 然后监听它内部的事件:
     步骤1
     const editor = new bytemd.Editor({
      target: 'dom',
      props: {value}
     })

     步骤2
     editor.$on('tomatoLineInfoChange', () => {
     })

     很奇怪的是在步骤2 建立事件监听之前, dispatch就已经触发了
     它的执行顺序是:
     1. onMount
     2. endMount
     3. 执行响应式语句, $: somthing
     4. 步骤2

     所以要在第3步的语句里加入tick(), tick里的语句会有第4步之后再执行. 
    */
    tick().then(() => {
      console.log('更新tomatoLineInfo2')
      updateTomatoLineInfo2(
        value,
        plugins,
        editor.getDoc(),
        tomatoLineInfo,
        dispatch
      )
    })
  }

  $: if (editor) {
    console.log('同步tomatoWidget')
    syncTomatoWidget(editor.getDoc(), tomatoLineInfo, tomatoCountInfo)

    if (playingUuid) {
      console.log('showPlaying')
      showPlaying(editor.getDoc(), playingUuid)
    } else {
      hidePlaying(editor.getDoc())
    }
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
    // console.log('off', plugins)
    cbs.forEach((cb) => cb && cb())

    editor?.removeKeyMap(keyMap) // onDestroy runs at SSR, optional chaining here
  }

  const handlePlay = (e: any) => {
    const btn = e.target?.closest('.linewidget-playbtn')
    if (btn) {
      const uuid = getUuidByClass(btn.className)
      const text = btn.parentNode.querySelector('.CodeMirror-line').innerText
      dispatch('play', { value: { uuid, text } })
    }
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
      // lineNumbers: true,
    })

    console.log('svelte onmount:', { value, tomatoLineInfo })

    // 监听click事件
    document
      .querySelector('.CodeMirror-code')
      ?.addEventListener('click', handlePlay)

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

      /**
       * 如果改变行正好是正在番茄中的行, 请发出警告, 并取消改动
       */
      if (lineChangeHasPlayingUuid(ins, change, playingUuid)) {
        change.cancel()
        weui.toast('不能破坏正在番茄中的段落!', {
          duration: 2000,
          className: 'top-toast-no-icon',
        })

        return
      }

      // !处理行上有番茄的情况
      // 多行删除要考虑末行dom移除问题.
      // 1. 首行全删除 -> 末行到0位 :末行不会删dom
      //              -> 末行非0位 :末行会删!
      // 2. 首行没全删除 -> 末行都会删!
      const { hasTomatoCount, tomatoLineInfo } = getMultiLineInfo(ins, change)

      if (hasTomatoCount) {
        // const lines = tomatoLineInfo
        //   .map(
        //     (info, index) =>
        //       `<tr><td>${index + 1}</td><td class="t-text">${
        //         info.text
        //       }</td><td>${info.count}</td></tr>`
        //   )
        //   .join('')
        // const confirmText = `<table><tr><td class="t-index">序号</td><td class="t-text">段落内容</td><td class="t-count">蕃茄数</td></tr>${lines}</table>`

        /**
         * codeMirror5 中默认mobile端的inputStyle是contenteditable
         * pc端上是一个隐藏的textarea
         */
        const codeEditor: HTMLElement | null = document.querySelector(
          ".CodeMirror-code[contenteditable='true']"
        )

        codeEditor?.blur()

        weui.confirm(
          '此操作会移除段落上的番茄数据',
          () => {
            codeEditor?.focus()
            ins.state.isConfirm = true
            ins.replaceRange(
              text,
              { line: fromLine, ch: fromCh },
              { line, ch },
              origin
            )
          },
          () => {
            codeEditor?.focus()
          }
        )

        change.cancel()
      }
    })

    editor.on('change', (ins, change) => {
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

    const toolbar: HTMLElement | null = document.querySelector('.toolbar')
    const vp = window.visualViewport
    let startY = 0
    let endY = 0
    const editorBody: any = document.querySelector('.bytemd-body')
    const container: any = document.querySelector('.container')
    const safe: any = document.querySelector('.safe')
    const screenHeight = vp?.height || 0
    let keyboardHeight = 0

    editor.on('focus', (e) => {
      console.log('focusd', e)
      // if (editorBody) {
      //   editorBody.scrollTop = 0
      // }
    })

    // editor.on('blur', () => {
    //   bottomBar.style.display = 'none'
    // })

    // document.addEventListener('scroll', function () {
    //   const offset = window.scrollY
    //   window.scrollTo(0, 0)
    //   container.scrollTop = container.scrollTop + offset
    // })

    // 如果光标被遮挡, 滚动container使其显现在视口
    const showCursorInViewport = (lineNum: number) => {
      const lineDom = document.querySelector(`.lineIndex-${lineNum}`)
      if (lineDom) {
        const lineRect = lineDom?.getBoundingClientRect()
        // 光标和toolbar上边的差值. 小于0说明光标被遮挡
        const offset = screenHeight - lineRect.y - (keyboardHeight + 50)

        // 光标和header底部的差值. 小于0说明被header遮挡
        const offsetTop = lineRect.y - 48

        // console.log('showCursorInViewport', {
        //   y: lineRect.y,
        //   screenHeight,
        //   keyboardHeight,
        //   offset,
        //   offsetTop,
        // })
        if (offset <= 0) {
          console.log('光标遮挡', { offset, lineHeight: lineRect.height })
          // window.scrollTo(0, 0)
          container.scrollBy(0, -offset + lineRect.height)
          return
        }

        if (offsetTop <= 0) {
          container.scrollBy(0, offsetTop - lineRect.height)
          return
        }
      }
    }

    editor.on('viewportChange', function (ins, from, to) {
      console.log('viewportChange')
      const lineNum = ins.getCursor().line
      const lineDom = document.querySelector(`.lineIndex-${lineNum}`)
      const lineRect = lineDom?.getBoundingClientRect()
      // 判断光标位置是否在toolbar下面
      if (lineDom) {
        showCursorInViewport(lineNum)
      } else {
        /**
         * 如果viewportChange导制新行的产生, 那么新行的dom不能立马获取到
         */
        setTimeout(() => {
          showCursorInViewport(lineNum)
        }, 10)
      }
    })

    if (isAndroid() && vp) {
      vp.addEventListener('resize', function () {
        keyboardHeight = screenHeight - vp.height
        console.log('android', { keyboardHeight, vpHeight: vp.height })
        if (keyboardHeight > 0) {
          if (toolbar) {
            toolbar.style.display = 'block'
          }
          const lineNum = editor.getCursor().line
          setTimeout(() => {
            showCursorInViewport(lineNum)
          }, 100)
        } else {
          if (toolbar) toolbar.style.display = 'none'
        }
      })
    }

    if (isIos() && vp) {
      vp.addEventListener('resize', function () {
        console.log('container scrollTop', container.scrollTop)
        console.log('body scrolltop', document.body.scrollTop)

        // container.scrollTop = 100;

        keyboardHeight = screenHeight - vp.height
        console.log('keyboardHeight', {
          keyboardHeight,
          screenHeight,
          vpHeight: vp.height,
        })
        if (keyboardHeight > 0) {
          if (toolbar) {
            toolbar.style.display = 'block'
            toolbar.style.bottom = `${keyboardHeight - 1}px`
          }

          const offset = window.scrollY
          console.log('在调整前的scrollY', offset)

          if (offset < 100) {
            document.documentElement.scrollTop = 1
            window.scrollBy(0, -2)
          } else {
            document.documentElement.scrollTop = 0
          }

          const lineNum = editor.getCursor().line
          setTimeout(() => {
            showCursorInViewport(lineNum)
          }, 100)

          safe.style.height = `${vp.height}px`
          safe.style.marginBottom = `${keyboardHeight}px`
        } else {
          if (toolbar) toolbar.style.display = 'none'
          safe.style.height = '200px'
          safe.style.marginBottom = 0
        }
      })

      document.body.addEventListener('touchstart', function (e) {
        startY = e.touches[0].pageY
      })

      if (isIos()) {
        document.body.addEventListener(
          'touchmove',
          function (e) {
            if (e.target && (e.target as HTMLElement).closest('.safe')) {
              endY = e.changedTouches[0].pageY
              if (endY - startY > 0) {
                console.log('手指往下')
              } else {
                console.log('手指往上')
                e.preventDefault()
              }
            }
          },
          { passive: false, capture: true }
        )
      }
    }

    console.log('end of onMount')

    // No need to call `on` because cm instance would change once after init
  })
  onDestroy(() => {
    off()
    document
      .querySelector('.CodeMirror-code')
      ?.removeEventListener('click', handlePlay)
  })

  console.log('end of script')
</script>

<div
  class="bytemd outline"
  class:bytemd-split={split && activeTab === false}
  class:bytemd-fullscreen={fullscreen}
  bind:this={root}
>
  <div class="header">
    <div class="status-area">
      {#if status === 'failed'}
        <i class="iconfont icon-alert-circle-outline alertIcon" />
        <span>保存失败, 请检查网络</span>
      {:else if status === 'loading'}
        <i class="iconfont icon-sync-outline syncIcon" />
        <span>正在保存...</span>
      {:else if status === 'saved'}
        <i class="iconfont icon-checkmark-circle-outline doneIcon" />
        <span>保存成功</span>
      {:else}
        <span>内容将自动保存</span>
      {/if}
    </div>
    {#if todoName}
      <div class="right-area">
        <div>
          <span class="headerPlaying" />
          <span>{todoName}</span>
        </div>
      </div>
    {/if}
  </div>
  <div class="bytemd-body container">
    <div class="bytemd-editor" style={styles.edit} bind:this={editorEl} />
    <div class="safe">蕃茄拾光</div>
  </div>
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
</div>
