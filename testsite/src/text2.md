## 解析流程

1. 先将 markdown 文字解析成 AST
   > 用 remarkParse 可以将 md 文字转化成 AST 树
2. markdown AST 可以通过 remark 插件来转化
   > bytemd 把 plugins 传进 viewer 组件. 那 plugins 是什么? 以 plugin-breaks 为例, plugin-breaks 是一个函数, 返回一个对象

```js
import remarkBreaks from 'remark-breaks'
return {
    remark: (processor) => processor.use(remarkBreaks),
  }
```

本质上就是使用`processor.use(remarkBreaks)`, 那 remarkBreaks 是什么?

> 参考下面的 plugins, 本质上是一个函数, 参数是 tree 和 file 3. markdown AST 转化成 HTML AST 通过 remarkRehype 插件, 在这里可以传入 options, 比如 handlers, 具体 handlers 怎么用还没有实践. 4. sanitize HTML AST [hast-util-sanitize](https://github.com/syntax-tree/hast-util-sanitize) hast utility to make trees safe.

它会导出 sanitize 函数用于净化 tree, 使用一个 defaultSchema 规则.

```js
import deepmerge from 'deepmerge'
// You can use `structuredClone` in modern JS.
import { sanitize, defaultSchema } from 'hast-util-sanitize'
import { h } from 'hastscript'

const schema = deepmerge(defaultSchema, { attributes: { '*': ['className'] } })

const tree = sanitize(h('div', { className: ['foo'] }), schema)

// `tree` still has `className`.
console.log(tree)
// {
//   type: 'element',
//   tagName: 'div',
//   properties: {className: ['foo']},
//   children: []
// }
```

5. HTML AST 可以通过 rehype plugins 进行转换. bytemd 把这些插件都做成了独立的包, 在使用层把插件传进去. 比如我们要给 HTML AST 的 node 增加属性. 可以自已写一个插件. 在使用层的插件其实就是一个对象, 里面是一个函数, 参数是 processor, 返回 processor.use()

6. HTML AST stringify to HTML 把 tree serialize 成 html string

- [x] 在上步除了改 class, 还可以把相关 dom 插到 tree 里一个 svg 如何插到 tree 里? 可以把 svg 转化成 tree

```js
{
  type: 'element',
  tagName: 'svg',
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
```

- [ ] 把 svg 转化成 tree 有点麻烦, 也可以用 iconFont

7. 在 HTML 渲染后的额外 DOM 操作

## PlayingUuid

观察 playingUuid, 如果有值`showPlaying(editor.getDoc(), playingUuid)`, 如果没有值`hidePlaying()`

但是在 viewer 层面, playing 图标应该放在上文的第 7 步中. 也就是 viewerEffect 里

## TomatoWidget 流程

在这里梳理一下 tomatoWidgets 的流程, 感觉有 bug.

在 onMount 里触发 syncTomatoWidget, 在监听里也触发 syncTomatoWidget. syncTomatoWidget 是作用是移除或添加 widget.

在监听里还有一个方法是 syncTomatoCount, 它的作用是更新 count 数

## TomatoInfo 的更新逻辑

`tomatoLineInfo: {[uuid]: lineIndex }` `tomatoCountInfo: {[uuid]: number}` `updateTomatoLineInfo`方法用于更新 tomatoLineInfo

这个方法目前在多处用到, 可否像 syncTomatoWidget 一样, 放在监听里面?

> 放在 afterUpdate 里放多次执行放在监听里监听 value?

1. 初次渲染时 onMount
2. on('viewportChange')
3. 多行删除后 (~~widget 还在~~)
4. 输入文字后

重构后三个方法都放在监听里:

1. updateTomatoLineInfo(先生成 info)
2. syncTomatoWidget(遍历 doc.eachLine, 利用 tomatoLineInfo, 加减 widget)
3. syncTomatoCount(根据 countinfo 的变化来更新 count)

## Viewer

| 属性         |     | 备注             |
| ------------ | --- | ---------------- |
| value        |     |
| plugins      |     |
| sanitize     |     |
| remarkRehype |     | 从 editor 传进来 |

用函数`getProcessor().processSync(value)`将 md 文字转成 html 文字

## unified

unified 似乎是一个处理内容的通用平台. 它本身不能处理内容, 需要靠不同的插件来处理.

```js
const file = await unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeDocument, { title: '👋🌍' })
  .use(rehypeFormat)
  .use(rehypeStringify)
  .process('# Hello world!')

console.error(reporter(file))
console.log(String(file))
```

## remark

remark 是比 unified 更低一级的 AST 处理工具, 针对的是 md 格式.

### 使用 remark 转化成树

```js
import remarkParse from 'remark-parse'
import { unified } from 'unified'

function main() {
  const processor = unified().use(remarkParse)

  const md = `# header1
  para
  ## header2
  \`\`\`js
  const jay = 'hi'
  \`\`\`
  ### header3
  `

  const tree = processor.parse(md)
  console.log(tree)
}

main()
```

仅仅使用 remarkParse 可以将 md 文字转化成 tree

```js
{
  children: [
    {
      type: "heading",
      depth: 1,
      position: {
        start: {
          column: 1,
          line: 1,
          offset: 0
        },
        end: {
          column: 10,
          line: 1,
          offset: 9
        },
      },
    },
    // code block
    {
      lang: 'js',
      meta: null,
      type: 'code',
      value: 'const jay = hi',
      position: {
        start: {
          column: 3,
          line: 4,
          offset: 32
        },
        end: {
          column: 6,
          line: 6,
          offset: 62
        },
    }
  ],
  position: Object,
  type: "root"
}
```

现在这颗树里含有 md 文字里的位置信息, 也就是说我可以把行上的 uuid, tomatoCount 等信息传给 tree.

### mdast

mdast 是描述 markdown 树的一个规范. 我想看看它能携带一些额外信息吗?

规范里只是描述了各种类型所必备的字段. 比如 header 就只要`level`字段, 而其它的类型可能需要的是其它的字段. 因为它只是一颗树, 我想其它信息我可以自已添加进去.

```js
import { visit } from 'unist-util-visit'

visit(tree, 'heading', (node, index) => {
  node.uuid = index
  node.tomatoCount = 5
})
```

### 将 mdast 转化成 hast

[mdast-util-to-hast](https://github.com/syntax-tree/mdast-util-to-hast) 上文的 tree 携带了额外的 uuid 和 tomatoCount, 但是转化成 hast 后, 信息丢失了. 但是幸运的是 position 信息还在, 也就是说上文的额外信息可以直接在 hast 这一层添加上去.

```js
import { toHast } from 'mdast-util-to-hast'

const htmlTree = toHast(tree)
```

```js
{
  type: "root",
  children: [
    {
      tagName: "h1",
      type: "element",
      properties: {}
    }
  ]
}
```

💡 toHast 支持 handler 函数,

### plugins

plugins 可以改变 prosessor, 它主要用来搞定 trees 和 files

#### 如何写一个 unified 插件

本质是一个函数,参数是 tree 和 file

```js
export default function retextSentenceSpacing() {
   return (tree, file) => {
+    visit(tree, 'ParagraphNode', (node) => {
+      console.log(node)
+    })
   }
 }
```

💡 那 tree 和 file 是什么?

## rehype
