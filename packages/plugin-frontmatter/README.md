# @bytemd/plugin-frontmatter

[![npm](https://img.shields.io/npm/v/@bytemd/plugin-frontmatter.svg)](https://npm.im/@bytemd/plugin-frontmatter)

ByteMD plugin to parse frontmatter

## Usage

```js
import frontmatter from '@bytemd/plugin-frontmatter'
import { Editor } from 'bytemd'

new Editor({
  target: document.body,
  props: {
    plugins: [
      frontmatter(),
      // ... other plugins
    ],
  },
})
```

## License

MIT
