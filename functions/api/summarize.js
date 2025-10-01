// functions/api/summarize.js

// --- 配置 nCN (非中国区域) 服务提供商 (当前为 Google Gemini) ---
const NCN_PROVIDER_MODEL_NAME = "gemini-2.0-flash-lite";
const NCN_PROVIDER_API_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// --- 配置 CN (中国区域) 服务提供商 (当前为 智谱AI BigModel) ---
const CN_PROVIDER_API_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const CN_PROVIDER_MODEL_NAME = "glm-4.5-flash"; // 根据要求使用 GLM-4.5-Flash

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
    // 建议使用新的 Secret 名称以匹配代码的通用性
    const ncnApiKey = context.env.NCN_PROVIDER_API_KEY; // 例如，之前是 GEMINI_API_KEY
    const cnApiKey = context.env.CN_PROVIDER_API_KEY;    // 例如，之前是 DEEPSEEK_API_KEY, 现在应为智谱AI的key

    // 3. 获取用户国家代码
    const country = context.request.cf?.country?.toUpperCase();
    console.log(`Detected user country: ${country}`);

    let summaryText = '';
    let errorOccurred = null;
    let selectedService = ''; // 用于日志记录

    // 4. 根据国家代码选择 API
    if (country === 'CN' || country === 'HK') {
      // --- 调用 CN Provider API (智谱AI BigModel) ---
      selectedService = 'CN Provider (BigModel)';
      console.log(`Routing to ${selectedService} API (Model: ${CN_PROVIDER_MODEL_NAME})...`);
      if (!cnApiKey) {
        throw new Error("CN Provider API key not configured in Cloudflare secrets.");
      }

      try {
        // --- 根据国家代码定制 Prompt ---
        let userPromptForCn = '';
        let systemPromptForCn = "You are an assistant skilled in summarizing articles concisely and accurately.";

        if (country === 'CN') {
          console.log("Using Simplified Chinese prompt for CN Provider.");
          userPromptForCn = `请用简体中文总结以下文章：\n\n---\n${textToSummarize}\n---\n\n总结：`;
        } else { // country === 'HK'
          console.log("Using Traditional Chinese prompt for CN Provider.");
          userPromptForCn = `請用繁體中文總結以下文章：\n\n---\n${textToSummarize}\n---\n\n總結：`;
        }
        // --- 结束 Prompt 定制 ---

        // 构建 CN Provider API 请求体 (智谱AI API 格式与 OpenAI 兼容)
        const cnPayload = {
          model: CN_PROVIDER_MODEL_NAME,
          messages: [
            { role: "system", content: systemPromptForCn },
            { role: "user", content: userPromptForCn }
          ],
        };

        console.log("Sending payload to CN Provider:", JSON.stringify(cnPayload));

        const cnProviderResponse = await fetch(CN_PROVIDER_API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 智谱AI 使用 JWT 格式的 Bearer Token，需要特殊处理
            'Authorization': `Bearer ${cnApiKey}`,
          },
          body: JSON.stringify(cnPayload),
        });

         if (!cnProviderResponse.ok) {
           const errorBody = await cnProviderResponse.text();
           console.error(`CN Provider API Error (${cnProviderResponse.status}): ${errorBody}`);
           let detailedError = "";
           try {
              const jsonError = JSON.parse(errorBody);
              if (jsonError && jsonError.error && jsonError.error.message) detailedError = ` - ${jsonError.error.message}`;
           } catch(e) { /* 忽略解析错误 */ }
           throw new Error(`CN Provider API request failed: ${cnProviderResponse.status} ${cnProviderResponse.statusText}${detailedError}`);
         }
         
         const responseData = await cnProviderResponse.json();
         console.log("Received raw response from CN Provider:", JSON.stringify(responseData, null, 2));

         if (responseData.choices && responseData.choices.length > 0 && responseData.choices[0].message && responseData.choices[0].message.content) {
           summaryText = responseData.choices[0].message.content.trim();
         } else {
           throw new Error('CN Provider API returned a response, but no summary text was found.');
         }

         if (!summaryText) {
             throw new Error('CN Provider generated an empty summary.');
         }
         console.log(`Successfully received summary from ${selectedService}.`);

      } catch (err) {
        errorOccurred = err;
        console.error(`Error calling ${selectedService} API:`, err);
      }
      
    } else {
      // --- 调用 nCN Provider API (Google Gemini) ---
      selectedService = 'nCN Provider (Gemini)';
      console.log(`Routing to ${selectedService} API (Model: ${NCN_PROVIDER_MODEL_NAME})...`);
      if (!ncnApiKey) {
        throw new Error("nCN Provider API key not configured in Cloudflare secrets.");
      }

      try {
        // 构建 Gemini API 请求体
        const ncnPayload = {
          contents: [{ parts: [{ text: `Please summarize the following article concisely and accurately:\n\n---\n${textToSummarize}\n---\n\nSummary:` }] }],
        };
        const ncnApiUrl = `${NCN_PROVIDER_API_ENDPOINT_BASE}/${NCN_PROVIDER_MODEL_NAME}:generateContent?key=${ncnApiKey}`;

        const ncnResponse = await fetch(ncnApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ncnPayload),
        });

        if (!ncnResponse.ok) {
          let errorBody = null;
          let errorMessage = `nCN Provider API request failed: ${ncnResponse.status} ${ncnResponse.statusText}`;
          try {
            errorBody = await ncnResponse.json();
            console.error("nCN Provider API Error Response:", JSON.stringify(errorBody, null, 2));
            if (errorBody && errorBody.error && errorBody.error.message) {
              if (errorBody.error.message.includes("User location is not supported")) {
                 errorMessage = "nCN Provider (Gemini) Error: User location not supported for API use.";
              } else {
                 errorMessage += ` - ${errorBody.error.message}`;
              }
            } else if (errorBody) {
               errorMessage += ` - See Function logs for details.`;
            }
          } catch (e) { console.error("Could not parse nCN Provider error response JSON:", e); }
          throw new Error(errorMessage);
        }

        const responseData = await ncnResponse.json();
        console.log("Received raw response from nCN Provider:", JSON.stringify(responseData, null, 2));

        if (responseData.candidates && responseData.candidates.length > 0 &&
            responseData.candidates[0].content && responseData.candidates[0].content.parts &&
            responseData.candidates[0].content.parts.length > 0 && responseData.candidates[0].content.parts[0].text) {
          summaryText = responseData.candidates[0].content.parts[0].text.trim();
          if (responseData.candidates[0].finishReason === "SAFETY") { console.warn("nCN Provider response potentially blocked due to safety settings."); }
          else if (responseData.candidates[0].finishReason === "MAX_TOKENS") { console.warn("nCN Provider summary may be truncated due to max output tokens limit."); }
        } else if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
          throw new Error(`Content could not be processed by nCN Provider due to: ${responseData.promptFeedback.blockReason}`);
        } else {
          throw new Error('nCN Provider API returned a response, but no summary text was found.');
        }

        if (!summaryText) {
            throw new Error('nCN Provider generated an empty summary.');
        }
        console.log(`Successfully received summary from ${selectedService}.`);

      } catch (err) {
        errorOccurred = err;
        console.error(`Error calling ${selectedService} API:`, err);
      }
    }

    // 5. 处理最终结果或错误
    if (errorOccurred) {
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
        : error.message.includes("Content could not be processed by nCN Provider")
        ? error.message
        : error.message.includes("User location not supported for API use")
        ? "Summary service unavailable in this region via the current nCN provider."
        : error.message.startsWith("CN Provider API request failed") || error.message.startsWith("nCN Provider API request failed")
        ? "AI service request failed. Please try again later."
        : error.message.includes("empty summary")
        ? `The AI model (${error.message.includes('CN Provider') ? 'BigModel' : 'Gemini'}) returned an empty summary.`
        : "Failed to summarize text.";

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