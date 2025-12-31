export function getPasswordPage(env, error) {
    const errorHtml = error ? `<p style="color: var(--color-red); margin-bottom: 1rem; font-size: 14px;">${error}</p>` : '';
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>需要密码</title>
    <style>
        :root {
            --color-bg: #ffffff;
            --color-bg-secondary: #f6f8fa;
            --color-green: #2ea44f;
            --color-green-hover: #2c974b;
            --color-text: #24292e;
            --color-border: #eaeaea;
            --color-red: #d73a49;
        }
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: var(--color-bg-secondary);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .container {
            background: var(--color-bg);
            padding: 2.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            text-align: center;
            width: 100%;
            max-width: 300px;
            border: 1px solid var(--color-border);
        }
        h3 {
            margin-top: 0;
            margin-bottom: 1.5rem;
            color: var(--color-text);
            font-weight: 600;
        }
        input {
            width: 100%;
            padding: 10px;
            margin-bottom: 16px;
            border: 1px solid #ddd;
            border-radius: 6px;
            box-sizing: border-box;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        input:focus {
            border-color: var(--color-green);
            box-shadow: 0 0 0 3px rgba(46, 164, 79, 0.1);
        }
        button {
            width: 100%;
            padding: 10px;
            background-color: var(--color-green);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            transition: background-color 0.2s;
        }
        button:hover {
            background-color: var(--color-green-hover);
        }
        .footer {
            margin-top: 1.5rem;
            font-size: 12px;
            color: #999;
        }
        .footer a {
            color: #999;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h3>🔒 加密内容</h3>
        ${errorHtml}
        <form method="POST">
            <input type="password" name="v" placeholder="输入查看密码" required autofocus autocomplete="off">
            <button type="submit">解锁访问</button>
        </form>
        <div class="footer">
            <a href="/">返回首页</a>
        </div>
    </div>
</body>
</html>`
}