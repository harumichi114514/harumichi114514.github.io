(() => {
  // <stdin>
  document.addEventListener("DOMContentLoaded", () => {
    const summarizeButton = document.getElementById("summarize-btn");
    const articleContentElement = document.getElementById("article-content");
    const summaryOutputElement = document.getElementById("summary-output");
    const summaryStatusElement = document.getElementById("summary-status");
    if (!summarizeButton || !articleContentElement || !summaryOutputElement || !summaryStatusElement) {
      console.error("\u6458\u8981\u5668\u9519\u8BEF\uFF1A\u672A\u627E\u5230\u4E00\u4E2A\u6216\u591A\u4E2A\u5FC5\u9700\u7684HTML\u5143\u7D20\u3002\u8BF7\u68C0\u67E5HTML\u548CJS\u4E2D\u7684ID\u662F\u5426\u4E00\u81F4\u3002");
      return;
    }
    summarizeButton.addEventListener("click", async function() {
      const articleText = articleContentElement.innerText.trim();
      if (!articleText) {
        summaryStatusElement.innerHTML = "<span>\u9519\u8BEF\uFF1A\u65E0\u6CD5\u83B7\u53D6\u6587\u7AE0\u5185\u5BB9\u3002</span>";
        summaryStatusElement.style.color = "red";
        summaryStatusElement.style.display = "flex";
        return;
      }
      const MAX_CHARS = 5e4;
      let textToSend = articleText;
      if (articleText.length > MAX_CHARS) {
        textToSend = articleText.substring(0, MAX_CHARS);
      }
      this.disabled = true;
      this.textContent = "\u751F\u6210\u4E2D...";
      summaryOutputElement.style.display = "none";
      summaryStatusElement.style.color = "var(--ai-summary-secondary-text-color)";
      summaryStatusElement.innerHTML = '<div class="spinner"></div><span>\u8BF7\u7A0D\u5019\uFF0CAI \u6B63\u5728\u601D\u8003...</span>';
      summaryStatusElement.style.display = "flex";
      try {
        const response = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToSend })
        });
        if (!response.ok) {
          let errorMsg = `\u9519\u8BEF\uFF1A\u8BF7\u6C42\u5931\u8D25\uFF0C\u72B6\u6001\u7801 ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData && errorData.error) errorMsg = `\u9519\u8BEF\uFF1A${errorData.error}`;
          } catch (e) {
          }
          throw new Error(errorMsg);
        }
        const data = await response.json();
        if (data && data.summary) {
          summaryOutputElement.textContent = data.summary;
          summaryOutputElement.style.display = "block";
          summaryStatusElement.style.display = "none";
        } else {
          throw new Error("\u9519\u8BEF\uFF1A\u670D\u52A1\u5668\u54CD\u5E94\u6210\u529F\uFF0C\u4F46\u672A\u8FD4\u56DE\u6709\u6548\u7684\u6458\u8981\u5185\u5BB9\u3002");
        }
      } catch (error) {
        console.error("\u6458\u8981\u751F\u6210\u5931\u8D25:", error);
        summaryStatusElement.innerHTML = `<span>${error.message}</span>`;
        summaryStatusElement.style.color = "red";
        summaryStatusElement.style.display = "flex";
        summaryOutputElement.style.display = "none";
      } finally {
        this.disabled = false;
        this.textContent = "\u91CD\u65B0\u751F\u6210";
      }
    });
  });
})();
