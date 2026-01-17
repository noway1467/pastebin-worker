export function getPasswordPage(env, error) {
    const errorHtml = error ? `<p style="color: #dc3545; margin-bottom: 1.2rem; font-size: 14px; font-weight: 500;">${error}</p>` : '';
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>内容已加密</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
            padding: 20px;
        }
        .container {
            background: #ffffff;
            padding: 3rem 2.5rem;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
            text-align: center;
            width: 100%;
            max-width: 380px;
            border: 1px solid rgba(0, 0, 0, 0.06);
        }
        .lock-icon {
            font-size: 48px;
            margin-bottom: 1.5rem;
            opacity: 0.9;
        }
        h3 {
            margin-bottom: 0.8rem;
            color: #1a1a1a;
            font-weight: 600;
            font-size: 24px;
            letter-spacing: -0.5px;
        }
        .subtitle {
            color: #666;
            font-size: 14px;
            margin-bottom: 2rem;
            line-height: 1.5;
        }
        input {
            width: 100%;
            padding: 14px 18px;
            margin-bottom: 20px;
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            font-size: 15px;
            outline: none;
            transition: all 0.3s ease;
            background: #fafafa;
        }
        input:focus {
            border-color: #1a1a1a;
            background: #ffffff;
            box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.05);
        }
        input::placeholder {
            color: #999;
        }
        button {
            width: 100%;
            padding: 14px;
            background: #1a1a1a;
            color: white;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            font-weight: 600;
            font-size: 15px;
            transition: all 0.3s ease;
            letter-spacing: 0.3px;
        }
        button:hover {
            background: #000000;
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }
        button:active {
            transform: translateY(0);
        }
        .footer {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid #f0f0f0;
        }
        .footer a {
            color: #666;
            text-decoration: none;
            font-size: 13px;
            transition: color 0.2s;
        }
        .footer a:hover {
            color: #1a1a1a;
        }
        .error-message {
            background: #fff5f5;
            border: 1px solid #ffebee;
            border-radius: 10px;
            padding: 12px 16px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="lock-icon">🔒</div>
        <h3>内容已加密</h3>
        <p class="subtitle">请输入密码以查看内容</p>
        ${errorHtml ? `<div class="error-message">${errorHtml}</div>` : ''}
        <form id="passwordForm">
            <input type="password" id="passwordInput" name="v" placeholder="请输入访问密码" required autofocus autocomplete="off">
            <button type="submit">解锁查看</button>
        </form>
        <div class="footer">
            <a href="/">← 返回首页</a>
        </div>
    </div>
    <script>
        document.getElementById('passwordForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const password = document.getElementById('passwordInput').value;
            if (!password) return;
            
            // Add password to URL and reload
            const url = new URL(window.location.href);
            url.searchParams.set('v', password);
            window.location.href = url.toString();
        });
    </script>
</body>
</html>`
}