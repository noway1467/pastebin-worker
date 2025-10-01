# Pastebin-worker

这是一个可以部署在 Cloudflare Workers 上的 Pastebin。线上示例见 [shz.al](https://shz.al)。

**设计理念**：易于部署、友好的命令行使用、功能丰富。

**功能特性**：

1. 仅 4 个字符即可分享粘贴
2. 支持自定义粘贴 URL
4. 支持随时**更新**与**删除**
5. 支持设置**过期**时间自动删除
6. 内置 PrismJS 代码**语法高亮**
7. 以 HTML 展示 **Markdown** 文件
8. 可作为 URL 短链使用
9. 可自定义返回的 `mimetype`
10. 支持阅读保护的**查看密码**（AES-GCM，加表单字段 `v`）
11. 支持条件 GET（`Last-Modified`/`If-Modified-Since`）
12. 默认开启 CORS（`Access-Control-Allow-Origin: *`）

## 使用方式

1. 你可以直接在网站（如 [shz.al](https://shz.al)）上上传、更新、删除粘贴。

2. 同时提供便捷的 HTTP API，详见 [API 文档](doc/api.md)。你可以使用 `curl` 等命令行工具轻松调用。

3. 目录中的 [pb](/scripts) Bash 脚本可简化命令行的调用体验。

## 限制

1. 若使用 Cloudflare Worker 免费套餐，每天最多约 100,000 次读取、1,000 次写入、1,000 次删除。
2. 受 Cloudflare KV 存储限制，每条粘贴最大不超过 25 MB。

## 部署

若你的域名托管在 Cloudflare 上，你可以将本服务部署在你的自有域名下。

1. 安装 `node` 与 `yarn`。

2. 在 Cloudflare Workers 控制台创建一个 KV 命名空间，并记录其 ID。

3. 克隆本仓库并进入目录。

4. 修改 `wrangler.toml` 中的相关配置（文件内注释有说明）。

5. 登录 Cloudflare 并按以下步骤部署：

```console
$ yarn install
$ yarn wrangler login
$ yarn deploy
```

6. 开始使用！

### 环境变量（wrangler.toml）

- `BASE_URL`：对外可访问的基础 URL，用于拼接返回链接。
- `FAVICON`（可选）：当访问 `/favicon.ico` 时重定向到此 URL。
- `CACHE_STATIC_PAGE_AGE`（可选）：静态页响应头 `Cache-Control: public, max-age=<age>`。
- `CACHE_PASTE_AGE`（可选）：粘贴读取响应头 `Cache-Control: public, max-age=<age>`。
- `[vars.BASIC_AUTH]`（可选）：Basic Auth 用户/密码映射。开启后，POST 与静态页访问需要认证。

## 认证（Auth）

如果你希望仅自己可上传（但所有人都可阅读），在 `wrangler.toml` 中加入下列配置：

```toml
[vars.BASIC_AUTH]
user1 = "passwd1"
user2 = "passwd2"
```

此后，对 POST 请求与所有静态页面的访问都需要提供 HTTP Basic Auth，示例：

```console
$ curl example-pb.com
HTTP basic auth is required

$ curl -Fc=@/path/to/file example-pb.com
HTTP basic auth is required

$ curl -u admin1:wrong-passwd -Fc=@/path/to/file example-pb.com
Error 401: incorrect passwd for basic auth

$ curl -u admin1:this-is-passwd-1 -Fc=@/path/to/file example-pb.com
{
  "url": "https://example-pb.com/YCDX",
  "suggestUrl": null,
  "admin": "https://example-pb.com/YCDX:Sij23HwbMjeZwKznY3K5trG8",
  "isPrivate": false
}
```

### CORS

- 所有非 302 响应会设置 `Access-Control-Allow-Origin: *`。
- 预检请求会返回 `Access-Control-Allow-Methods: GET,HEAD,PUT,POST,OPTIONS`，并回显 `Access-Control-Request-Headers`。

### 查看密码（阅读保护）

- 上传时传入表单字段 `v` 开启 AES-GCM 静态加密；读取时需在 URL 上携带 `?v=<password>`。
- 更新已保护的粘贴时需要再次提供 `v`；若未提供，将被拒绝以避免误去除保护。

### 缓存

- 当对象包含 `metadata.lastModified` 时，响应附带 `Last-Modified` 并支持 `If-Modified-Since`（命中返回 `304`）。
- `CACHE_PASTE_AGE`/`CACHE_STATIC_PAGE_AGE` 可用于设置粘贴/静态页面的 `Cache-Control`。

## 运维
删除粘贴：
```console
$ yarn delete-paste <name-of-paste>
```

列出粘贴：
```console
$ yarn wrangler kv:key list --binding PB > kv_list.json
```

## 开发

本地模拟运行：
```console
$ yarn dev
```

运行测试：
```console
$ yarn test
```

带覆盖率运行测试：
```console
$ yarn coverage
```
