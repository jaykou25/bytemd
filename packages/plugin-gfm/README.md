# @bytemd/plugin-gfm

[![npm](https://img.shields.io/npm/v/@bytemd/plugin-gfm.svg)](https://npm.im/@bytemd/plugin-gfm)

ByteMD plugin to support GFM (autolink literals, strikethrough, tables, tasklists)

## Usage

```js
import gfm from '@bytemd/plugin-gfm'
import { Editor } from 'bytemd'

new Editor({
  target: document.body,
  props: {
    plugins: [
      gfm(),
      // ... other plugins
    ],
  },
})
```

## License

MIT
