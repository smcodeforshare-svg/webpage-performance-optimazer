/**
 * Optional AI Analysis Service (Opt-in)
 * Connects to user-configured OpenAI-compatible endpoints (e.g. Ollama, LocalAI, or OpenAI API).
 * Strictly opt-in, redacts secrets beforehand, and treats AI outputs as untrusted suggestions.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { redactSourceSecrets } = require('./redaction');

class AIService {
  constructor(config = {}) {
    this.endpoint = config.endpoint || process.env.AUDITOR_AI_ENDPOINT || 'http://localhost:11434/v1';
    this.apiKey = config.apiKey || process.env.AUDITOR_AI_API_KEY || '';
    this.model = config.model || process.env.AUDITOR_AI_MODEL || 'llama3';
    this.enabled = Boolean(config.enabled || process.env.AUDITOR_AI_ENABLED === 'true');
  }

  /**
   * Returns current AI status without exposing secret keys
   */
  getStatus() {
    return {
      enabled: this.enabled,
      endpoint: this.endpoint,
      model: this.model,
      hasKeyConfigured: Boolean(this.apiKey && this.apiKey.length > 0)
    };
  }

  /**
   * Previews what data would be sent to the AI service, with secrets redacted
   */
  previewPromptPayload(finding, fileSnippet) {
    const cleanSnippet = redactSourceSecrets(fileSnippet);
    return {
      model: this.model,
      endpoint: this.endpoint,
      redactedCodeSnippet: cleanSnippet,
      findingContext: {
        title: finding.title,
        file: finding.filePath,
        lines: `${finding.startLine}-${finding.endLine}`,
        symbol: finding.symbol,
        category: finding.category,
        evidence: finding.evidence
      },
      warning: 'Only the isolated code snippet and finding details will be sent. No repository files, credentials, or other system files are transmitted.'
    };
  }

  /**
   * Requests an AI-assisted analysis and structured code fix
   * @param {Object} finding 
   * @param {string} codeSnippet 
   * @returns {Promise<{ success: boolean, explanation?: string, replacementCode?: string, error?: string }>}
   */
  async analyzeFinding(finding, codeSnippet) {
    if (!this.enabled) {
      return {
        success: false,
        error: 'AI analysis is currently disabled. Enable it in Settings and provide an endpoint/model to use this feature.'
      };
    }

    const cleanCode = redactSourceSecrets(codeSnippet);
    const systemPrompt = `You are a performance engineering assistant.
Analyze the provided code bottleneck and return a STRICT JSON object with:
{
  "explanation": "Clear explanation of the bottleneck and why the fix improves performance",
  "replacementCode": "Complete replacement code block for lines ${finding.startLine}-${finding.endLine}",
  "confidence": "strongly_supported",
  "expectedBenefit": "Expected latency / render reduction",
  "risks": "Any caveats or behavioral differences"
}
Output JSON ONLY. Do not wrap in markdown quotes if possible.`;

    const userPrompt = `Finding: ${finding.title}
File: ${finding.filePath} (Lines ${finding.startLine}-${finding.endLine})
Symbol: ${finding.symbol || 'Anonymous'}
Category: ${finding.category}
Evidence: ${finding.evidence}

Current Code:
\`\`\`
${cleanCode}
\`\`\`

Provide the replacement code and explanation.`;

    const payload = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1
    });

    try {
      const responseText = await this._postJson(`${this.endpoint}/chat/completions`, payload, this.apiKey);
      const parsedRes = JSON.parse(responseText);
      const content = parsedRes.choices?.[0]?.message?.content;

      if (!content) {
        return { success: false, error: 'Empty response received from AI model.' };
      }

      // Extract JSON if wrapped in markdown code fence
      let jsonStr = content.trim();
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      const structured = JSON.parse(jsonStr);
      return {
        success: true,
        explanation: structured.explanation,
        replacementCode: structured.replacementCode,
        confidence: structured.confidence || 'strongly_supported',
        expectedBenefit: structured.expectedBenefit,
        risks: structured.risks
      };
    } catch (err) {
      return {
        success: false,
        error: `AI request failed: ${err.message}`
      };
    }
  }

  _postJson(targetUrl, data, apiKey) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(targetUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const req = client.request(parsedUrl, {
        method: 'POST',
        headers,
        timeout: 20000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('AI request timed out after 20 seconds.'));
      });

      req.write(data);
      req.end();
    });
  }
}

module.exports = AIService;
