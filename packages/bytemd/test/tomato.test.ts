import {
  getLineIndexByClass,
  getLineTextAfter,
  getLineTextAfterMulti,
  isFormatWillChange,
} from '../src/editor'
import { head } from 'lodash-es'
import { describe, test, expect } from 'vitest'

// 只处理单行问题, 为了简化
describe('getLineTextAfter', () => {
  const textBefore = 'Hello'
  test('+delete middle 光标在中间', () => {
    const change = {
      origin: '+delete',
      text: [''],
      from: { ch: 1 },
      to: { ch: 2 },
    }
    const textAfter = getLineTextAfter(textBefore, change)
    expect(textAfter).toBe('Hllo')
  })

  test('+delete end 光标在结尾', () => {
    const change = {
      origin: '+delete',
      text: [''],
      from: { ch: 4 },
      to: { ch: 5 },
    }
    const textAfter = getLineTextAfter(textBefore, change)
    expect(textAfter).toBe('Hell')
  })

  test('+input middle 在中间输入', () => {
    const change = {
      origin: '+input',
      text: ['T'],
      from: { ch: 2 },
      to: { ch: 2 },
    }
    const textAfter = getLineTextAfter(textBefore, change)
    expect(textAfter).toBe('HeTllo')
  })

  test('*compose middle 在中间输入中文', () => {
    const change = {
      origin: '*compose',
      text: [' '],
      from: { ch: 2 },
      to: { ch: 2 },
    }
    const textAfter = getLineTextAfter(textBefore, change)
    expect(textAfter).toBe('He llo')
  })

  test('+paste 粘贴单行', () => {
    const change = {
      origin: 'paste',
      text: ['T'],
      from: { ch: 2 },
      to: { ch: 2 },
    }
    const textAfter = getLineTextAfter(textBefore, change)
    expect(textAfter).toBe('HeTllo')
  })

  test('+paste begin 粘贴双行', () => {
    const change = {
      origin: 'paste',
      text: ['1', '2'],
      from: { ch: 0 },
      to: { ch: 0 },
    }
    const textAfter = getLineTextAfter(textBefore, change)
    expect(textAfter).toBe('1')
  })

  test('+paste middle 粘贴双行', () => {
    const change = {
      origin: 'paste',
      text: ['1', '2'],
      from: { ch: 2 },
      to: { ch: 2 },
    }
    const textAfter = getLineTextAfter(textBefore, change)
    expect(textAfter).toBe('He1')
  })

  test('+paste end 粘贴双行', () => {
    const change = {
      origin: 'paste',
      text: ['1', '2'],
      from: { ch: 5 },
      to: { ch: 5 },
    }
    const textAfter = getLineTextAfter(textBefore, change)
    expect(textAfter).toBe('Hello1')
  })

  test('+input 行首换行', () => {
    const change = {
      origin: '+input',
      text: ['', ''],
      from: { ch: 0 },
      to: { ch: 0 },
    }
    const textAfter = getLineTextAfter(textBefore, change)
    expect(textAfter).toBe('Hello')
  })

  test('+input 行中换行', () => {
    const change = {
      origin: '+input',
      text: ['', ''],
      from: { ch: 2 },
      to: { ch: 2 },
    }
    const textAfter = getLineTextAfter(textBefore, change)
    expect(textAfter).toBe('He')
  })
})

// 只处理多行问题, 为了简化
describe('getLineTextMulti', () => {
  const textUp = 'Hello'
  const textDown = 'down'
  test('+delete from: middle to: begin', () => {
    const change = {
      origin: '+delete',
      text: [''],
      from: { line: 0, ch: 3 },
      to: { line: 2, ch: 0 },
    }
    const textAfter = getLineTextAfterMulti(textUp, textDown, change)
    expect(textAfter).toBe('Heldown')
  })

  test('+delete from: end to: begin', () => {
    const change = {
      origin: '+delete',
      text: [''],
      from: { line: 0, ch: 5 },
      to: { line: 2, ch: 0 },
    }
    const textAfter = getLineTextAfterMulti(textUp, textDown, change)
    expect(textAfter).toBe('Hellodown')
  })

  test('+delete from: begin to: middle', () => {
    const change = {
      origin: '+delete',
      text: [''],
      from: { line: 0, ch: 0 },
      to: { line: 2, ch: 2 },
    }
    const textAfter = getLineTextAfterMulti(textUp, textDown, change)
    expect(textAfter).toBe('wn')
  })

  test('+delete from: middle to: middle', () => {
    const change = {
      origin: '+delete',
      text: [''],
      from: { line: 0, ch: 2 },
      to: { line: 2, ch: 2 },
    }
    const textAfter = getLineTextAfterMulti(textUp, textDown, change)
    expect(textAfter).toBe('Hewn')
  })

  test('+delete from: end to: middle', () => {
    const change = {
      origin: '+delete',
      text: [''],
      from: { line: 0, ch: 5 },
      to: { line: 2, ch: 2 },
    }
    const textAfter = getLineTextAfterMulti(textUp, textDown, change)
    expect(textAfter).toBe('Hellown')
  })

  test('+delete from: begin to: end', () => {
    const change = {
      origin: '+delete',
      text: [''],
      from: { line: 0, ch: 0 },
      to: { line: 2, ch: 4 },
    }
    const textAfter = getLineTextAfterMulti(textUp, textDown, change)
    expect(textAfter).toBe('')
  })

  test('paste from: begin to: middle 粘贴单行', () => {
    const change = {
      origin: 'paste',
      text: ['X'],
      from: { line: 0, ch: 0 },
      to: { line: 2, ch: 2 },
    }
    const textAfter = getLineTextAfterMulti(textUp, textDown, change)
    expect(textAfter).toBe('Xwn')
  })

  test('paste from: begin to: middle 粘贴多行', () => {
    const change = {
      origin: 'paste',
      text: ['1', '2'],
      from: { line: 0, ch: 0 },
      to: { line: 2, ch: 2 },
    }
    const textAfter = getLineTextAfterMulti(textUp, textDown, change)
    expect(textAfter).toBe('1')
  })
})

describe('isFormatWillChange', () => {
  const header = '# header'
  const p = 'para'
  test('从header到p', () => {
    expect(isFormatWillChange(header, p)).toBeTruthy()
    expect(isFormatWillChange(p, header)).toBeTruthy()
    expect(isFormatWillChange(p, p)).toBeFalsy()
    expect(isFormatWillChange(header, header)).toBeFalsy()
  })
})

describe('utils系列', () => {
  test('getLineIndexByClass', () => {
    expect(getLineIndexByClass('lineIndex-3')).toBe(3)
    expect(getLineIndexByClass('')).toBe(undefined)
    expect(getLineIndexByClass()).toBe(undefined)
  })
})
