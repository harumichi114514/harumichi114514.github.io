// functions/api/summarize.js

// Gemini API 的基础 URL 和模型名称 (使用 Generative Language API)
// 你可以更换为其他模型，如 "gemini-1.5-flash-latest" 等
const GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";
/**
 * 处理 POST 请求以进行文章总结 (使用 Google Gemini API)
 * @param {EventContext} context - Pages Function 的上下文对象
 */
export async function onRequestPost(context) {
  try {
    // 1. 从请求体中获取文本
    const requestBody = await context.request.json();
    const textToSummarize = requestBody.text;

    if (!textToSummarize) {
      return new Response(JSON.stringify({ error: 'Missing "text" in request body' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. 从 Cloudflare Secrets 中获取 Gemini API 密钥
    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY not found in environment variables/secrets.");
      return new Response(JSON.stringify({ error: 'Gemini API key not configured' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. 构建 Gemini API 请求体
    //    - 设计 Prompt
    //    - 注意 Gemini API 的 content structure
    const prompt = `Please summarize the following article concisely and accurately. Extract the main points and key information:\n\n---\n${textToSummarize}\n---\n\nSummary:`;

    const requestPayload = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      // 可以添加 generationConfig 来控制输出，例如限制最大 token 数
      // generationConfig: {
      //   maxOutputTokens: 512,
      //   temperature: 0.7, // 控制创意性，总结任务通常用较低的值
      //   topP: 1.0,
      //   topK: 40
      // }
      // 可以添加 safetySettings 来调整内容过滤级别 (谨慎使用)
      // safetySettings: [
      //   { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      //   // ... 其他类别
      // ]
    };

    console.log("Sending text to Google Gemini API (gemini-pro)...");

    // 4. 调用 Gemini API
    const apiUrlWithKey = `${GEMINI_API_ENDPOINT}?key=${apiKey}`;

    const geminiResponse = await fetch(apiUrlWithKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    // 5. 处理 Gemini API 的响应
    if (!geminiResponse.ok) {
      // 如果 API 返回非 2xx 状态码，尝试解析错误信息
      let errorBody = null;
      try {
        errorBody = await geminiResponse.json();
        console.error("Gemini API Error Response:", JSON.stringify(errorBody, null, 2));
      } catch (e) {
        console.error("Could not parse Gemini error response JSON:", e);
      }
      // 构造一个更具体的错误消息
      let errorMessage = `Gemini API request failed: ${geminiResponse.status} ${geminiResponse.statusText}`;
      if (errorBody && errorBody.error && errorBody.error.message) {
         errorMessage += ` - ${errorBody.error.message}`;
      } else if (errorBody) {
         errorMessage += ` - See Function logs for details.`;
      }
      throw new Error(errorMessage);
    }

    const responseData = await geminiResponse.json();
    console.log("Received raw response from Gemini:", JSON.stringify(responseData, null, 2));

    // 6. 从响应中提取总结文本
    //    - 需要检查响应结构，防止因内容过滤或其他原因导致没有有效候选内容
    let summaryText = '';
    if (responseData.candidates && responseData.candidates.length > 0 &&
        responseData.candidates[0].content && responseData.candidates[0].content.parts &&
        responseData.candidates[0].content.parts.length > 0 && responseData.candidates[0].content.parts[0].text) {

      summaryText = responseData.candidates[0].content.parts[0].text.trim();

      // 检查是否因为安全原因被阻止 (finishReason == "SAFETY")
      if (responseData.candidates[0].finishReason === "SAFETY") {
        console.warn("Gemini response potentially blocked due to safety settings.");
        // 你可以选择返回一个特定消息，或仍然尝试使用可能不完整的 summaryText
        // summaryText = "[Summary blocked due to safety settings]";
      } else if (responseData.candidates[0].finishReason === "MAX_TOKENS") {
         console.warn("Gemini summary may be truncated due to max output tokens limit.");
      }

    } else if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
        // 输入被阻止
        console.error(`Gemini prompt blocked due to: ${responseData.promptFeedback.blockReason}`);
        throw new Error(`Content could not be processed by Gemini due to: ${responseData.promptFeedback.blockReason}`);
    } else {
      // 没有找到有效的总结文本
      console.error("Could not find summary text in Gemini response structure:", responseData);
      throw new Error('Gemini API returned a response, but no summary text was found.');
    }

    if (!summaryText) {
        throw new Error('Gemini generated an empty summary.');
    }

    // 7. 返回给前端
    return new Response(JSON.stringify({ summary: summaryText }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error during Gemini summarization:', error);
    // 返回一个通用的错误信息，或者更具体的错误（如果可以从 error.message 中获取）
    const clientErrorMessage = error.message.includes("API key not valid") || error.message.includes("API key not configured")
        ? "API configuration error."
        : error.message.includes("Content could not be processed")
        ? error.message // 把 Gemini 的 blockReason 传递给前端
        : "Failed to summarize text using Gemini.";

    return new Response(JSON.stringify({ error: clientErrorMessage }), {
      status: 500, // 保持 500 内部服务器错误状态码
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// 保留 onRequest 函数以处理非 POST 请求
export async function onRequest(context) {
   if (context.request.method !== 'POST') {
      return new Response(`Please use the POST method. Method used: ${context.request.method}`, {
          status: 405, headers: { 'Allow': 'POST' }
      });
   }
}