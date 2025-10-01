# API Reference

本页描述 Cloudflare Workers 版本的 Pastebin HTTP API。除重定向外，所有成功响应都会带有 `Access-Control-Allow-Origin: *`，以便跨域调用。

## GET `/`

返回首页或管理页（静态页面）。若启用了 Basic Auth，访问静态页需要认证。

## **GET** `/<name>[.<ext>]` 或 `/<name>/<filename>[.<ext>]`

读取名为 `<name>` 的粘贴内容。默认返回原始二进制内容，`Content-Type` 默认 `text/plain;charset=UTF-8`；若提供 `<ext>`，将据此推断 mime；若提供 `?mime=` 则覆盖推断。

`Content-Disposition` 默认 `inline`，可通过 `?a` 切换为 `attachment`。若上传时或路径中提供了文件名，则使用 RFC5987 编码的 `filename*`。

- `?a`：可选。设置为附件下载。
- `?lang=<lang>`：可选。以语法高亮的 HTML 页面返回内容（PrismJS）。设置后响应 `Content-Type: text/html`，忽略 `?mime`。
- `?mime=<mime>`：可选。指定返回的 mime 类型。
- `?v=<view-password>`：可选。若该粘贴设置了“查看密码”，必须提供正确的查看密码才可解密返回。

条件缓存与时间戳：当对象包含 `metadata.lastModified` 时，响应附带 `Last-Modified`，并支持 `If-Modified-Since`，命中返回 `304 Not Modified`。

错误码：`404` 未找到；`401` 需要查看密码；`403` 查看密码错误；`500` 服务器错误。

示例：`GET /abcd?lang=js`，`GET /abcd?mime=application/json`。

## GET `/<name>:<passwd>`

返回编辑页面（静态页面）。若启用了 Basic Auth，访问静态页需要认证。`<passwd>` 是创建时返回的管理密码。

错误码：`404` 未找到；`500` 服务器错误。

## GET `/u/<name>`

将粘贴内容解析为 URL 并重定向（若内容为合法 URL）。

错误码：`302` 成功；`404` 未找到；`400` 内容不是合法 URL；`500` 服务器错误。

## GET `/a/<name>`

将粘贴内容按 Markdown 渲染为 HTML（GFM，`remark-*` 实现；PrismJS 代码高亮；MathJax 数学公式）。

错误码：`404` 未找到；`500` 服务器错误。

## Favicon

若设置环境变量 `FAVICON`，当请求 `/favicon.ico` 时将重定向到该 URL。

## **POST** `/`

以 `multipart/form-data` 上传粘贴：

- `c`（必填）：内容（二进制或文本）。最大 25 MB。其 `Content-Disposition` 中的文件名将用于下载文件名与建议 URL。
- `e`（可选）：过期时间，整数或浮点并可带单位：`s`/`m`/`h`/`d`/`w`/`M`/`Y`，最少 60 秒。
- `s`（可选）：管理密码（用于后续修改/删除）。不提供则随机生成。
- `n`（可选）：自定义名称。与 `NAME_REGEX` 匹配（至少 3 位，只含字母/数字和 `+_-[]*$=@,;`）。被占用会返回冲突。
- `p`（可选）：私有模式标记。启用后随机名长度 24。使用 `n` 时无效。
- `v`（可选）：查看密码。提供后内容将以 AES-GCM 加密存储，读取时需 `?v=` 解密。

成功时返回 JSON：

```json
{
  "url": "https://example.com/abcd",
  "suggestUrl": "https://example.com/abcd/filename.txt" ,
  "admin": "https://example.com/abcd:xxxxxxxxxxxxxxxxxxxxxxxx",
  "isPrivate": false,
  "expire": 300
}
```

字段说明：`url` 读取地址；`suggestUrl` 可能携带文件名或 URL 跳转地址（`/u/<name>`）；`admin` 管理地址；`isPrivate` 私有模式；`expire` 过期秒数或 `null`。

错误码：`400` 请求格式错误或非 multipart；`409` 名称冲突；`413` 内容过大；`500` 服务器错误。

## **PUT** `/<name>:<passwd>`

以 `multipart/form-data` 更新粘贴：

- `c`（必填）：新内容。
- `e`（可选）：过期时间（会重新计算删除时间）。
- `s`（可选）：新的管理密码。
- `v`（可选）：查看密码。若原对象已启用查看密码且未提供新的查看密码，出于安全防护将返回 `400`，以避免意外去除保护。

成功时返回与 POST 相同结构。错误码：`400` 格式错误或缺少必须字段/查看密码更新规则；`403` 管理密码错误；`404` 未找到；`413` 内容过大；`500` 服务器错误。

## DELETE `/<name>:<passwd>`

删除粘贴，全球一致性可能有延迟。

错误码：`403` 管理密码错误；`404` 未找到；`500` 服务器错误。

## CORS 与 OPTIONS 预检

- 所有非 302 响应会添加 `Access-Control-Allow-Origin: *`。
- 预检请求会返回：`Access-Control-Allow-Methods: GET,HEAD,PUT,POST,OPTIONS`，`Access-Control-Allow-Headers` 透传来访的 `Access-Control-Request-Headers`，`Access-Control-Max-Age: 86400`。

## 响应头与下载文件名

- 推断或指定的 `Content-Type` 将总是附带 `;charset=UTF-8`。
- 若存在文件名，响应将设置 `Content-Disposition: inline|attachment; filename*=UTF-8''<encoded>`（RFC5987 编码）。
