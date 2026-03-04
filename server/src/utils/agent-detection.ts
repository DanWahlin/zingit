// server/src/utils/agent-detection.ts
// Cross-platform agent CLI detection

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

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
 * Uses async exec to avoid blocking the event loop
 */
async function checkCLI(command: string): Promise<CLICheckResult> {
  try {
    const { stdout } = await execAsync(`${command} --version`, {
      encoding: 'utf-8',
      timeout: 5000
    });
    return { installed: true, version: stdout.split('\n')[0].trim() };
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
 * Uses async operations to avoid blocking the event loop
 */
export async function detectAgents(): Promise<AgentInfo[]> {
  // Run all CLI checks in parallel for better performance
  const [claudeCheck, copilotCheck, codexCheck, opencodeCheck] = await Promise.all([
    checkCLI('claude'),
    checkCLI('copilot'),
    checkCLI('codex'),
    checkCLI('opencode')
  ]);

  const agents: AgentInfo[] = [];

  // Claude Code
  agents.push({
    name: 'claude',
    displayName: 'Claude Code',
    available: claudeCheck.installed,
    version: claudeCheck.version,
    reason: claudeCheck.installed ? undefined : 'Claude Code CLI not found',
    installCommand: 'npm install -g @anthropic-ai/claude-code'
  });

  // GitHub Copilot
  agents.push({
    name: 'copilot',
    displayName: 'GitHub Copilot CLI',
    available: copilotCheck.installed,
    version: copilotCheck.version,
    reason: copilotCheck.installed ? undefined : 'Copilot CLI not found',
    installCommand: 'npm install -g @github/copilot'
  });

  // OpenAI Codex
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

  // OpenCode
  agents.push({
    name: 'opencode',
    displayName: 'OpenCode',
    available: opencodeCheck.installed,
    version: opencodeCheck.version,
    reason: opencodeCheck.installed ? undefined : 'OpenCode CLI not found',
    installCommand: 'npm install -g opencode-ai'
  });

  return agents;
}

/**
 * Check if a specific agent is available
 */
export async function isAgentAvailable(agentName: string): Promise<AgentInfo | undefined> {
  const agents = await detectAgents();
  return agents.find(a => a.name === agentName);
}
