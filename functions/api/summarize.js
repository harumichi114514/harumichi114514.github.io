// functions/api/summarize.js

/**
 * 处理 POST 请求以进行文章总结 (使用 LLM)
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
  
      // 2. 获取 Worker AI 绑定
      const ai = context.env.AI;
      if (!ai) {
         console.error("AI binding not found. Make sure it's configured in Pages settings.");
         return new Response(JSON.stringify({ error: 'AI service not configured' }), {
           status: 500, headers: { 'Content-Type': 'application/json' },
         });
      }
  
      // 3. 调用 Worker AI 的 LLM 模型 (@cf/meta/llama-2-7b-chat-fp16)
      //    - 使用消息列表格式
      //    - 设计系统提示词和用户提示词
      const systemPrompt = `You are an expert assistant specialized in summarizing articles. Your goal is to extract the main points and key information from the provided text and present them in a concise and easy-to-understand summary. Focus on accuracy and clarity.`;
      const userPrompt = `Please summarize the following article:\n\n---\n${textToSummarize}\n---\n\nProvide a concise summary:`;
  
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
  
      const inputs = { messages }; // LLM 输入格式
  
      console.log("Sending text to LLM (@cf/meta/llama-2-7b-chat-fp16) for summarization...");
      // 注意：更换了模型名称
      const response = await ai.run('@cf/meta/llama-2-7b-chat-fp16', inputs);
      console.log("Received response from LLM.");
  
      // 4. 返回总结结果 (LLM 的结果通常在 response 字段)
      if (!response || !response.response) {
           console.error("LLM did not return a valid response structure:", response);
           throw new Error('AI model did not return a summary.');
      }
  
      // 去除可能存在的首尾引号或不必要的空白
      const summaryText = response.response.trim().replace(/^["']|["']$/g, '');
  
      return new Response(JSON.stringify({ summary: summaryText }), {
        headers: { 'Content-Type': 'application/json' },
      });
  
    } catch (error) {
      console.error('Error during LLM summarization:', error);
      let errorMessage = 'Failed to summarize text using LLM.';
      if (error instanceof SyntaxError) { errorMessage = 'Invalid JSON received.' }
      else if (error.message && error.message.includes('forbidden')) { errorMessage = 'Content could not be processed due to content policy.'}
      else if (error.message && error.message.includes('AI model did not return a summary')) { errorMessage = error.message; }
      // 可以根据需要添加更多针对 LLM 的错误处理
  
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
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
     // POST requests are handled by onRequestPost
  }