// services/HybridExecutionService.js
const Judge0Service = require('./Judge0Service');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class HybridExecutionService {
  constructor() {
    this.judge0Service = new Judge0Service();
    this.useLocalFallback = process.env.ENABLE_LOCAL_FALLBACK === 'true' || true;
  }

  async executeCode(sourceCode, fileName, input = '') {
    const ext = fileName.split('.').pop().toLowerCase();
    
    // First try Judge0 if available
    if (await this.isJudge0Available()) {
      try {
        const languageId = this.judge0Service.getLanguageId(ext);
        if (languageId) {
          console.log('Attempting Judge0 execution...');
          const result = await this.judge0Service.executeCode(sourceCode, languageId, input);
          console.log('Judge0 execution successful');
          return result;
        }
      } catch (error) {
        console.warn('Judge0 execution failed:', error.message);
        if (!this.useLocalFallback) {
          throw error;
        }
      }
    }

    // Fallback to local execution
    if (this.useLocalFallback) {
      console.log('Falling back to local execution...');
      return await this.executeLocally(sourceCode, fileName, input);
    }

    throw new Error('Both Judge0 and local execution are unavailable');
  }

  async isJudge0Available() {
    try {
      // Quick test to see if any Judge0 endpoint is reachable
      const testResult = await this.judge0Service.testConnection();
      return testResult.success;
    } catch (error) {
      return false;
    }
  }

  async executeLocally(sourceCode, fileName, input = '') {
    const ext = fileName.split('.').pop().toLowerCase();
    const userId = 'local_' + Date.now();
    const tempDir = path.join(__dirname, '../temp', `${userId}_${Date.now()}`);
    
    try {
      await fs.mkdir(tempDir, { recursive: true });
      
      let output = '';
      let error = '';
      let success = true;

      switch (ext) {
        case 'py':
          return await this.executePython(sourceCode, fileName, input, tempDir);
        case 'js':
          return await this.executeJavaScript(sourceCode, fileName, input, tempDir);
        case 'c':
          return await this.executeC(sourceCode, fileName, input, tempDir);
        case 'cpp':
        case 'cc':
        case 'cxx':
          return await this.executeCpp(sourceCode, fileName, input, tempDir);
        case 'java':
          return await this.executeJava(sourceCode, fileName, input, tempDir);
        default:
          throw new Error(`Unsupported file type: .${ext}`);
      }
    } finally {
      // Clean up
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async executePython(sourceCode, fileName, input, tempDir) {
    const pyFile = path.join(tempDir, fileName);
    await fs.writeFile(pyFile, sourceCode);
    
    return await this.runProcess('python3', [pyFile], input, tempDir);
  }

  async executeJavaScript(sourceCode, fileName, input, tempDir) {
    const jsFile = path.join(tempDir, fileName);
    await fs.writeFile(jsFile, sourceCode);
    
    return await this.runProcess('node', [jsFile], input, tempDir);
  }

  async executeC(sourceCode, fileName, input, tempDir) {
    const cFile = path.join(tempDir, fileName);
    const cExe = path.join(tempDir, 'program');
    await fs.writeFile(cFile, sourceCode);
    
    // Compile
    const compileResult = await this.runProcess('gcc', [cFile, '-o', cExe], '', tempDir);
    if (!compileResult.success) {
      return compileResult;
    }
    
    // Execute
    return await this.runProcess(cExe, [], input, tempDir);
  }

  async executeCpp(sourceCode, fileName, input, tempDir) {
    const cppFile = path.join(tempDir, fileName);
    const cppExe = path.join(tempDir, 'program');
    await fs.writeFile(cppFile, sourceCode);
    
    // Compile
    const compileResult = await this.runProcess('g++', [cppFile, '-o', cppExe], '', tempDir);
    if (!compileResult.success) {
      return compileResult;
    }
    
    // Execute
    return await this.runProcess(cppExe, [], input, tempDir);
  }

  async executeJava(sourceCode, fileName, input, tempDir) {
    const javaFile = path.join(tempDir, fileName);
    await fs.writeFile(javaFile, sourceCode);
    
    const className = fileName.replace('.java', '');
    
    // Compile
    const compileResult = await this.runProcess('javac', [javaFile], '', tempDir);
    if (!compileResult.success) {
      return compileResult;
    }
    
    // Execute
    return await this.runProcess('java', [className], input, tempDir);
  }

  async runProcess(command, args, input, cwd) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const process = spawn(command, args, {
        cwd: cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      if (input) {
        process.stdin.write(input);
      }
      process.stdin.end();
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => stdout += data.toString());
      process.stderr.on('data', (data) => stderr += data.toString());
      
      process.on('close', (code) => {
        const executionTime = `${(Date.now() - startTime) / 1000}s`;
        resolve({
          success: code === 0,
          status: code === 0 ? 'Accepted' : 'Runtime Error',
          statusId: code === 0 ? 3 : 12,
          output: stdout,
          error: stderr,
          executionTime: executionTime,
          memoryUsage: null,
          exitCode: code
        });
      });
      
      process.on('error', (error) => {
        resolve({
          success: false,
          status: 'Execution Error',
          statusId: 13,
          output: '',
          error: `Failed to execute: ${error.message}`,
          executionTime: null,
          memoryUsage: null,
          exitCode: -1
        });
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        process.kill();
        resolve({
          success: false,
          status: 'Time Limit Exceeded',
          statusId: 5,
          output: stdout,
          error: 'Execution timeout after 10 seconds',
          executionTime: '10s',
          memoryUsage: null,
          exitCode: -1
        });
      }, 10000);
    });
  }

  // Test what execution methods are available
  async getAvailableExecutors() {
    const results = {
      judge0: false,
      local: {
        python3: false,
        node: false,
        gcc: false,
        gpp: false,
        javac: false,
        java: false
      }
    };

    // Test Judge0
    results.judge0 = await this.isJudge0Available();

    // Test local executors
    const testCommands = [
      ['python3', '--version'],
      ['node', '--version'],
      ['gcc', '--version'],
      ['g++', '--version'],
      ['javac', '-version'],
      ['java', '-version']
    ];

    for (const [command, arg] of testCommands) {
      try {
        const result = await this.runProcess(command, [arg], '', process.cwd());
        results.local[command === 'g++' ? 'gpp' : command] = result.success || result.output.includes('version');
      } catch (error) {
        results.local[command === 'g++' ? 'gpp' : command] = false;
      }
    }

    return results;
  }
}

module.exports = HybridExecutionService;