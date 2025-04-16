// assets/js/summarizer.js

document.addEventListener('DOMContentLoaded', () => {
    // 获取需要操作的 HTML 元素
    const summarizeButton = document.getElementById('summarize-btn');
    // 确保这里的 'article-content' ID 与你 Hugo 模板中包含文章主体的元素的 ID 一致
    const articleContentElement = document.getElementById('article-content');
    const summaryOutputElement = document.getElementById('summary-output');
    const summaryStatusElement = document.getElementById('summary-status');

    // --- 调试日志：检查脚本是否加载以及元素是否找到 ---
    console.log("Summarizer script loaded.");
    console.log("Button:", summarizeButton);
    console.log("Article Content Element:", articleContentElement);
    console.log("Summary Output Element:", summaryOutputElement);
    console.log("Summary Status Element:", summaryStatusElement);
    // --- 结束调试日志 ---

    // 确保所有需要的元素都存在于页面上，否则脚本无法工作
    if (!summarizeButton || !articleContentElement || !summaryOutputElement || !summaryStatusElement) {
        console.error("Summarizer Error: One or more required HTML elements (button, article content, status, output) not found. Check IDs in HTML and JS.");
        // 如果按钮不存在，可能不需要显示状态和输出区域，但这里我们仅记录错误
        return; // 停止执行后续代码
    }

    // 为“生成摘要”按钮添加点击事件监听器
    summarizeButton.addEventListener('click', async () => {
        console.log("Summarize button clicked!"); // 调试日志

        // 1. 获取文章文本内容
        const articleText = articleContentElement.innerText.trim(); // 使用 innerText 获取纯文本并去除首尾空格
        console.log("Extracted text length:", articleText ? articleText.length : 0); // 调试日志

        if (!articleText) {
            summaryStatusElement.textContent = '错误：无法获取文章内容。';
            summaryStatusElement.style.color = 'red';
            return;
        }

        // 2. （可选但推荐）检查并截断文本长度
        // Worker AI 模型有输入长度限制（例如 BART 大约 1024 个 token，LLama 可能更多但也有上限）
        // 这里设置一个大概的字符数限制（需要根据模型调整），4000 字符约等于 800-1000 英文单词
        const MAX_CHARS = 50000;
        let textToSend = articleText;
        let wasTruncated = false;

        if (articleText.length > MAX_CHARS) {
            console.warn(`Article text too long (${articleText.length} chars), truncating to ${MAX_CHARS} chars for summarization.`);
            textToSend = articleText.substring(0, MAX_CHARS);
            wasTruncated = true;
        }

        // 3. 更新 UI，显示加载状态
        summaryStatusElement.textContent = wasTruncated
            ? `注意：原文过长，正在总结前 ${MAX_CHARS} 个字符...`
            : '正在生成摘要，请稍候...';
        summaryStatusElement.style.color = '#555'; // 重置颜色
        summaryOutputElement.textContent = ''; // 清空之前的摘要
        summarizeButton.disabled = true; // 禁用按钮，防止重复点击
        summarizeButton.style.cursor = 'wait'; // 更改鼠标样式

        console.log("Sending text (first 50 chars):", textToSend.substring(0, 50) + "..."); // 调试日志
        console.log("Before fetch to /api/summarize"); // 调试日志

        // 4. 使用 try...catch...finally 来处理请求和错误
        try {
            // 发送 POST 请求到 Cloudflare Pages Function
            const response = await fetch('/api/summarize', { // 使用相对路径指向 Function
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: textToSend }), // 将文本放在请求体中
            });

            console.log("Fetch response received:", response.status, response.statusText); // 调试日志

            // 检查后端是否成功处理（状态码 2xx）
            if (!response.ok) {
                let errorMsg = `错误：请求失败，状态码 ${response.status}`;
                try {
                    // 尝试从后端获取更详细的错误信息
                    const errorData = await response.json();
                    if (errorData && errorData.error) {
                        errorMsg = `错误：${errorData.error}`; // 使用后端返回的错误信息
                    }
                } catch (e) {
                    // 如果解析后端错误信息失败，使用通用错误
                    console.error("Could not parse error response JSON:", e);
                }
                throw new Error(errorMsg); // 抛出错误，会被下面的 catch 捕获
            }

            // 解析后端返回的 JSON 数据
            const data = await response.json();
            console.log("Data received from backend:", data); // 调试日志

            // 检查返回的数据中是否有 summary 字段
            if (data && data.summary) {
                // 5. 显示总结结果
                summaryOutputElement.textContent = data.summary;
                summaryStatusElement.textContent = '摘要生成成功！';
                summaryStatusElement.style.color = 'green';
            } else {
                // 如果后端成功响应但没有 summary，也视为错误
                throw new Error('错误：服务器响应成功，但未返回有效的摘要内容。');
            }

        } catch (error) {
            // 6. 处理请求过程中的任何错误（网络错误、后端错误、解析错误等）
            console.error('Summarization failed:', error); // 在控制台记录详细错误
            summaryStatusElement.textContent = error.message; // 向用户显示错误信息
            summaryStatusElement.style.color = 'red';
            summaryOutputElement.textContent = ''; // 清空输出区域
        } finally {
            // 7. 无论成功还是失败，最后都要恢复按钮状态
            summarizeButton.disabled = false;
            summarizeButton.style.cursor = 'pointer';
            console.log("Summarize function finished."); // 调试日志
        }
    });
});