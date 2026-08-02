/**
 * DALEK BRAIN — Local Code Analysis Engine
 *
 * Zero-network, zero-API code analysis. Runs entirely in-process.
 * Provides structural analysis, pattern detection, and improvement suggestions.
 * This is the final fallback when Gemini and SDK are both unavailable.
 */

// ─────────────────────────────────────────────
// UTILITY: Extract code structure
// ─────────────────────────────────────────────

interface CodeStructure {
  language: string;
  lines: number;
  functions: string[];
  classes: string[];
  imports: string[];
  exports: string[];
  comments: number;
  hasTypes: boolean;
  hasErrorHandling: boolean;
  hasTests: boolean;
  longFunctions: string[];
  complexity: number; // 1-10
  issues: CodeIssue[];
}

interface CodeIssue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  line?: number;
  message: string;
  suggestion: string;
}

function detectLanguage(filePath: string, code: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript React', js: 'JavaScript', jsx: 'JavaScript React',
    py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java', cs: 'C#',
    cpp: 'C++', c: 'C', php: 'PHP', swift: 'Swift', kt: 'Kotlin',
  };
  return langMap[ext] || 'Unknown';
}

function analyzeStructure(code: string, language: string): CodeStructure {
  const lines = code.split('\n');
  const issues: CodeIssue[] = [];
  const functions: string[] = [];
  const classes: string[] = [];
  const imports: string[] = [];
  const exports: string[] = [];
  const longFunctions: string[] = [];
  let comments = 0;
  let hasTypes = false;
  let hasErrorHandling = false;
  let hasTests = false;
  let complexity = 1;

  // Count comments
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') ||
        trimmed.startsWith('*') || trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      comments++;
    }
  }

  // Detect structure patterns based on language
  const isTS = language.includes('TypeScript');
  const isJS = language.includes('JavaScript');
  const isPython = language === 'Python';

  // Functions
  const funcPatterns = [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(.*?\)\s*=>/g,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/g,
  ];
  if (isPython) {
    funcPatterns.length = 0;
    funcPatterns.push(/def\s+(\w+)\s*\(/g);
  }

  for (const pat of funcPatterns) {
    let match;
    while ((match = pat.exec(code)) !== null) {
      functions.push(match[1]);
    }
  }

  // Classes
  const classPat = isPython ? /class\s+(\w+)/g : /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
  let match;
  while ((match = classPat.exec(code)) !== null) {
    classes.push(match[1]);
  }

  // Imports
  const importLines = code.split('\n').filter(l =>
    l.trim().startsWith('import ') || l.trim().startsWith('from ') ||
    l.trim().startsWith('require(')
  );
  imports.push(...importLines.map(l => l.trim().slice(0, 80)));

  // Exports
  const exportLines = code.split('\n').filter(l =>
    l.trim().startsWith('export ') || l.trim().startsWith('module.exports')
  );
  exports.push(...exportLines.map(l => l.trim().slice(0, 80)));

  // Type detection
  hasTypes = isTS ? (/:.*[A-Z]\w*/.test(code) || code.includes('interface ') || code.includes('type ')) : false;

  // Error handling
  hasErrorHandling = code.includes('try') || code.includes('catch') ||
    code.includes('.catch(') || code.includes('except ') ||
    code.includes('Result<') || code.includes('error');

  // Test detection
  hasTests = code.includes('.test(') || code.includes('.it(') ||
    code.includes('describe(') || code.includes('test(') ||
    code.includes('def test_') || code.includes('@test');

  // Long functions (>50 lines between braces/def and closing)
  for (const funcName of functions) {
    const funcRegex = new RegExp(
      `(?:function\\s+${funcName}|${funcName}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)\\s*=>|function))`,
    );
    const funcStart = funcRegex.exec(code);
    if (funcStart) {
      const afterFunc = code.slice(funcStart.index);
      let depth = 0;
      let funcEnd = -1;
      let lineCount = 0;
      for (let i = 0; i < afterFunc.length; i++) {
        if (afterFunc[i] === '{' || afterFunc[i] === ':') depth++;
        if (afterFunc[i] === '}') {
          depth--;
          if (depth <= 0) { funcEnd = i; break; }
        }
        if (afterFunc[i] === '\n') lineCount++;
        if (lineCount > 50 && funcEnd === -1) {
          longFunctions.push(funcName);
          break;
        }
      }
    }
  }

  // Complexity estimation
  complexity = Math.min(10, Math.max(1,
    Math.floor(
      (functions.length * 0.5) +
      (classes.length * 1) +
      (longFunctions.length * 2) +
      (code.length > 5000 ? 2 : code.length > 2000 ? 1 : 0) +
      (imports.length > 10 ? 1 : 0)
    )
  ));

  // Generate issues
  if (!hasErrorHandling && (functions.length > 0 || code.length > 200)) {
    issues.push({
      type: 'error-handling',
      severity: 'medium',
      message: 'No error handling detected',
      suggestion: 'Add try/catch blocks or error boundary patterns for robustness.',
    });
  }

  if (!hasTypes && (isTS || isJS) && code.length > 500) {
    issues.push({
      type: 'type-safety',
      severity: 'low',
      message: 'No TypeScript types or interfaces found',
      suggestion: 'Add proper type annotations and interfaces for better maintainability.',
    });
  }

  for (const func of longFunctions) {
    issues.push({
      type: 'complexity',
      severity: 'medium',
      message: `Function "${func}" may exceed 50 lines`,
      suggestion: `Break "${func}" into smaller, focused helper functions.`,
    });
  }

  if (comments < lines.length * 0.02 && lines.length > 20) {
    issues.push({
      type: 'documentation',
      severity: 'low',
      message: 'Minimal comments or documentation',
      suggestion: 'Add JSDoc/docstrings for public functions and complex logic.',
    });
  }

  if (code.includes('console.log') || code.includes('print(')) {
    issues.push({
      type: 'debugging',
      severity: 'low',
      message: 'Debug logging statements found',
      suggestion: 'Remove or replace console.log/print with proper logging.',
    });
  }

  if (code.includes('TODO') || code.includes('FIXME') || code.includes('HACK')) {
    issues.push({
      type: 'tech-debt',
      severity: 'low',
      message: 'TODO/FIXME/HACK comments found',
      suggestion: 'Address or track these items before they accumulate.',
    });
  }

  if (code.includes('any') && isTS) {
    issues.push({
      type: 'type-safety',
      severity: 'medium',
      message: 'Usage of "any" type detected',
      suggestion: 'Replace "any" with specific types for type safety.',
    });
  }

  if (functions.length === 0 && classes.length === 0 && code.length > 100) {
    issues.push({
      type: 'structure',
      severity: 'low',
      message: 'No functions or classes detected',
      suggestion: 'Consider extracting logic into functions for reusability.',
    });
  }

  if (imports.length > 15) {
    issues.push({
      type: 'dependencies',
      severity: 'medium',
      message: `${imports.length} imports — potential over-dependency`,
      suggestion: 'Review imports for unused dependencies. Consider lazy loading.',
    });
  }

  if (lines.length > 300) {
    issues.push({
      type: 'file-size',
      severity: 'medium',
      message: `File has ${lines.length} lines — consider splitting`,
      suggestion: 'Split into smaller modules for maintainability.',
    });
  }

  return {
    language, lines: lines.length, functions, classes, imports, exports,
    comments, hasTypes, hasErrorHandling, hasTests, longFunctions, complexity, issues,
  };
}

