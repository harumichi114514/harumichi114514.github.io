// functions/api/summarize.js

// --- 配置 Gemini ---
const GEMINI_MODEL_NAME = "gemini-1.5-flash-latest"; // Using the latest Flash model
const GEMINI_API_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// --- 配置 硅基流动 (DeepSeek) ---
const DEEPSEEK_API_ENDPOINT = "https://api.siliconflow.cn/v1/chat/completions"; // From docs
const DEEPSEEK_MODEL_NAME = "THUDM/GLM-4-9B-0414"; // As requested

/**
 * 处理 POST 请求，根据用户地理位置路由到不同 AI 服务进行总结
 * @param {EventContext} context - Pages Function 的上下文对象
 */
export async function onRequestPost(context) {
  try {
    // 1. 获取输入文本
    const requestBody = await context.request.json();
    const textToSummarize = requestBody.text;
    if (!textToSummarize) {
      return new Response(JSON.stringify({ error: 'Missing "text" in request body' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. 获取 API 密钥 (确保已在 Cloudflare Secrets 中设置)
    const geminiApiKey = context.env.GEMINI_API_KEY;
    const deepseekApiKey = context.env.DEEPSEEK_API_KEY; // 使用你之前设置的 Secret 名称

    // 3. 获取用户国家代码
    const country = context.request.cf?.country?.toUpperCase();
    console.log(`Detected user country: ${country}`);

    let summaryText = '';
    let errorOccurred = null;
    let selectedService = ''; // 用于日志记录

    // 4. 根据国家代码选择 API
    if (country === 'CN' || country === 'HK') {
      // --- 调用 硅基流动 DeepSeek API ---
      selectedService = 'DeepSeek';
      console.log(`Routing to ${selectedService} API (Model: ${DEEPSEEK_MODEL_NAME})...`);
      if (!deepseekApiKey) {
        throw new Error("DeepSeek API key not configured in Cloudflare secrets.");
      }

      try {
        // --- 根据国家代码定制 DeepSeek Prompt ---
        let userPromptForDeepseek = '';
        let systemPromptForDeepseek = "You are an assistant skilled in summarizing articles concisely and accurately."; // 通用系统提示

        if (country === 'CN') {
          // 中国大陆：使用简体中文提示
          console.log("Using Simplified Chinese prompt for DeepSeek.");
          // 可以选择性地让系统提示也本地化，但通常用户提示更关键
          // systemPromptForDeepseek = "你是一个擅长用简体中文精确并简洁总结文章的助手。";
          userPromptForDeepseek = `请用简体中文总结以下文章：\n\n---\n${textToSummarize}\n---\n\n总结：`;
        } else { // country === 'HK'
          // 香港：使用繁体中文提示
          console.log("Using Traditional Chinese prompt for DeepSeek.");
          // systemPromptForDeepseek = "你是一個擅長用繁體中文精確並簡潔總結文章的助手。";
          userPromptForDeepseek = `請用繁體中文總結以下文章：\n\n---\n${textToSummarize}\n---\n\n總結：`;
        }
        // --- 结束 Prompt 定制 ---

        // 构建 DeepSeek API 请求体 (使用定制后的 Prompt)
        const deepseekPayload = {
          model: DEEPSEEK_MODEL_NAME,
          messages: [
            { role: "system", content: systemPromptForDeepseek }, // 使用通用或定制的系统提示
            { role: "user", content: userPromptForDeepseek }      // 使用特定语言的用户提示
          ],
          // ... 其他 DeepSeek 参数 ...
        };

        console.log("Sending payload to DeepSeek:", JSON.stringify(deepseekPayload)); // 记录发送的 payload

        const deepseekResponse = await fetch(DEEPSEEK_API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deepseekApiKey}`,
          },
          body: JSON.stringify(deepseekPayload),
        });

        // ... (处理 DeepSeek 响应的代码保持不变) ...
         if (!deepseekResponse.ok) {
           const errorBody = await deepseekResponse.text();
           console.error(`DeepSeek API Error (${deepseekResponse.status}): ${errorBody}`);
           let detailedError = "";
           try {
              const jsonError = JSON.parse(errorBody);
              if (jsonError && jsonError.message) detailedError = ` - ${jsonError.message}`;
           } catch(e) { /* 忽略解析错误 */ }
           throw new Error(`DeepSeek API request failed: ${deepseekResponse.status} ${deepseekResponse.statusText}${detailedError}`);
         }
         const responseData = await deepseekResponse.json();
         console.log("Received raw response from DeepSeek:", JSON.stringify(responseData, null, 2));
         if (responseData.choices && responseData.choices.length > 0 && responseData.choices[0].message && responseData.choices[0].message.content) {
           summaryText = responseData.choices[0].message.content.trim();
         } else {
           throw new Error('DeepSeek API returned a response, but no summary text was found.');
         }
         if (!summaryText) {
             throw new Error('DeepSeek generated an empty summary.');
         }
         console.log(`Successfully received summary from ${selectedService}.`);

      } catch (err) {
        errorOccurred = err;
        console.error(`Error calling ${selectedService} API:`, err);
      }
      
    } else {
      // --- 调用 Google Gemini API ---
      selectedService = 'Google Gemini';
      console.log(`Routing to ${selectedService} API (Model: ${GEMINI_MODEL_NAME})...`);
      if (!geminiApiKey) {
        throw new Error("Gemini API key not configured in Cloudflare secrets.");
      }

      try {
        // 构建 Gemini API 请求体
        const geminiPayload = {
          contents: [{ parts: [{ text: `Please summarize the following article concisely and accurately:\n\n---\n${textToSummarize}\n---\n\nSummary:` }] }],
          // generationConfig: { maxOutputTokens: 1024 } // 可选
        };
        const geminiApiUrl = `${GEMINI_API_ENDPOINT_BASE}/${GEMINI_MODEL_NAME}:generateContent?key=${geminiApiKey}`;

        const geminiResponse = await fetch(geminiApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload),
        });

        if (!geminiResponse.ok) {
          let errorBody = null;
          let errorMessage = `Gemini API request failed: ${geminiResponse.status} ${geminiResponse.statusText}`;
          try {
            errorBody = await geminiResponse.json();
            console.error("Gemini API Error Response:", JSON.stringify(errorBody, null, 2));
            if (errorBody && errorBody.error && errorBody.error.message) {
              if (errorBody.error.message.includes("User location is not supported")) {
                 errorMessage = "Gemini API Error: User location not supported for API use.";
              } else {
                 errorMessage += ` - ${errorBody.error.message}`;
              }
            } else if (errorBody) {
               errorMessage += ` - See Function logs for details.`;
            }
          } catch (e) { console.error("Could not parse Gemini error response JSON:", e); }
          throw new Error(errorMessage);
        }

        const responseData = await geminiResponse.json();
        console.log("Received raw response from Gemini:", JSON.stringify(responseData, null, 2));

        // 从 Gemini 响应中提取总结文本
        if (responseData.candidates && responseData.candidates.length > 0 &&
            responseData.candidates[0].content && responseData.candidates[0].content.parts &&
            responseData.candidates[0].content.parts.length > 0 && responseData.candidates[0].content.parts[0].text) {
          summaryText = responseData.candidates[0].content.parts[0].text.trim();
          if (responseData.candidates[0].finishReason === "SAFETY") { console.warn("Gemini response potentially blocked due to safety settings."); }
          else if (responseData.candidates[0].finishReason === "MAX_TOKENS") { console.warn("Gemini summary may be truncated due to max output tokens limit."); }
        } else if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
          throw new Error(`Content could not be processed by Gemini due to: ${responseData.promptFeedback.blockReason}`);
        } else {
          throw new Error('Gemini API returned a response, but no summary text was found.');
        }

        if (!summaryText) {
            throw new Error('Gemini generated an empty summary.');
        }
        console.log(`Successfully received summary from ${selectedService}.`);

      } catch (err) {
        errorOccurred = err; // 捕获 Gemini 调用错误
        console.error(`Error calling ${selectedService} API:`, err);
      }
    }

    // 5. 处理最终结果或错误
    if (errorOccurred) {
      // 如果在调用相应的 API 时出错，重新抛出以触发外部 catch
      throw errorOccurred;
    }

    // 6. 返回成功响应
    return new Response(JSON.stringify({ summary: summaryText }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // 最外层错误处理
    console.error('Overall error in summarization function:', error);
    const clientErrorMessage = error.message.includes("API key not configured")
        ? "API configuration error."
        : error.message.includes("Content could not be processed by Gemini")
        ? error.message // Gemini 特定内容错误
        : error.message.includes("User location not supported for API use")
        ? "Summary service unavailable in this region via Gemini." // Gemini 地理位置错误
        : error.message.startsWith("DeepSeek API request failed") || error.message.startsWith("Gemini API request failed")
        ? "AI service request failed. Please try again later." // API 调用失败通用
        : error.message.includes("empty summary") // AI 返回空
        ? `The AI model (${error.message.includes('DeepSeek') ? 'DeepSeek' : 'Gemini'}) returned an empty summary.`
        : "Failed to summarize text."; // 其他通用

    return new Response(JSON.stringify({ error: clientErrorMessage }), {
      status: 500,
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