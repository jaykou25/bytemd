<script lang="ts">
  import { Editor } from '../../packages/bytemd/src/index.ts'
  import markdownText from './text2.md?raw'
  import breaks from '@bytemd/plugin-breaks'
  import frontmatter from '@bytemd/plugin-frontmatter'
  import gemoji from '@bytemd/plugin-gemoji'
  import gfm from '@bytemd/plugin-gfm'
  import highlight from '@bytemd/plugin-highlight'
  // import { Editor } from 'bytemd'
  // import 'bytemd/dist/index.css'
  import 'github-markdown-css'
  import 'highlight.js/styles/vs.css'
  // placed after highlight styles to override `code` padding
  import 'katex/dist/katex.css'
  import { onMount } from 'svelte'

  const lienInfoStriing =
    '{"f0926ca0-b7cd-11ed-a5a0-ff605626239b":0,"8d086660-b7f2-11ed-a5a0-ff605626239b":74,"6568fbf0-b8d4-11ed-afed-cb51a3c89613":80,"b9d3f422-b80b-11ed-9a3a-cb43db96bcea":88,"66ba8230-b8d4-11ed-afed-cb51a3c89613":108}'

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

  let value = markdownText
  let mode = 'tab'
  let localeKey = 'en'
  let maxLength: number

  // let tomatoLineInfo = JSON.parse(lienInfoStriing)
  let tomatoLineInfo = {
    uuid0: 0,
    uuid271: 271,
  }
  let tomatoCountInfo = {
    // uuid0: 1,
    // uuid2: 2,
    // uuid271: 271,
    // '8d086660-b7f2-11ed-a5a0-ff605626239b': 1,
    // 'b9d3f422-b80b-11ed-9a3a-cb43db96bcea': 5,
    // 'f0926ca0-b7cd-11ed-a5a0-ff605626239b': 6,
  }

  let playingUuid

  $: plugins = [
    breaks(),
    frontmatter(),
    gemoji(),
    gfm({
      locale: gfmLocales[localeKey],
    }),
    highlight(),
  ].filter((x) => x)

  onMount(() => {
    setTimeout(() => {
      tomatoCountInfo = {
        uuid0: 1,
        // uuid2: 2,
        uuid271: 271,
        '8d086660-b7f2-11ed-a5a0-ff605626239b': 1,
        'b9d3f422-b80b-11ed-9a3a-cb43db96bcea': 5,
        'f0926ca0-b7cd-11ed-a5a0-ff605626239b': 6,
      }
      // tomatoCountInfo = {
      //   '8d086660-b7f2-11ed-a5a0-ff605626239b': 1,
      //   'b9d3f422-b80b-11ed-9a3a-cb43db96bcea': 5,
      //   'f0926ca0-b7cd-11ed-a5a0-ff605626239b': 6,
      // }
    }, 3300)
  })
</script>

<div class="container">
  <Editor
    {value}
    {mode}
    {plugins}
    {maxLength}
    {tomatoLineInfo}
    {tomatoCountInfo}
    {playingUuid}
    editorConfig={{ firstLineNumber: 0 }}
    placeholder={'Start writing with ByteMD'}
    locale={locales[localeKey]}
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
      value = e.detail.value
    }}
    on:play={(e) => {
      console.log('play', e.detail.value)
      const { uuid } = e.detail.value
      playingUuid = uuid

      setTimeout(() => {
        playingUuid = ''
        // 更新tomatoCountInfo
        const copy = { ...tomatoCountInfo }
        if (copy[uuid]) {
          copy[uuid] += 1
        } else {
          copy[uuid] = 1
        }
        tomatoCountInfo = copy
        // localStorage.setItem('tomatoCountInfo', JSON.stringify(copy))
      }, 3000)
    }}
    on:tomatoLineInfoChange={(e) => {
      console.log('LineInfoChange', e.detail.value)

      tomatoLineInfo = { ...e.detail.value }
    }}
  />
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
  }
  .line {
    margin: 10px 0;
    text-align: center;
  }
  :global(body) {
    margin: 0 10px;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial,
      sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
  }
  :global(.bytemd) {
    height: calc(100vh - 100px);
  }
  :global(.medium-zoom-overlay) {
    z-index: 100;
  }
  :global(.medium-zoom-image--opened) {
    z-index: 101;
  }
</style>