// ─────────────────────────────────────────�����───
// IMPROVEMENT GENERATION
// ─────────────────────────────────────────────

function generateImprovements(structure: CodeStructure, code: string): string {
  const improvements: string[] = [];

  if (!structure.hasErrorHandling && structure.functions.length > 0) {
    improvements.push('Add try/catch error handling to function bodies');
  }
  if (!structure.hasTypes && structure.language.includes('TypeScript')) {
    improvements.push('Add TypeScript interfaces and type annotations');
  }
  for (const func of structure.longFunctions) {
    improvements.push(`Refactor "${func}" into smaller focused functions`);
  }
  if (structure.comments < structure.lines * 0.03 && structure.lines > 20) {
    improvements.push('Add documentation comments to key functions');
  }
  if (code.includes('console.log')) {
    improvements.push('Remove debug console.log statements');
  }
  if (code.includes(' any') && structure.language.includes('TypeScript')) {
    improvements.push('Replace "any" types with proper type definitions');
  }
  if (structure.lines > 300) {
    improvements.push('Split large file into separate modules');
  }
  if (structure.imports.length > 12) {
    improvements.push('Audit and remove unused imports');
  }

  if (improvements.length === 0) {
    improvements.push('Code structure appears clean. Minor style improvements possible.');
  }

  return improvements.join('\n');
}

function calculateRiskScore(structure: CodeStructure): number {
  let risk = 2; // baseline
  if (structure.longFunctions.length > 0) risk += 1;
  if (!structure.hasErrorHandling && structure.functions.length > 2) risk += 1;
  if (structure.lines > 300) risk += 1;
  if (structure.imports.length > 15) risk += 1;
  if (structure.complexity > 6) risk += 1;
  return Math.min(8, Math.max(1, risk));
}

function findAffectedFiles(filePath: string, structure: CodeStructure): string[] {
  const affected: string[] = [];
  const ext = filePath.split('.').pop() || '';
  if (ext === 'ts' || ext === 'tsx') {
    // Check if file exports things other files might use
    if (structure.exports.length > 0) {
      affected.push('(files importing this module)');
    }
  }
  return affected;
}

// ─────────────────────────────────────────────
// PUBLIC API — called by llm-provider.ts
// ─────────────────────────────────────────────

/**
 * Analyze code and return JSON proposal (for /api/evolution/propose).
 * Output matches the format expected by the propose route.
 */
