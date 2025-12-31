import { decode, encodeRFC5987ValueChars, isLegalUrl, parsePath, WorkerError } from "../common.js"
import { getStaticPage } from "../pages/staticPages.js"
import { verifyAuth } from "../auth.js"
import { getType } from "mime/lite.js"
import { makeMarkdown } from "../pages/markdown.js"
import { makeHighlight } from "../pages/highlight.js"
import { decryptWithPassword, base64ToUint8Array } from "../crypto.js"

function getCookie(request, name) {
  const cookieString = request.headers.get("Cookie")
  if (cookieString) {
    const cookies = cookieString.split(";")
    for (let cookie of cookies) {
      const [cookieName, cookieValue] = cookie.split("=")
      if (cookieName.trim() === name) {
        return decodeURIComponent(cookieValue)
      }
    }
  }
  return null
}

const PASSWORD_PAGE = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>受保护的内容</title>
  <style>
    :root {
      --primary-color: #0070f3;
      --bg-color: #fafafa;
      --card-bg: #ffffff;
      --text-color: #333;
      --border-color: #eaeaea;
    }
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background-color: var(--bg-color);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--text-color);
    }
    .card {
      background: var(--card-bg);
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      text-align: center;
      width: 100%;
      max-width: 360px;
    }
    h1 { margin-top: 0; font-size: 1.5rem; margin-bottom: 1.5rem; }
    input {
      width: 100%;
      padding: 0.75rem;
      margin-bottom: 1rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      box-sizing: border-box;
      font-size: 1rem;
      transition: border-color 0.2s;
    }
    input:focus { outline: none; border-color: var(--primary-color); }
    button {
      width: 100%;
      padding: 0.75rem;
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #0060df; }
    .error { color: #d32f2f; margin-bottom: 1rem; font-size: 0.9rem; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>请输入访问密码</h1>
    <div id="error-msg" class="error">密码错误</div>
    <form id="password-form">
      <input type="password" id="password" placeholder="密码" required autofocus>
      <button type="submit">查看内容</button>
    </form>
  </div>
  <script>
    const form = document.getElementById('password-form');
    const params = new URLSearchParams(window.location.search);
    if (params.has('err')) {
      document.getElementById('error-msg').style.display = 'block';
    }
    
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const password = document.getElementById('password').value;
      const short = window.location.pathname.split('/').pop() || ''; 
      // cookie 7 days
      document.cookie = \`paste_v_\${short}=\${encodeURIComponent(password)}; path=/; max-age=604800; SameSite=Lax\`;
      // remove err param if present
      const url = new URL(window.location);
      url.searchParams.delete('err');
      window.location.href = url.toString();
    });
  </script>
</body>
</html>
`


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
    let viewPasswd = url.searchParams.get("v")
    // check cookie if not in url
    if (!viewPasswd) {
      viewPasswd = getCookie(request, `paste_v_${short}`)
    }

    if (!viewPasswd || viewPasswd.length === 0) {
      if (request.headers.get("X-Client-Type")) {
         throw new WorkerError(401, "view password required")
      } else {
         return new Response(PASSWORD_PAGE, {
            headers: { "content-type": "text/html;charset=UTF-8" }
         })
      }
    }
    try {
      const salt = base64ToUint8Array(item.metadata.vSalt)
      const iv = base64ToUint8Array(item.metadata.vIv)
      content = await decryptWithPassword(content, viewPasswd, salt, iv)
    } catch (e) {
       if (request.headers.get("X-Client-Type")) {
          throw new WorkerError(403, "incorrect view password")
       } else {
          // invalid password, show page with error
          // we can redirect to same page with ?err=1 or just return the page again with script checking cookie?
          // better to redirect to clear bad cookie? Or just let the script overwrite it.
          // Let's rely on the client script to overwrite. But here we must return the page again.
          // However, if we just return the page, the user will see the form again.
          // We can append ?err=1 to url to show error message
           if (!url.searchParams.has('err')) {
               url.searchParams.set('err', '1');
               return Response.redirect(url.toString(), 302);
           }
           return new Response(PASSWORD_PAGE, {
            headers: { "content-type": "text/html;charset=UTF-8" }
           })
       }
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
