// functions/api/summarize.js
// (代码与上一个回答中的相同)

/**
 * 处理 POST 请求以进行文章总结
 * @param {EventContext} context - Pages Function 的上下文对象
 */
export async function onRequestPost(context) {
    try {
      const requestBody = await context.request.json();
      const textToSummarize = requestBody.text;
  
      if (!textToSummarize) {
        return new Response(JSON.stringify({ error: 'Missing "text" in request body' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }
  
      const ai = context.env.AI;
      if (!ai) {
         console.error("AI binding not found. Make sure it's configured in Pages settings.");
         return new Response(JSON.stringify({ error: 'AI service not configured' }), {
           status: 500, headers: { 'Content-Type': 'application/json' },
         });
      }
  
      const inputs = { input_text: textToSummarize };
      console.log("Sending text to AI for summarization...");
      const response = await ai.run('@cf/facebook/bart-large-cnn', inputs);
      console.log("Received response from AI.");
  
      return new Response(JSON.stringify({ summary: response.summary }), {
        headers: { 'Content-Type': 'application/json' },
      });
  
    } catch (error) {
      console.error('Error during summarization:', error);
      let errorMessage = 'Failed to summarize text.';
      if (error instanceof SyntaxError) { errorMessage = 'Invalid JSON received.' }
      else if (error.message && error.message.includes('forbidden')) { errorMessage = 'Content could not be processed due to content policy.'}
  
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  export async function onRequest(context) {
     if (context.request.method !== 'POST') {
        return new Response(`Please use the POST method. Method used: ${context.request.method}`, {
            status: 405, headers: { 'Allow': 'POST' }
        });
     }
     // POST requests are handled by onRequestPost
  }