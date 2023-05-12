/*! For license information please see weui.min.js.LICENSE.txt */
var t = {
    679: function (t, e) {
      var n, o
      ;(o = (function (t, e, n) {
        function o(i, r, a) {
          return (
            (a = Object.create(o.fn)),
            i &&
              a.push.apply(
                a,
                i[e]
                  ? [i]
                  : '' + i === i
                  ? /</.test(i)
                    ? (((r = t.createElement(r || e)).innerHTML = i),
                      r.children)
                    : r
                    ? (r = o(r)[0])
                      ? r[n](i)
                      : a
                    : t[n](i)
                  : 'function' == typeof i
                  ? t.readyState[7]
                    ? i()
                    : t[e]('DOMContentLoaded', i)
                  : i
              ),
            a
          )
        }
        return (
          (o.fn = []),
          (o.one = function (t, e) {
            return o(t, e)[0] || null
          }),
          o
        )
      })(document, 'addEventListener', 'querySelectorAll')),
        void 0 ===
          (n = function () {
            return o
          }.apply(e, [])) || (t.exports = n)
    },
    924: () => {
      var t
      'function' != typeof (t = window.Element.prototype).matches &&
        (t.matches =
          t.msMatchesSelector ||
          t.mozMatchesSelector ||
          t.webkitMatchesSelector ||
          function (t) {
            for (
              var e = this,
                n = (e.document || e.ownerDocument).querySelectorAll(t),
                o = 0;
              n[o] && n[o] !== e;

            )
              ++o
            return Boolean(n[o])
          }),
        'function' != typeof t.closest &&
          (t.closest = function (t) {
            for (var e = this; e && 1 === e.nodeType; ) {
              if (e.matches(t)) return e
              e = e.parentNode
            }
            return null
          })
    },
    418: (t) => {
      var e = Object.getOwnPropertySymbols,
        n = Object.prototype.hasOwnProperty,
        o = Object.prototype.propertyIsEnumerable
      t.exports = (function () {
        try {
          if (!Object.assign) return !1
          var t = new String('abc')
          if (((t[5] = 'de'), '5' === Object.getOwnPropertyNames(t)[0]))
            return !1
          for (var e = {}, n = 0; n < 10; n++)
            e['_' + String.fromCharCode(n)] = n
          if (
            '0123456789' !==
            Object.getOwnPropertyNames(e)
              .map(function (t) {
                return e[t]
              })
              .join('')
          )
            return !1
          var o = {}
          return (
            'abcdefghijklmnopqrst'.split('').forEach(function (t) {
              o[t] = t
            }),
            'abcdefghijklmnopqrst' ===
              Object.keys(Object.assign({}, o)).join('')
          )
        } catch (t) {
          return !1
        }
      })()
        ? Object.assign
        : function (t, i) {
            for (
              var r,
                a,
                s = (function (t) {
                  if (null == t)
                    throw new TypeError(
                      'Object.assign cannot be called with null or undefined'
                    )
                  return Object(t)
                })(t),
                c = 1;
              c < arguments.length;
              c++
            ) {
              for (var l in (r = Object(arguments[c])))
                n.call(r, l) && (s[l] = r[l])
              if (e) {
                a = e(r)
                for (var u = 0; u < a.length; u++)
                  o.call(r, a[u]) && (s[a[u]] = r[a[u]])
              }
            }
            return s
          }
    },
  },
  e = {}
function n(o) {
  var i = e[o]
  if (void 0 !== i) return i.exports
  var r = (e[o] = { exports: {} })
  return t[o].call(r.exports, r, r.exports, n), r.exports
}
;(n.n = (t) => {
  var e = t && t.__esModule ? () => t.default : () => t
  return n.d(e, { a: e }), e
}),
  (n.d = (t, e) => {
    for (var o in e)
      n.o(e, o) &&
        !n.o(t, o) &&
        Object.defineProperty(t, o, { enumerable: !0, get: e[o] })
  }),
  (n.o = (t, e) => Object.prototype.hasOwnProperty.call(t, e))
