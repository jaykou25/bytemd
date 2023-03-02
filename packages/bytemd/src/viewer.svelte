<svelte:options immutable={true} />

<script lang="ts">
  import { getUuidByClass, reverseTomatoLineInfo } from './editor'
  import type { BytemdPlugin, ViewerProps as Props } from './types'
  import { getProcessor } from './utils'
  import type { Root } from 'hast'
  import {
    tick,
    onDestroy,
    onMount,
    createEventDispatcher,
    afterUpdate,
  } from 'svelte'
  import type { Plugin } from 'unified'
  import { visit } from 'unist-util-visit'
  import type { VFile } from 'vfile'

  const dispatch = createEventDispatcher<{
    hast: { hast: Root; file: VFile }
    viewerPlay: { text?: string; uuid?: string }
  }>()

  export let value: Props['value'] = ''
  export let plugins: NonNullable<Props['plugins']> = []
  export let sanitize: Props['sanitize'] = undefined
  export let remarkRehype: Props['remarkRehype'] = undefined
  export let tomatoLineInfo: Props['tomatoLineInfo'] = {}
  export let tomatoCountInfo: Props['tomatoCountInfo'] = {}

  let markdownBody: HTMLElement
  let cbs: ReturnType<NonNullable<BytemdPlugin['viewerEffect']>>[] = []

  function on() {
    // console.log('von')
    cbs = plugins.map((p) => p.viewerEffect?.({ markdownBody, file }))
  }
  function off() {
    // console.log('voff')
    cbs.forEach((cb) => cb?.())
  }

  onMount(() => {
    markdownBody.addEventListener('click', (e) => {
      const $ = e.target as HTMLElement
      // 处理play事件
      const btn = $?.closest('.line-playbtn')
      if (btn) {
        const uuid = getUuidByClass(btn.className)
        const text = btn.parentNode?.innerText
        dispatch('viewerPlay', { uuid, text })
      }

      if ($.tagName !== 'A') return

      const href = $.getAttribute('href')
      if (!href?.startsWith('#')) return

      markdownBody
        .querySelector('#user-content-' + href.slice(1))
        ?.scrollIntoView()
    })
  })

  onDestroy(off)

  let file: VFile
  let i = 0

  const dispatchPlugin: Plugin<any[], Root> = () => (tree, file) => {
    tick().then(() => {
      // console.log(tree);
      dispatch('hast', { hast: tree, file })
    })
  }

  $: try {
    file = getProcessor({
      sanitize,
      plugins: [
        ...plugins,
        {
          rehype: (processor) => {
            return processor.use(() => {
              return (tree) => {
                const lineUuidMap = reverseTomatoLineInfo(tomatoLineInfo)
                visit(tree, 'element', (node) => {
                  if (/^h[123456]/.test(node.tagName)) {
                    const {
                      position: {
                        start: { line },
                      },
                    } = node
                    const lineIndex = line - 1
                    const uuid = lineUuidMap[lineIndex]
                    const count = tomatoCountInfo[uuid] || 0
                    node.properties.className = `line-wrapper playbtn_${uuid} tomatoCount-${count}`

                    const countNode = {
                      type: 'element',
                      tagName: 'div',
                      children: [
                        {
                          type: 'element',
                          tagName: 'span',
                          children: [
                            {
                              type: 'text',
                              value: count ? count.toString() : '',
                            },
                          ],
                        },
                      ],
                      properties: { className: ['line-tomatocount'] },
                    }

                    const playNode = {
                      type: 'element',
                      tagName: 'div',
                      properties: {
                        className: ['line-playbtn', `playbtn_${uuid}`],
                      },
                      children: [
                        {
                          type: 'element',
                          tagName: 'span',
                          properties: { className: 'playBtn' },
                          children: [
                            {
                              type: 'element',
                              tagName: 'svg',
                              properties: {
                                height: '24',
                                viewBox: '0 0 24 24',
                                width: '24',
                                xmlns: 'http://www.w3.org/2000/svg',
                              },
                              children: [
                                {
                                  type: 'element',
                                  tagName: 'path',
                                  properties: {
                                    d: 'M0 0h24v24H0z',
                                    fill: 'none',
                                  },
                                },
                                {
                                  type: 'element',
                                  tagName: 'path',
                                  properties: {
                                    d: 'M7.752 5.439l10.508 6.13a.5.5 0 0 1 0 .863l-10.508 6.13A.5.5 0 0 1 7 18.128V5.871a.5.5 0 0 1 .752-.432z',
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    }

                    node.children.push(countNode)
                    node.children.push(playNode)
                  }
                })
              }
            })
          },
        },
        {
          // remark: (p) =>
          //   p.use(() => (tree) => {
          //     console.log(tree)
          //   }),
          rehype: (processor) => processor.use(dispatchPlugin),
        },
      ],
      remarkRehype,
    }).processSync(value)
    i++
  } catch (err) {
    console.error(err)
  }

  afterUpdate(() => {
    // TODO: `off` should be called before DOM update
    // https://github.com/sveltejs/svelte/issues/6016
    off()
    on()
  })

  $: html = `${file}<!--${i}-->`
</script>

<div bind:this={markdownBody} class="markdown-body">
  {@html html}
</div>
