// assets/js/summarizer.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. 获取需要操作的 HTML 元素
    const summarizeButton = document.getElementById('summarize-btn');
    const articleContentElement = document.getElementById('article-content');
    const summaryOutputElement = document.getElementById('summary-output');
    const summaryStatusElement = document.getElementById('summary-status');

    // 确保所有需要的元素都存在
    if (!summarizeButton || !articleContentElement || !summaryOutputElement || !summaryStatusElement) {
        console.error("摘要器错误：未找到一个或多个必需的HTML元素。请检查HTML和JS中的ID是否一致。");
        return;
    }

    // 2. 为“生成摘要”按钮添加点击事件
    summarizeButton.addEventListener('click', async function() {

        // 3. 获取文章内容
        const articleText = articleContentElement.innerText.trim();
        if (!articleText) {
            summaryStatusElement.innerHTML = '<span>错误：无法获取文章内容。</span>';
            summaryStatusElement.style.color = 'red';
            summaryStatusElement.style.display = 'flex';
            return;
        }

        // （可选）截断过长文本
        const MAX_CHARS = 50000;
        let textToSend = articleText;
        if (articleText.length > MAX_CHARS) {
            textToSend = articleText.substring(0, MAX_CHARS);
        }

        // --- 核心改动：进入“加载中”状态，使用新的样式 ---
        this.disabled = true;
        this.textContent = '生成中...';
        summaryOutputElement.style.display = 'none'; // 隐藏旧的摘要
        summaryStatusElement.style.color = 'var(--ai-summary-secondary-text-color)'; // 恢复默认颜色
        summaryStatusElement.innerHTML = '<div class="spinner"></div><span>请稍候，AI 正在思考...</span>';
        summaryStatusElement.style.display = 'flex';

        // 4. 使用 try...catch...finally 处理API请求
        try {
            const response = await fetch('/api/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToSend }),
            });

            if (!response.ok) {
                let errorMsg = `错误：请求失败，状态码 ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.error) errorMsg = `错误：${errorData.error}`;
                } catch (e) { /* 忽略解析错误 */ }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            if (data && data.summary) {
                // --- 核心改动：成功后显示结果 ---
                summaryOutputElement.textContent = data.summary;
                summaryOutputElement.style.display = 'block'; // 显示摘要容器
                summaryStatusElement.style.display = 'none'; // 隐藏状态提示
            } else {
                throw new Error('错误：服务器响应成功，但未返回有效的摘要内容。');
            }

        } catch (error) {
            // --- 核心改动：处理错误 ---
            console.error('摘要生成失败:', error);
            summaryStatusElement.innerHTML = `<span>${error.message}</span>`;
            summaryStatusElement.style.color = 'red'; // 错误信息用红色突出
            summaryStatusElement.style.display = 'flex';
            summaryOutputElement.style.display = 'none'; // 确保摘要区域是隐藏的

        } finally {
            // --- 核心改动：无论成功与否，恢复按钮状态 ---
            this.disabled = false;
            this.textContent = '重新生成'; // 用户可能想再次尝试
        }
    });
});