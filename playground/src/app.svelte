<script lang="ts">
  import { Editor } from '../../packages/bytemd/src/index.ts'
  import markdownText from './text-header.md?raw'
  import breaks from '@bytemd/plugin-breaks'
  import frontmatter from '@bytemd/plugin-frontmatter'
  import gemoji from '@bytemd/plugin-gemoji'
  import gfm from '@bytemd/plugin-gfm'
  import highlight from '@bytemd/plugin-highlight'
  import math from '@bytemd/plugin-math'
  import mediumZoom from '@bytemd/plugin-medium-zoom'
  import mermaid from '@bytemd/plugin-mermaid'
  // import { Editor } from 'bytemd'
  // import 'bytemd/dist/index.css'
  import 'github-markdown-css'
  import 'highlight.js/styles/vs.css'
  // placed after highlight styles to override `code` padding
  import 'katex/dist/katex.css'
  import { onMount } from 'svelte'

  function stripPrefixes(obj: Record<string, any>) {
    return Object.entries(obj).reduce((p, [key, value]) => {
      p[key.split('/').slice(-1)[0].replace('.json', '')] = value
      // console.log(p)
      return p
    }, {} as Record<string, any>)
  }

  const locales = stripPrefixes(
    import.meta.glob('/node_modules/bytemd/locales/*.json', { eager: true })
  )
  const gfmLocales = stripPrefixes(
    import.meta.glob('/node_modules/@bytemd/plugin-gfm/locales/*.json', {
      eager: true,
    })
  )
  const mathLocales = stripPrefixes(
    import.meta.glob('/node_modules/@bytemd/plugin-math/locales/*.json', {
      eager: true,
    })
  )
  const mermaidLocales = stripPrefixes(
    import.meta.glob('/node_modules/@bytemd/plugin-mermaid/locales/*.json', {
      eager: true,
    })
  )

  let value = ''
  let mode = 'tab'
  let localeKey = 'en'
  let maxLength: number

  let enabled = {
    breaks: false,
    frontmatter: true,
    gemoji: true,
    gfm: true,
    highlight: true,
    math: true,
    'medium-zoom': true,
    mermaid: true,
  }

  let tomatoLineInfo = undefined
  let tomatoCountInfo = undefined

  let playingUuid = 'uuid1'
  let todoName = 'hi'
  let status

  $: plugins = [
    enabled.breaks && breaks(),
    enabled.frontmatter && frontmatter(),
    enabled.gemoji && gemoji(),
    enabled.gfm &&
      gfm({
        locale: gfmLocales[localeKey],
      }),
    enabled.highlight && highlight(),
    enabled.math &&
      math({
        locale: mathLocales[localeKey],
        katexOptions: { output: 'html' }, // https://github.com/KaTeX/KaTeX/issues/2796
      }),
    enabled['medium-zoom'] && mediumZoom(),
    enabled.mermaid &&
      mermaid({
        locale: mermaidLocales[localeKey],
      }),
  ].filter((x) => x)

  onMount(() => {
    const arr = [undefined, 'loading', 'saved', 'failed']
    let index = 0
    setInterval(() => {
      status = arr[index % 4]
      index++
    }, 3000)
  })

  // 模拟接口请求
  setTimeout(() => {
    value = localStorage.getItem('mdText') || markdownText

    tomatoLineInfo = localStorage.getItem('tomatoLineInfo')
      ? JSON.parse(localStorage.getItem('tomatoLineInfo'))
      : {
          uuid1: 0,
          // uuid2: 2,
        }
  }, 2000)

  setTimeout(() => {
    tomatoCountInfo = localStorage.getItem('tomatoCountInfo')
      ? JSON.parse(localStorage.getItem('tomatoCountInfo'))
      : {
          uuid1: 1,
          // uuid2: 2,
        }
  }, 3200)
</script>

<div id="root">
  <Editor
    {value}
    {mode}
    {plugins}
    {maxLength}
    {tomatoLineInfo}
    {tomatoCountInfo}
    {playingUuid}
    {todoName}
    placeholder={'Start writing with ByteMD'}
    locale={locales[localeKey]}
    {status}
    uploadImages={(files) => {
      return Promise.all(
        files.map((file) => {
          // TODO:
          return {
            url: 'https://picsum.photos/300',
          }
        })
      )
    }}
    on:change={(e) => {
      console.log('onchange')
      value = e.detail.value

      localStorage.setItem('mdText', value)
    }}
    on:play={(e) => {
      console.log('play', e.detail.value)
      const { uuid } = e.detail.value
      playingUuid = uuid

      // setTimeout(() => {
      //   playingUuid = ''
      //   // 更新tomatoCountInfo
      //   const copy = { ...tomatoCountInfo }
      //   if (copy[uuid]) {
      //     copy[uuid] += 1
      //   } else {
      //     copy[uuid] = 1
      //   }
      //   tomatoCountInfo = copy
      //   localStorage.setItem('tomatoCountInfo', JSON.stringify(copy))
      // }, 130000)
    }}
    on:tomatoLineInfoChange={(e) => {
      console.log('LineInfoChange', e.detail.value)

      tomatoLineInfo = { ...e.detail.value }
      localStorage.setItem('tomatoLineInfo', JSON.stringify(e.detail.value))
    }}
  />
</div>

<style>
  :global(body) {
    margin: 0;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;

    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial,
      sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
  }
  :global(#root) {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  :global(.medium-zoom-overlay) {
    z-index: 100;
  }
  :global(.medium-zoom-image--opened) {
    z-index: 101;
  }
</style>
