import { decode, encodeRFC5987ValueChars, isLegalUrl, parsePath, WorkerError } from "../common.js"
import { getStaticPage } from "../pages/staticPages.js"
import { verifyAuth } from "../auth.js"
import { getType } from "mime/lite.js"
import { makeMarkdown } from "../pages/markdown.js"
import { makeHighlight } from "../pages/highlight.js"
import { decryptWithPassword, base64ToUint8Array } from "../crypto.js"
import { getPasswordPage } from "../pages/password.js"

function staticPageCacheHeader(env) {
  const age = env.CACHE_STATIC_PAGE_AGE
  return age ? { "cache-control": `public, max-age=${age}` } : {}
}

function pasteCacheHeader(env) {
  const age = env.CACHE_PASTE_AGE
  return age ? { "cache-control": `public, max-age=${age}` } : {}
}

function lastModifiedHeader(paste) {
  const lastModified = paste.metadata?.lastModified
  return lastModified ? { "last-modified": new Date(lastModified).toGMTString() } : {}
}

async function renderPaste(item, content, role, mime, ext, env, url, isDecrypted) {
    // determine filename with priority: meta only (since we removed filename from path in upload, but kept it in meta?)
    // Actually we removed filename upload, but metadata might still have it if old or passed?
    // In our new createPaste we kept 'filename: filename' in metadata but removed it from args?
    // Wait, in previous handleWrite replacement I removed 'filename' from args of createPaste, and passed 'filename' as arg to createPaste which was actually 'undefined' if I removed it from args list?
    // Let me check my previous replacement for handleWrite.
    // I removed 'filename' from args. `async function createPaste(env, content, ...)`
    // And in `options.metadata`, I removed `filename: filename`?
    // Let me check the replacement string I used.
    // I see `filename: filename` was REMOVED from `metadata`. Good.
    // But `item.metadata?.filename` might still exist for old pastes.
    const returnFilename = item.metadata?.filename

    // handle URL redirection
    if (role === "u") {
        const redirectURL = decode(content)
        if (isLegalUrl(redirectURL)) {
            return Response.redirect(redirectURL)
        } else {
            throw new WorkerError(400, "cannot parse paste content as a legal URL")
        }
    }

    // handle article (render as markdown)
    if (role === "a") {
        const md = makeMarkdown(decode(content))
        return new Response(md, {
            headers: { "content-type": `text/html;charset=UTF-8`, ...pasteCacheHeader(env), ...lastModifiedHeader(item) },
        })
    }

    // handle language highlight
    const lang = url.searchParams.get("lang")
    if (lang) {
        return new Response(makeHighlight(decode(content), lang), {
            headers: { "content-type": `text/html;charset=UTF-8`, ...pasteCacheHeader(env), ...lastModifiedHeader(item) },
        })
    }

    // handle default (not protected or decrypted)
    const headers = { "content-type": `${mime};charset=UTF-8`, ...pasteCacheHeader(env), ...lastModifiedHeader(item) }
    const disp = url.searchParams.has("a") ? "attachment" : "inline"
    
    if (returnFilename) {
        const encodedFilename = encodeRFC5987ValueChars(returnFilename)
        headers["content-disposition"] = `${disp}; filename*=UTF-8''${encodedFilename}`
    } else {
        headers["content-disposition"] = `${disp}`
    }
    return new Response(content, { headers })
}

export async function handleVerifyAndRead(request, env, ctx) {
    const url = new URL(request.url)
    const { role, short, ext } = parsePath(url.pathname)

    // Parse body as form-urlencoded to get password
    let viewPasswd = ""
    try {
        const formData = await request.formData()
        viewPasswd = formData.get('v')
    } catch(e) {
        // failed to parse
    }

    const item = await env.PB.getWithMetadata(short, { type: "arrayBuffer" })
    if (item.value === null) {
        throw new WorkerError(404, `paste of name '${short}' not found`)
    }

    let content = item.value
    if (item.metadata?.vProtected) {
        if (!viewPasswd) {
             return new Response(getPasswordPage(env, "请输入密码"), {
                headers: { "content-type": "text/html;charset=UTF-8" }
             })
        }
        try {
            const salt = base64ToUint8Array(item.metadata.vSalt)
            const iv = base64ToUint8Array(item.metadata.vIv)
            content = await decryptWithPassword(content, viewPasswd, salt, iv)
        } catch (e) {
             return new Response(getPasswordPage(env, "密码错误，请重试"), {
                headers: { "content-type": "text/html;charset=UTF-8" }
             })
        }
    }

    const mime = url.searchParams.get("mime") || getType(ext) || "text/plain"
    return renderPaste(item, content, role, mime, ext, env, url, true)
}

export async function handleGet(request, env, ctx) {
  const url = new URL(request.url)
  const { role, short, ext, passwd } = parsePath(url.pathname)

  if (url.pathname === "/favicon.ico" && env.FAVICON) {
    return Response.redirect(env.FAVICON)
  }

  // return the editor for admin URL
  const staticPageContent = getStaticPage((passwd.length > 0) ? "/" : url.pathname, env)
  if (staticPageContent) {
    // access to all static pages requires auth
    const authResponse = verifyAuth(request, env)
    if (authResponse !== null) {
      return authResponse
    }
    return new Response(staticPageContent, {
      headers: { "content-type": "text/html;charset=UTF-8", ...staticPageCacheHeader(env) },
    })
  }

  const mime = url.searchParams.get("mime") || getType(ext) || "text/plain"

  if (url.searchParams.has("meta")) {
    const item = await env.PB.getWithMetadata(short)
    if (item.value === null) {
      throw new WorkerError(404, `paste of name '${short}' not found`)
    }
    return new Response(JSON.stringify(item.metadata), {
      headers: { "content-type": "application/json;charset=UTF-8" },
    })
  }

  const item = await env.PB.getWithMetadata(short, { type: "arrayBuffer" })

  // when paste is not found
  if (item.value === null) {
    throw new WorkerError(404, `paste of name '${short}' not found`)
  }

  // check `if-modified-since`
  const pasteLastModified = item.metadata?.lastModified
  const headerModifiedSince = request.headers.get("if-modified-since")
  if (pasteLastModified && headerModifiedSince) {
    let pasteLastModifiedMs = Date.parse(pasteLastModified)
    pasteLastModifiedMs -= pasteLastModifiedMs % 1000 // deduct the milliseconds parts
    const headerIfModifiedMs = Date.parse(headerModifiedSince)
    if (pasteLastModifiedMs <= headerIfModifiedMs) {
      return new Response(null, {
        status: 304, // Not Modified
        headers: lastModifiedHeader(item),
      })
    }
  }

  // handle view protection
  if (item.metadata?.vProtected) {
    // Return the password page directly
    return new Response(getPasswordPage(env), {
      headers: { "content-type": "text/html;charset=UTF-8" },
    })
  }

  return renderPaste(item, item.value, role, mime, ext, env, url, false)
}