var o = {}
;(() => {
  n.d(o, { Z: () => u }), n(924)
  var t = n(418),
    e = n.n(t),
    i = n(679),
    r = n.n(i)
  ;(function (t) {
    let e = (this.os = {}),
      n = t.match(/(Android);?[\s\/]+([\d.]+)?/)
    n && ((e.android = !0), (e.version = n[2]))
  }).call(r(), navigator.userAgent),
    e()(r().fn, {
      append: function (t) {
        return (
          t instanceof HTMLElement || (t = t[0]),
          this.forEach((e) => {
            e.appendChild(t)
          }),
          this
        )
      },
      remove: function () {
        return (
          this.forEach((t) => {
            t.parentNode.removeChild(t)
          }),
          this
        )
      },
      find: function (t) {
        return r()(t, this)
      },
      addClass: function (t) {
        return (
          this.forEach((e) => {
            e.classList.add(t)
          }),
          this
        )
      },
      removeClass: function (t) {
        return (
          this.forEach((e) => {
            e.classList.remove(t)
          }),
          this
        )
      },
      eq: function (t) {
        return r()(this[t])
      },
      show: function () {
        return (
          this.forEach((t) => {
            t.style.display = 'block'
          }),
          this
        )
      },
      hide: function () {
        return (
          this.forEach((t) => {
            t.style.display = 'none'
          }),
          this
        )
      },
      html: function (t) {
        return (
          this.forEach((e) => {
            e.innerHTML = t
          }),
          this
        )
      },
      css: function (t) {
        return (
          Object.keys(t).forEach((e) => {
            this.forEach((n) => {
              n.style[e] = t[e]
            })
          }),
          this
        )
      },
      on: function (t, e, n) {
        const o = 'string' == typeof e && 'function' == typeof n
        return (
          o || (n = e),
          this.forEach((i) => {
            t.split(' ').forEach((t) => {
              i.addEventListener(t, function (t) {
                o
                  ? this.contains(t.target.closest(e)) && n.call(t.target, t)
                  : n.call(this, t)
              })
            })
          }),
          this
        )
      },
      off: function (t, e, n) {
        return (
          'function' == typeof e && ((n = e), (e = null)),
          this.forEach((o) => {
            t.split(' ').forEach((t) => {
              'string' == typeof e
                ? o.querySelectorAll(e).forEach((e) => {
                    e.removeEventListener(t, n)
                  })
                : o.removeEventListener(t, n)
            })
          }),
          this
        )
      },
      index: function () {
        const t = this[0],
          e = t.parentNode
        return Array.prototype.indexOf.call(e.children, t)
      },
      offAll: function () {
        return (
          this.forEach((t, e) => {
            var n = t.cloneNode(!0)
            t.parentNode.replaceChild(n, t), (this[e] = n)
          }),
          this
        )
      },
      val: function () {
        return arguments.length
          ? (this.forEach((t) => {
              t.value = arguments[0]
            }),
            this)
          : this[0].value
      },
      attr: function () {
        if ('object' == typeof arguments[0]) {
          const t = arguments[0],
            e = this
          return (
            Object.keys(t).forEach((n) => {
              e.forEach((e) => {
                e.setAttribute(n, t[n])
              })
            }),
            this
          )
        }
        return 'string' == typeof arguments[0] && arguments.length < 2
          ? this[0].getAttribute(arguments[0])
          : (this.forEach((t) => {
              t.setAttribute(arguments[0], arguments[1])
            }),
            this)
      },
    }),
    e()(r(), {
      extend: e(),
      noop: function () {},
      render: function (t, e) {
        const n =
          "var p=[];with(this){p.push('" +
          t
            .replace(/[\r\t\n]/g, ' ')
            .split('<%')
            .join('\t')
            .replace(/((^|%>)[^\t]*)'/g, '$1\r')
            .replace(/\t=(.*?)%>/g, "',$1,'")
            .split('\t')
            .join("');")
            .split('%>')
            .join("p.push('")
            .split('\r')
            .join("\\'") +
          "');}return p.join('');"
        return new Function(n).apply(e)
      },
      getStyle: function (t, e) {
        var n,
          o = (t.ownerDocument || document).defaultView
        return o && o.getComputedStyle
          ? ((e = e.replace(/([A-Z])/g, '-$1').toLowerCase()),
            o.getComputedStyle(t, null).getPropertyValue(e))
          : t.currentStyle
          ? ((e = e.replace(/\-(\w)/g, (t, e) => e.toUpperCase())),
            (n = t.currentStyle[e]),
            /^\d+(em|pt|%|ex)?$/i.test(n)
              ? ((e) => {
                  var n = t.style.left,
                    o = t.runtimeStyle.left
                  return (
                    (t.runtimeStyle.left = t.currentStyle.left),
                    (t.style.left = e || 0),
                    (e = t.style.pixelLeft + 'px'),
                    (t.style.left = n),
                    (t.runtimeStyle.left = o),
                    e
                  )
                })(n)
              : n)
          : void 0
      },
    })
  const a = r()
  let s
  const c = function (t = {}) {
    if (s) return s
    const e = a.os.android
    t = a.extend(
      {
        title: null,
        content: '',
        className: '',
        buttons: [{ label: '确定', type: 'primary', onClick: a.noop }],
        isAndroid: e,
      },
      t
    )
    const n = a(
        a.render(
          '<div class="<%=className%>"> <div class="weui-mask"></div> <div class="weui-dialog <% if(isAndroid){ %> weui-skin_android <% } %>" role="dialog" aria-modal="true" tabindex="-1"> <% if (title) { %> <div class="weui-dialog__hd"> <strong class="weui-dialog__title"><%=title%></strong> </div> <% } %> <div class="weui-dialog__bd"><%=content%></div> <div class="weui-dialog__ft"> <% for(var i = 0; i < buttons.length; i++){ %> <a href="javascript:;" class="weui-dialog__btn weui-dialog__btn_<%=buttons[i][\'type\']%>" role="button"><%=buttons[i][\'label\']%></a> <% } %> </div> </div> </div> ',
          t
        )
      ),
      o = n.find('.weui-dialog'),
      i = n.find('.weui-mask')
    function r(t) {
      ;(r = a.noop), n.remove(), (s = !1), t && t()
    }
    function c(t) {
      r(t)
    }
    return (
      a('body').append(n),
      i.addClass('weui-animate-fade-in'),
      o
        .addClass('weui-animate-fade-in')
        .on('animationend webkitAnimationEnd', function (t) {
          t.target.focus()
        }),
      n
        .on('click', '.weui-dialog__btn', function (e) {
          const n = a(this).index()
          t.buttons[n].onClick
            ? !1 !== t.buttons[n].onClick.call(this, e) && c()
            : c()
        })
        .on('touchmove', function (t) {
          t.stopPropagation(), t.preventDefault()
        }),
      (s = n[0]),
      (s.hide = c),
      s
    )
  }
  let l
  const u = {
    dialog: c,
    confirm: function (t = '', e = a.noop, n = a.noop, o) {
      return (
        'object' == typeof e
          ? ((o = e), (e = a.noop))
          : 'object' == typeof n && ((o = n), (n = a.noop)),
        (o = a.extend(
          {
            content: t,
            buttons: [
              { label: '取消', type: 'default', onClick: n },
              { label: '确定', type: 'primary', onClick: e },
            ],
          },
          o
        )),
        c(o)
      )
    },
    toast: function (t = '', e = {}) {
      if (l) return l
      'number' == typeof e && (e = { duration: e }),
        'function' == typeof e && (e = { callback: e }),
        (e = a.extend(
          { content: t, duration: 3e3, callback: a.noop, className: '' },
          e
        ))
      const n = a(
          a.render(
            '<div class="<%= className %>" role="alert"> <div class="weui-mask_transparent"></div> <div class="weui-toast"> <i class="weui-icon_toast weui-icon-success-no-circle"></i> <p class="weui-toast__content"><%=content%></p> </div> </div> ',
            e
          )
        ),
        o = n.find('.weui-toast'),
        i = n.find('.weui-mask')
      return (
        a('body').append(n),
        o.addClass('weui-animate-fade-in'),
        i.addClass('weui-animate-fade-in'),
        setTimeout(() => {
          i.addClass('weui-animate-fade-out'),
            o
              .addClass('weui-animate-fade-out')
              .on('animationend webkitAnimationEnd', function () {
                n.remove(), (l = !1), e.callback()
              })
        }, e.duration),
        (l = n[0]),
        n[0]
      )
    },
  }
})()
var i = o.Z
export { i as default }
