// services/Judge0Service.js
const axios = require('axios');

class Judge0Service {
  constructor() {
    // Try multiple fallback endpoints
    this.endpoints = [
      process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com',
      'https://api.judge0.com',
      'https://ce.judge0.com',
      'https://judge0.p.rapidapi.com'
    ];
    this.currentEndpointIndex = 0;
    this.baseUrl = this.endpoints[0];
    this.apiKey = process.env.JUDGE0_API_KEY;
    
    this.updateHeaders();
  }

  updateHeaders() {
    // Use different headers based on whether using RapidAPI or free API
    if (this.baseUrl.includes('rapidapi.com') && this.apiKey) {
      this.headers = {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': this.baseUrl.includes('judge0-ce') ? 'judge0-ce.p.rapidapi.com' : 'judge0.p.rapidapi.com',
        'Content-Type': 'application/json'
      };
    } else {
      this.headers = {
        'Content-Type': 'application/json'
      };
    }
  }

  async tryNextEndpoint() {
    this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
    this.baseUrl = this.endpoints[this.currentEndpointIndex];
    this.updateHeaders();
    console.log(`Switching to endpoint: ${this.baseUrl}`);
  }

  // Language mapping for Judge0
  getLanguageId(fileExtension) {
    const languageMap = {
      'py': 71,    // Python 3.8.1
      'js': 63,    // JavaScript (Node.js 12.14.0)
      'java': 62,  // Java (OpenJDK 13.0.1)
      'cpp': 54,   // C++ (GCC 9.2.0)
      'cc': 54,    // C++
      'cxx': 54,   // C++
      'c': 50,     // C (GCC 9.2.0)
      'cs': 51,    // C# (Mono 6.6.0.161)
      'php': 68,   // PHP (7.4.1)
      'rb': 72,    // Ruby (2.7.0)
      'go': 60,    // Go (1.13.5)
      'rs': 73,    // Rust (1.40.0)
      'kt': 78,    // Kotlin (1.3.70)
      'swift': 83, // Swift (5.2.3)
      'ts': 74     // TypeScript (3.7.4)
    };
    return languageMap[fileExtension.toLowerCase()] || null;
  }

  async executeCode(sourceCode, languageId, stdin = '', expectedOutput = '') {
    let lastError = null;
    
    // Try each endpoint
    for (let attempt = 0; attempt < this.endpoints.length; attempt++) {
      try {
        return await this.executeWithCurrentEndpoint(sourceCode, languageId, stdin, expectedOutput);
      } catch (error) {
        console.error(`Endpoint ${this.baseUrl} failed:`, error.message);
        lastError = error;
        
        // If it's a network error, try next endpoint
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
          if (attempt < this.endpoints.length - 1) {
            await this.tryNextEndpoint();
            continue;
          }
        } else {
          // If it's not a network error, don't try other endpoints
          throw error;
        }
      }
    }
    
    // If all endpoints failed
    throw new Error(`All Judge0 endpoints failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  async executeWithCurrentEndpoint(sourceCode, languageId, stdin = '', expectedOutput = '') {
    try {
      // Step 1: Submit code for execution
      const submissionPayload = {
        source_code: Buffer.from(sourceCode).toString('base64'),
        language_id: languageId,
        stdin: stdin ? Buffer.from(stdin).toString('base64') : '',
        expected_output: expectedOutput ? Buffer.from(expectedOutput).toString('base64') : ''
      };

      console.log('Submitting code to Judge0...', { languageId, codeLength: sourceCode.length });

      const submissionResponse = await axios.post(`${this.baseUrl}/submissions`, submissionPayload, {
        headers: this.headers,
        params: { base64_encoded: true, wait: false },
        timeout: 30000 // 30 second timeout
      });

      const token = submissionResponse.data.token;
      console.log('Submission token received:', token);

      // Step 2: Poll for results with exponential backoff
      const maxAttempts = 30;
      let attempts = 0;
      let delay = 1000; // Start with 1 second

      while (attempts < maxAttempts) {
        await this.sleep(delay);
        
        const resultResponse = await axios.get(`${this.baseUrl}/submissions/${token}`, {
          headers: this.headers,
          params: { base64_encoded: true },
          timeout: 30000 // 30 second timeout
        });

        const result = resultResponse.data;
        console.log(`Attempt ${attempts + 1}: Status ID ${result.status.id}`);

        // Check if execution is complete (status.id >= 3)
        if (result.status.id >= 3) {
          return this.formatResult(result);
        }
        
        attempts++;
        delay = Math.min(delay * 1.2, 3000); // Exponential backoff, max 3 seconds
      }

      throw new Error('Execution timeout - code took too long to execute');

    } catch (error) {
      console.error('Judge0 execution error:', error);
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.statusText;
        throw new Error(`Judge0 API Error: ${errorMessage}`);
      }
      throw new Error(`Network Error: ${error.message}`);
    }
  }

  formatResult(result) {
    const statusMessages = {
      1: 'In Queue',
      2: 'Processing',
      3: 'Accepted',
      4: 'Wrong Answer',
      5: 'Time Limit Exceeded',
      6: 'Compilation Error',
      7: 'Runtime Error (SIGSEGV)',
      8: 'Runtime Error (SIGXFSZ)',
      9: 'Runtime Error (SIGFPE)',
      10: 'Runtime Error (SIGABRT)',
      11: 'Runtime Error (NZEC)',
      12: 'Runtime Error (Other)',
      13: 'Internal Error',
      14: 'Exec Format Error'
    };

    // Decode base64 encoded fields
    const stdout = result.stdout ? Buffer.from(result.stdout, 'base64').toString('utf8') : '';
    const stderr = result.stderr ? Buffer.from(result.stderr, 'base64').toString('utf8') : '';
    const compile_output = result.compile_output ? Buffer.from(result.compile_output, 'base64').toString('utf8') : '';

    const isSuccess = result.status.id === 3;
    const statusText = statusMessages[result.status.id] || 'Unknown';

    return {
      success: isSuccess,
      status: statusText,
      statusId: result.status.id,
      output: stdout,
      error: stderr || compile_output || (isSuccess ? '' : `Execution failed: ${statusText}`),
      executionTime: result.time ? `${result.time}s` : null,
      memoryUsage: result.memory ? `${result.memory} KB` : null,
      exitCode: result.exit_code || 0
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test connection to Judge0 API
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/languages`, {
        headers: this.headers
      });
      return {
        success: true,
        message: 'Judge0 API connection successful',
        languagesCount: response.data.length
      };
    } catch (error) {
      return {
        success: false,
        message: `Judge0 API connection failed: ${error.message}`
      };
    }
  }
}

module.exports = Judge0Service;