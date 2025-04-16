(() => {
  // <stdin>
  document.addEventListener("DOMContentLoaded", () => {
    const summarizeButton = document.getElementById("summarize-btn");
    const articleContentElement = document.getElementById("article-content");
    const summaryOutputElement = document.getElementById("summary-output");
    const summaryStatusElement = document.getElementById("summary-status");
    console.log("Summarizer script loaded.");
    console.log("Button:", summarizeButton);
    console.log("Article Content Element:", articleContentElement);
    console.log("Summary Output Element:", summaryOutputElement);
    console.log("Summary Status Element:", summaryStatusElement);
    if (!summarizeButton || !articleContentElement || !summaryOutputElement || !summaryStatusElement) {
      console.error("Summarizer Error: One or more required HTML elements (button, article content, status, output) not found. Check IDs in HTML and JS.");
      return;
    }
    summarizeButton.addEventListener("click", async () => {
      console.log("Summarize button clicked!");
      const articleText = articleContentElement.innerText.trim();
      console.log("Extracted text length:", articleText ? articleText.length : 0);
      if (!articleText) {
        summaryStatusElement.textContent = "\u9519\u8BEF\uFF1A\u65E0\u6CD5\u83B7\u53D6\u6587\u7AE0\u5185\u5BB9\u3002";
        summaryStatusElement.style.color = "red";
        return;
      }
      const MAX_CHARS = 5e4;
      let textToSend = articleText;
      let wasTruncated = false;
      if (articleText.length > MAX_CHARS) {
        console.warn(`Article text too long (${articleText.length} chars), truncating to ${MAX_CHARS} chars for summarization.`);
        textToSend = articleText.substring(0, MAX_CHARS);
        wasTruncated = true;
      }
      summaryStatusElement.textContent = wasTruncated ? `\u6CE8\u610F\uFF1A\u539F\u6587\u8FC7\u957F\uFF0C\u6B63\u5728\u603B\u7ED3\u524D ${MAX_CHARS} \u4E2A\u5B57\u7B26...` : "\u6B63\u5728\u751F\u6210\u6458\u8981\uFF0C\u8BF7\u7A0D\u5019...";
      summaryStatusElement.style.color = "#555";
      summaryOutputElement.textContent = "";
      summarizeButton.disabled = true;
      summarizeButton.style.cursor = "wait";
      console.log("Sending text (first 50 chars):", textToSend.substring(0, 50) + "...");
      console.log("Before fetch to /api/summarize");
      try {
        const response = await fetch("/api/summarize", {
          // 使用相对路径指向 Function
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text: textToSend })
          // 将文本放在请求体中
        });
        console.log("Fetch response received:", response.status, response.statusText);
        if (!response.ok) {
          let errorMsg = `\u9519\u8BEF\uFF1A\u8BF7\u6C42\u5931\u8D25\uFF0C\u72B6\u6001\u7801 ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
              errorMsg = `\u9519\u8BEF\uFF1A${errorData.error}`;
            }
          } catch (e) {
            console.error("Could not parse error response JSON:", e);
          }
          throw new Error(errorMsg);
        }
        const data = await response.json();
        console.log("Data received from backend:", data);
        if (data && data.summary) {
          summaryOutputElement.textContent = data.summary;
          summaryStatusElement.textContent = "\u6458\u8981\u751F\u6210\u6210\u529F\uFF01";
          summaryStatusElement.style.color = "green";
        } else {
          throw new Error("\u9519\u8BEF\uFF1A\u670D\u52A1\u5668\u54CD\u5E94\u6210\u529F\uFF0C\u4F46\u672A\u8FD4\u56DE\u6709\u6548\u7684\u6458\u8981\u5185\u5BB9\u3002");
        }
      } catch (error) {
        console.error("Summarization failed:", error);
        summaryStatusElement.textContent = error.message;
        summaryStatusElement.style.color = "red";
        summaryOutputElement.textContent = "";
      } finally {
        summarizeButton.disabled = false;
        summarizeButton.style.cursor = "pointer";
        console.log("Summarize function finished.");
      }
    });
  });
})();