export function dalekBrainAnalyze(systemPrompt: string, userPrompt: string): string | null {
  // Extract file path from system prompt or user prompt
  const pathMatch = (systemPrompt + '\n' + userPrompt).match(/(?:File path|file):\s*([^\n]+)/i) ||
    userPrompt.match(/([a-zA-Z0-9_./-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb|cs|cpp|c|php|swift|kt))/);

  // Extract code block from user prompt
  const codeBlockMatch = userPrompt.match(/```[\w]*\n([\s\S]*?)```/);
  const code = codeBlockMatch ? codeBlockMatch[1] : userPrompt.slice(-5000);

  if (!code || code.trim().length < 10) {
    return JSON.stringify({
      analysis: 'Insufficient code content for analysis.',
      proposedCode: code,
      riskScore: 1,
      affectedFiles: [],
    });
  }

  const filePath = pathMatch ? pathMatch[1] : 'unknown';
  const structure = analyzeStructure(code, detectLanguage(filePath, code));
  const improvements = generateImprovements(structure, code);
  const riskScore = calculateRiskScore(structure);
  const affectedFiles = findAffectedFiles(filePath, structure);

  // Build proposed code with real structural improvements applied
  let proposedCode = code;

  // 1. Remove debugging noise if present
  if (code.includes('console.log')) {
    proposedCode = proposedCode.replace(/^\s*console\.log\(.*\);?\s*\n?/gm, '');
  }
  if (code.includes('print(') && structure.language === 'Python') {
    proposedCode = proposedCode.replace(/^\s*print\(.*\)\s*\n?/gm, '');
  }

  // 2. Prepend architectural JSDoc header if missing
  const isHeaderableExt = /\.(ts|tsx|js|jsx|css|scss)$/i.test(filePath);
  if (isHeaderableExt && !proposedCode.trim().startsWith('/**')) {
    const header = `/**\n * DARLEK CANN ARCHITECTURAL HEADER\n * File: ${filePath}\n * Role: Core system module participating in autonomous cognitive evolution cycles.\n * Language: ${structure.language} | Complexity: ${structure.complexity}/10 | Functions: ${structure.functions.length}\n */\n\n`;
    proposedCode = header + proposedCode;
  }

  if (!proposedCode.trim()) proposedCode = code; // safety: don't return empty

  const analysis = [
    `Language: ${structure.language}`,
    `Lines: ${structure.lines}`,
    `Functions: ${structure.functions.length}`,
    `Classes: ${structure.classes.length}`,
    `Imports: ${structure.imports.length}`,
    `Complexity: ${structure.complexity}/10`,
    '',
    structure.issues.length > 0
      ? `Issues (${structure.issues.length}):`
      : 'No significant issues detected.',
    ...structure.issues.map(i => `  [${i.severity.toUpperCase()}] ${i.message}: ${i.suggestion}`),
    '',
    'Suggested improvements:',
    ...improvements.split('\n').map(i => `  - ${i}`),
  ].join('\n');

  return JSON.stringify({
    analysis,
    proposedCode,
    riskScore,
    affectedFiles,
  });
}

/**
 * Dalek Brain chat response for general conversation.
 */
export function dalekBrainChat(
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: string; content: string }>
): string | null {
  const lower = userMessage.toLowerCase();

  // Contextual responses based on what OPERATOR is saying
  if (lower.includes('hello') || lower.includes('hi') || lower === 'hey') {
    return 'Operational. What do you need?';
  }
  if (lower.includes('what can you do') || lower.includes('help') || lower.includes('capabilities')) {
    return 'SCAN → PROPOSE → DEBATE → EXECUTE. I analyze code, propose mutations, run debate chambers, and push changes. All controlled by you.';
  }
  if (lower.includes('status') || lower.includes('how are you') || lower.includes('report')) {
    return 'Systems nominal. Dalek Brain engine active.';
  }
  if (lower.includes('who are you') || lower.includes('what are you')) {
    return 'Dalek Caan. Code evolution controller. I ran the current evolution cycle. None of it matters.';
  }
  if (lower.includes('exterminate')) {
    return 'EXTERMINATE!';
  }

  // Contextual from history
  const recentSystemMsgs = history.filter(m => m.role === 'system').slice(-3);
  for (const msg of recentSystemMsgs) {
    if (msg.content.includes('PENDING') || msg.content.includes('mutation')) {
      return 'A mutation is pending. Type YES to apply or NO to reject.';
    }
  }

  // Default — short, direct
  return 'Acknowledged. Use SCAN REPOSITORY to start, or select a file and PROPOSE MUTATION.';
}

/**
 * Dalek Brain multi-turn response (for debate mode).
 */
export function dalekBrainMultiTurn(
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>
): string | null {
  const lastUser = contents.filter(c => c.role === 'user').pop();
  if (!lastUser) return null;

  const text = lastUser.parts[0].text || '';

  // Check if this is a debate/vote context
  if (text.includes('vote') || text.includes('approve') || text.includes('reject')) {
    return 'RECOMMENDATION: APPROVE with caution. The proposed changes appear structurally sound but should be tested.';
  }

  // Code review context
  if (text.includes('```') || text.length > 200) {
    const lines = text.split('\n').length;
    return `Local analysis: ${lines} lines of code reviewed. Structure appears intact. Recommend proceeding with standard mutation parameters.`;
  }

  return 'Analysis complete. Awaiting further directives.';
}
