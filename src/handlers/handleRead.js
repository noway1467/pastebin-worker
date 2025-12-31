import { decode, encodeRFC5987ValueChars, isLegalUrl, parsePath, WorkerError } from "../common.js"
import { getStaticPage } from "../pages/staticPages.js"
import { getPasswordPage } from "../pages/password.js"
import { verifyAuth } from "../auth.js"
import { getType } from "mime/lite.js"
import { makeMarkdown } from "../pages/markdown.js"
import { makeHighlight } from "../pages/highlight.js"
import { decryptWithPassword, base64ToUint8Array } from "../crypto.js"

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

export async function handleGet(request, env, ctx) {
  const url = new URL(request.url)
  const { role, short, ext, passwd, filename } = parsePath(url.pathname)

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

  const disp = url.searchParams.has("a") ? "attachment" : "inline"

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

  // determine filename with priority: url path > meta
  const returnFilename = filename || item.metadata?.filename

  // handle URL redirection
  if (role === "u") {
    const redirectURL = decode(item.value)
    if (isLegalUrl(redirectURL)) {
      return Response.redirect(redirectURL)
    } else {
      throw new WorkerError(400, "cannot parse paste content as a legal URL")
    }
  }

  // handle article (render as markdown)

  // handle language highlight
  const lang = url.searchParams.get("lang")
  let content = item.value

  // handle view protection: require v (view password) query parameter to decrypt
  if (item.metadata?.vProtected) {
    const viewPasswd = url.searchParams.get("v") || ""
    if (viewPasswd.length === 0) {
      return new Response(getPasswordPage(env), {
        headers: { "content-type": "text/html;charset=UTF-8", ...staticPageCacheHeader(env) },
      })
    }
    try {
      const salt = base64ToUint8Array(item.metadata.vSalt)
      const iv = base64ToUint8Array(item.metadata.vIv)
      content = await decryptWithPassword(content, viewPasswd, salt, iv)
    } catch (e) {
      throw new WorkerError(403, "incorrect view password")
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
  if (lang) {
    return new Response(makeHighlight(decode(content), lang), {
      headers: { "content-type": `text/html;charset=UTF-8`, ...pasteCacheHeader(env), ...lastModifiedHeader(item) },
    })
  }

  // handle default (not protected)
  const headers = { "content-type": `${mime};charset=UTF-8`, ...pasteCacheHeader(env), ...lastModifiedHeader(item) }
  if (returnFilename) {
    const encodedFilename = encodeRFC5987ValueChars(returnFilename)
    headers["content-disposition"] = `${disp}; filename*=UTF-8''${encodedFilename}`
  } else {
    headers["content-disposition"] = `${disp}`
  }
  return new Response(content, { headers })
}
