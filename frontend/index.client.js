const SEP = ':'

function parsePath(pathname) {
  let role = "", ext = ""
  if (pathname[2] === "/") {
    role = pathname[1]
    pathname = pathname.slice(2)
  }
  let startOfExt = pathname.indexOf(".")
  if (startOfExt >= 0) {
    ext = pathname.slice(startOfExt)
    pathname = pathname.slice(0, startOfExt)
  }
  let endOfShort = pathname.indexOf(SEP)
  if (endOfShort < 0) endOfShort = pathname.length // when there is no SEP, passwd is left empty
  const short = pathname.slice(1, endOfShort)
  const passwd = pathname.slice(endOfShort + 1)
  return { role, short, passwd, ext }
}

window.addEventListener('DOMContentLoaded', () => {
  const base_url = '{{BASE_URL}}'
  const deploy_date = new Date('{{DEPLOY_DATE}}')

  function getDateString(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    const second = date.getSeconds().toString().padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }

  $('#deploy-date').text(getDateString(deploy_date))

  function isAdminUrlLegal(url) {
    try {
      url = new URL(url)
      return url.origin === base_url && url.pathname.indexOf(':') >= 0
    } catch (e) {
      if (e instanceof TypeError) {
        return false
      } else {
        throw e
      }
    }
  }

  // const formatSize = (size) => { ... } // removed


  // monitor input changes and enable/disable submit button
  let urlType = $('input[name="url-type"]:checked').val()
  let inputType = 'edit'
  let expiration = $('#paste-expiration-input').val()
  let passwd = ''
  let viewPasswd = ''
  let customName = '', adminUrl = ''


  const NAME_REGEX = /^[a-zA-Z0-9+_\-\[\]*$@,;]{3,}$/
  const EXPIRE_REGEX = /^\d+\s*[smhdwMY]?$/
  const submitButton = $('#submit-button')
  const deleteButton = $('#delete-button')
  const pasteEditArea = $('#paste-textarea')
  const submitErrMsg = $('#submit-error-msg')

  function disableSubmitButton(reason) {
    submitButton.removeClass('enabled')
    submitErrMsg.text(reason)
  }

  function updateButtons() {
    const pasteNotEmpty = pasteEditArea.prop('value').length > 0

    let expirationValid = EXPIRE_REGEX.test(expiration)  // TODO: verify it
    if (!expiration) {
      expirationValid = true
    }
    const nameValid = urlType !== 'custom' || NAME_REGEX.test(customName)
    const adminUrlValid = urlType !== 'admin' || isAdminUrlLegal(adminUrl)

    if (!pasteNotEmpty) {
      disableSubmitButton('Paste is empty')
    } else if (!expirationValid) {
      disableSubmitButton(`Expiration “${expiration}” not valid`)
    } else if (!nameValid) {
      disableSubmitButton(`The customized URL should satisfy regex ${NAME_REGEX}`)
    } else if (!adminUrlValid) {
      disableSubmitButton(`Admin URL “${adminUrl}” not valid`)
    } else {
      submitButton.addClass('enabled')
      submitErrMsg.text('')
    }

    if (urlType === 'admin') {
      submitButton.text('Update')
      deleteButton.removeClass('hidden')
    } else {
      submitButton.text('Submit')
      deleteButton.addClass('hidden')
    }

    if (adminUrlValid) {
      deleteButton.addClass('enabled')
      submitButton.prop('title', '')
    } else {
      deleteButton.removeClass('enabled')
      submitErrMsg.text(`The admin URL should start with “${base_url}” and contain a colon`)
    }
  }

  updateButtons()

  function updateTabBar() {
    if (inputType === 'edit') {
      $('#paste-tab-preview').removeClass('enabled')
      $('#paste-tab-edit').addClass('enabled')
      $('#paste-edit').addClass('enabled')
      $('#paste-preview').removeClass('enabled')
    } else if (inputType === 'preview') {
      $('#paste-tab-edit').removeClass('enabled')
      $('#paste-tab-preview').addClass('enabled')
      $('#paste-preview').addClass('enabled')
      $('#paste-edit').removeClass('enabled')
    }
  }

  // File input listeners removed


  $('#paste-tab-edit').on('click', () => {
    inputType = 'edit'
    updateButtons()
    updateTabBar()
  })

  $('#paste-tab-preview').on('click', () => {
    inputType = 'preview'
    updateButtons()
    updateTabBar()
    $('#preview-content').html(marked.parse(pasteEditArea.val()))
  })

  pasteEditArea.on('input', () => {
    updateButtons()
    if (inputType === 'preview') {
      $('#preview-content').html(marked.parse(pasteEditArea.val()))
    }
  })

  $('#paste-expiration-input').on('input', event => {
    expiration = event.target.value
    updateButtons()
  })

  $('#paste-passwd-input').on('input', event => {
    passwd = event.target.value
  })

  $('#paste-view-passwd-input').on('input', event => {
    viewPasswd = event.target.value
  })

  $('input[name="url-type"]').on('input', event => {
    urlType = event.target.value
    updateButtons()
  })

  $('#paste-custom-url-input').on('input', event => {
    customName = event.target.value
    updateButtons()
  })

  $('#paste-admin-url-input').on('input', event => {
    adminUrl = event.target.value
    updateButtons()
  })

  // submit the form
  submitButton.on('click', () => {
    if (submitButton.hasClass('enabled')) {
      if (urlType === 'admin') {
        putPaste()
      } else {
        postPaste()
      }
    }
  })

  deleteButton.on('click', () => {
    if (deleteButton.hasClass('enabled')) {
      deletePaste()
    }
  })

  function putPaste() {
    prepareUploading()
    let fd = new FormData()
    const content = pasteEditArea.prop('value')
    const encodedContent = new TextEncoder().encode(content)
    fd.append('c', new Blob([encodedContent]))


    if (expiration.length > 0) fd.append('e', expiration)
    if (passwd.length > 0) fd.append('s', passwd)
    if (viewPasswd.length > 0) fd.append('v', viewPasswd)
    if ($('#paste-as-markdown-checkbox').prop('checked')) fd.append('m', 'true')

    $.ajax({
      method: 'PUT',
      url: adminUrl,
      data: fd,
      processData: false,
      contentType: false,
      success: (data) => {
        renderUploaded(data)
      },
      error: handleError,
    })
  }

  function postPaste() {
    prepareUploading()
    let fd = new FormData()
    const content = pasteEditArea.prop('value')
    const encodedContent = new TextEncoder().encode(content)
    fd.append('c', new Blob([encodedContent]))


    if (expiration.length > 0) fd.append('e', expiration)
    if (passwd.length > 0) fd.append('s', passwd)
    if (viewPasswd.length > 0) fd.append('v', viewPasswd)
    if ($('#paste-as-markdown-checkbox').prop('checked')) fd.append('m', 'true')

    if (urlType === 'long') fd.append('p', 'true')
    if (urlType === 'custom') fd.append('n', customName)

    $.post({
      url: base_url,
      data: fd,
      processData: false,
      contentType: false,
      success: (data) => {
        renderUploaded(data)
      },
      error: handleError,
    })
  }

  function deletePaste() {
    prepareUploading()
    let fd = new FormData()
    $.ajax({
      method: 'DELETE',
      url: adminUrl,
      data: fd,
      processData: false,
      success: () => {
        alert('Delete successfully')
      },
      error: handleError,
    })
  }

  function prepareUploading() {
    resetCopyButtons()
    $('#submit-button').removeClass('enabled')
    $('#paste-uploaded-panel input').prop('value', '')
  }

  function renderUploaded(uploaded) {
    $('#paste-uploaded-panel').removeClass('hidden')
    $('#uploaded-url').prop('value', uploaded.url)
    $('#uploaded-admin-url').prop('value', uploaded.admin)
    if (uploaded.suggestUrl) {
      $('#uploaded-suggest-url').prop('value', uploaded.suggestUrl)
    }
    if (uploaded.expire) {
      $('#uploaded-expiration').prop('value', uploaded.expire)
    }
    // 若设置了查看密码，生成带 ?v= 的便捷复制链接
    if (viewPasswd && viewPasswd.length > 0) {
      // v2: 移除URL中的 ?v=, 前端在查看时会自动处理 cookies 或输入框
      // 但这里为了方便用户复制，我们生成的连接可以不带 v，但提示用户需要密码
      // 用户需求是: "网址不要带有查看密码参数"
      // 管理链接的查看功能是 AJAX 来的，需要特殊处理
      $('#uploaded-url-with-v').prop('value', uploaded.url) // 不带 v
      if (uploaded.suggestUrl) {
        $('#uploaded-suggest-url-with-v').prop('value', uploaded.suggestUrl)
      }
      $('#uploaded-admin-url-with-v').prop('value', uploaded.admin) // 不带 v，admin面板里有输入框
    } else {
      $('#uploaded-url-with-v').prop('value', '')
      $('#uploaded-suggest-url-with-v').prop('value', '')
      $('#uploaded-admin-url-with-v').prop('value', '')
    }
    updateButtons()
  }

  $('.copy-button').on('click', event => {
    const button = event.target
    const input = button.parentElement.firstElementChild
    input.focus()
    input.select()
    try {
      document.execCommand('copy')
      resetCopyButtons()
      button.textContent = 'Copied'
    } catch (err) {
      alert('Failed to copy content')
    }
  })

  function resetCopyButtons() {
    $('.copy-button').text('Copy')
  }

  function handleError(error) {
    const status = error.status || ''
    let statusText = error.statusText === 'error' ? 'Unknown error' : error.statusText
    const responseText = error.responseText || ''
    alert(`Error ${status}: ${statusText}\n${responseText}\nView your console for more information`)
    $('#submit-button').addClass('enabled')
  }

  function initAdmin() {
    const { role, short, passwd, ext } = parsePath(location.pathname)
    if (passwd.length > 0) {
      $('#paste-url-admin-radio').click()
      $('#paste-admin-url-input').val(location.href)
      urlType = 'admin'
      adminUrl = location.href
      // 自动填充管理密码输入框
      $('#paste-passwd-input').val(passwd)
      // 同步内存中的密码变量
      $("#paste-passwd-input").trigger('input')

      // 如果 URL 上自带 ?v=，优先使用
      const params = new URLSearchParams(location.search)
      const vFromUrl = params.get('v') || ''
      if (vFromUrl.length > 0) {
        viewPasswd = vFromUrl
        $('#paste-view-passwd-input').val(vFromUrl)
      }

      updateButtons()

      function loadPasteForAdmin() {
        let url = "/" + short
        // if (viewPasswd && viewPasswd.length > 0) {
        //   url += `?v=${encodeURIComponent(viewPasswd)}`
        // }  // 后端现在优先检查 header 或 returned 401，这里不再在URL里拼接 v，而是依靠 header 里的 viewPasswd (Wait, this is GET request, usually we put params in URL. But we can also set headers)

        // 我们已经在 backend handleRead 里改了： check param v OR cookie.
        // As an admin editor, we can just send the 'v' query param if we have it, to avoid cookie reliance inside the editor logic?
        // But user said "网址不要带有查看密码参数". This applies to the visited URL.
        // For internal AJAX to fetch content, we can use query param IF we want, OR we can use the same cookie mechanism.
        // Let's stick to using `v` param for the API call to ensure it works, OR headers. 
        // Backend `handleRead.js` modification I made checks query param "v" first.
        // So for the EDITOR, let's keep sending `?v=...` in the background AJAX call? 
        // User Requirement: "网址不要带有查看密码参数" usually refers to the address bar.
        // So keeping it in AJAX is fine. BUT, let's try to align with the plan: use `X-Client-Type`.

        if (viewPasswd && viewPasswd.length > 0) {
          url += `?v=${encodeURIComponent(viewPasswd)}`
        }

        $.ajax({
          url,
          headers: {
            "X-Client-Type": "web-editor"
          },
          success: paste => {
            pasteEditArea.val(paste)
            updateButtons()
          },
          error: (error) => {
            // 若需要查看密码，提示用户在输入框填写后自动重试
            if ((error.status === 401 || error.status === 403) && (!viewPasswd || viewPasswd.length === 0)) {
              submitErrMsg.text('该粘贴已加密，请在“查看密码”中输入后重试')
              $('#paste-view-passwd-input').focus()
            } else {
              handleError(error)
            }
          },
        })
      }

      // 首次尝试加载
      loadPasteForAdmin()

      // fetch metadata and update UI
      $.ajax({
        url: "/" + short + "?meta",
        success: meta => {
          if (meta.asMarkdown) {
            $('#paste-as-markdown-checkbox').prop('checked', true)
          }
        },
      })

      // 当用户填写/修改查看密码时尝试重新加载
      $('#paste-view-passwd-input').on('change', () => {
        viewPasswd = $('#paste-view-passwd-input').val()
        loadPasteForAdmin()
      })
    }
  }

  initAdmin()
})
