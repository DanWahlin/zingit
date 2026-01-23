// server/src/utils/agent-detection.ts
// Cross-platform agent CLI detection

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface AgentInfo {
  name: string;
  displayName: string;
  available: boolean;
  version?: string;
  reason?: string;
  installCommand: string;
}

interface CLICheckResult {
  installed: boolean;
  version?: string;
}

/**
 * Check if a CLI command is available (cross-platform)
 * Uses child_process which handles PATH resolution on Mac/Linux/Windows
 */
function checkCLI(command: string): CLICheckResult {
  try {
    const output = execSync(`${command} --version`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { installed: true, version: output.split('\n')[0].trim() };
  } catch {
    return { installed: false };
  }
}

/**
 * Check if Codex auth file exists (cross-platform using os.homedir())
 */
function checkCodexAuth(): boolean {
  const authPath = join(homedir(), '.codex', 'auth.json');
  return existsSync(authPath);
}

/**
 * Detect all available agents and their status
 */
export function detectAgents(): AgentInfo[] {
  const agents: AgentInfo[] = [];

  // Claude Code
  const claudeCheck = checkCLI('claude');
  agents.push({
    name: 'claude',
    displayName: 'Claude Code',
    available: claudeCheck.installed,
    version: claudeCheck.version,
    reason: claudeCheck.installed ? undefined : 'Claude Code CLI not found',
    installCommand: 'npm install -g @anthropic-ai/claude-code'
  });

  // GitHub Copilot
  const copilotCheck = checkCLI('copilot');
  agents.push({
    name: 'copilot',
    displayName: 'GitHub Copilot CLI',
    available: copilotCheck.installed,
    version: copilotCheck.version,
    reason: copilotCheck.installed ? undefined : 'Copilot CLI not found',
    installCommand: 'npm install -g @github/copilot'
  });

  // OpenAI Codex
  const codexCheck = checkCLI('codex');
  if (codexCheck.installed) {
    const hasAuth = checkCodexAuth();
    agents.push({
      name: 'codex',
      displayName: 'OpenAI Codex',
      available: hasAuth,
      version: codexCheck.version,
      reason: hasAuth ? undefined : 'Codex CLI installed but not logged in. Run: codex',
      installCommand: 'npm install -g @openai/codex'
    });
  } else {
    agents.push({
      name: 'codex',
      displayName: 'OpenAI Codex',
      available: false,
      reason: 'Codex CLI not found',
      installCommand: 'npm install -g @openai/codex'
    });
  }

  return agents;
}

/**
 * Check if a specific agent is available
 */
export function isAgentAvailable(agentName: string): AgentInfo | undefined {
  const agents = detectAgents();
  return agents.find(a => a.name === agentName);
}
