// Open a confirmation on top of an editor. Relies on dialog.css.

export default function (CodeMirror) {
  function dialogDiv(cm, template, options) {
    var wrap = cm.getWrapperElement()
    var dialog

    dialog = wrap.appendChild(document.createElement('div'))
    dialog.className = 'CodeMirror-confirmation'

    var header = document.createElement('div')
    header.innerText = options.title
    header.className = 'confirmation-header'

    var close = document.createElement('div')
    close.className = 'confirmation-close widget-btn'
    close.innerHTML = "<i class='iconfont icon-close'></i>"
    header.appendChild(close)

    dialog.appendChild(header)

    var footer = document.createElement('div')
    footer.className = 'confirmation-footer'
    var footerTitle = document.createElement('div')
    footerTitle.innerText = options.footerTitle
    var confirmBtn = document.createElement('div')
    confirmBtn.innerHTML =
      "<button class='confirmation-btn btn-danger'>确认</button>"
    footer.appendChild(footerTitle)
    footer.appendChild(confirmBtn)

    var body = document.createElement('div')
    body.className = 'confirmation-body'

    dialog.appendChild(body)
    dialog.appendChild(footer)

    if (typeof template == 'string') {
      body.innerHTML = template
    } else {
      // Assuming it's a detached DOM element.
      body.appendChild(template)
    }
    CodeMirror.addClass(wrap, 'confirmation-opened')

    cm.state.confirmationOpen = true

    function closeDialog() {
      closeConfirmation()
      cm.state.confirmationOpen = false
      CodeMirror.off(document, 'keydown', handleConfirmation)
    }

    CodeMirror.on(close, 'click', closeDialog)
    CodeMirror.on(confirmBtn, 'click', handleEnter)

    function handleEnter() {
      closeDialog()
      cm.state.confirmationOpen = false
      cm.focus()

      options.onConfirm && options.onConfirm()
    }

    function handleConfirmation(e) {
      if (e.code === 'Escape') {
        closeDialog()
        cm.focus()
      }

      if (e.code === 'Enter') {
        handleEnter()
      }
    }

    setTimeout(() => {
      CodeMirror.on(document, 'keydown', handleConfirmation)
    }, 50)

    return dialog
  }

  function closeNotification(cm, newVal) {
    if (cm.state.currentNotificationClose) cm.state.currentNotificationClose()
    cm.state.currentNotificationClose = newVal
  }

  function closeConfirmation() {
    document
      .querySelectorAll('.CodeMirror-confirmation')
      .forEach((ele) => ele.remove())
  }

  CodeMirror.defineExtension('closeConfirmation', function () {
    this.state.confirmationOpen = false
    closeConfirmation()
  })

  CodeMirror.defineExtension('openConfirmation', function (template, options) {
    closeNotification(this, null)
    dialogDiv(this, template, options)
  })
}
