// functions/api/comments.js

// Turnstile 验证函数
async function verifyTurnstile(token, secretKey) {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            secret: secretKey,
            response: token,
        }),
    });
    const data = await response.json();
    return data.success;
}

export async function onRequest(context) {
    // 从 context 中获取环境变量和 D1 数据库绑定
    const { request, env } = context;
    const DB = env.DB;
    const TURNSTILE_SECRET_KEY = env.TURNSTILE_SECRET_KEY; // 需要在 Pages 后台设置

    // 设置 CORS 头部，允许你的网站跨域请求
    const headers = {
        'Access-Control-Allow-Origin': '*', // 在生产环境中最好指定为你的域名
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers });
    }

    // 处理 GET 请求：获取评论
    if (request.method === 'GET') {
        const url = new URL(request.url);
        const slug = url.searchParams.get('slug');

        if (!slug) {
            return new Response('Missing slug parameter', { status: 400, headers });
        }

        try {
            const { results } = await DB.prepare(
                'SELECT author, body, created_at FROM comments WHERE post_slug = ? ORDER BY created_at DESC'
            ).bind(slug).all();

            return new Response(JSON.stringify(results), {
                headers: { ...headers, 'Content-Type': 'application/json' },
            });
        } catch (e) {
            return new Response(e.message, { status: 500, headers });
        }
    }

    // 处理 POST 请求：提交评论
    if (request.method === 'POST') {
        try {
            const { author, body, slug, 'cf-turnstile-response': turnstileToken } = await request.json();

            if (!author || !body || !slug || !turnstileToken) {
                return new Response('Missing required fields', { status: 400, headers });
            }

            // 验证 Turnstile Token
            const isValid = await verifyTurnstile(turnstileToken, TURNSTILE_SECRET_KEY);
            if (!isValid) {
                return new Response('Invalid Turnstile token', { status: 403, headers });
            }

            // 插入数据库
            await DB.prepare(
                'INSERT INTO comments (post_slug, author, body) VALUES (?, ?, ?)'
            ).bind(slug, author, body).run();

            return new Response('Comment added successfully', { status: 201, headers });
        } catch (e) {
            return new Response(e.message, { status: 500, headers });
        }
    }

    return new Response('Method not allowed', { status: 405, headers });
}