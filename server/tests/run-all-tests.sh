#!/bin/bash
# server/tests/run-all-tests.sh
# Run tests against all available agents
#
# Usage:
#   ./tests/run-all-tests.sh           # Test all agents
#   ./tests/run-all-tests.sh claude    # Test specific agent
#   ./tests/run-all-tests.sh --dry-run # Show what would be tested

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
TEST_PROJECT="$SCRIPT_DIR/test-project"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Available agents
AGENTS=("copilot" "claude" "codex")

# Parse arguments
DRY_RUN=false
SPECIFIC_AGENT=""
SCENARIO="simple"

for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      ;;
    --scenario=*)
      SCENARIO="${arg#*=}"
      ;;
    copilot|claude|codex)
      SPECIFIC_AGENT="$arg"
      ;;
    --help|-h)
      echo "Usage: $0 [agent] [options]"
      echo ""
      echo "Arguments:"
      echo "  agent          Test specific agent (copilot, claude, codex)"
      echo ""
      echo "Options:"
      echo "  --scenario=X   Test scenario (simple, multi, followup)"
      echo "  --dry-run      Show what would be tested without running"
      echo "  --help, -h     Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                          # Test all agents with 'simple' scenario"
      echo "  $0 claude                   # Test only Claude agent"
      echo "  $0 --scenario=multi         # Test all agents with 'multi' scenario"
      echo "  $0 codex --scenario=followup"
      exit 0
      ;;
  esac
done

# Filter agents if specific one requested
if [ -n "$SPECIFIC_AGENT" ]; then
  AGENTS=("$SPECIFIC_AGENT")
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  PokeUI Agent Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Test project: ${YELLOW}$TEST_PROJECT${NC}"
echo -e "Scenario: ${YELLOW}$SCENARIO${NC}"
echo -e "Agents to test: ${YELLOW}${AGENTS[*]}${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}[DRY RUN] Would test the following:${NC}"
  for agent in "${AGENTS[@]}"; do
    echo "  - $agent agent with '$SCENARIO' scenario"
  done
  exit 0
fi

# Track results (using simple arrays for macOS compatibility)
RESULTS_AGENTS=()
RESULTS_STATUS=()
FAILED=0

# Function to reset test project to original state
reset_test_project() {
  echo -e "${YELLOW}Resetting test project to original state...${NC}"

  # Recreate the original App.tsx content
  cat > "$TEST_PROJECT/src/App.tsx" << 'ORIGINAL_CONTENT'
// Test file for PokeUI agent validation
// This file contains intentional issues for the agent to fix

import React from 'react';

export function App() {
  return (
    <div className="app">
      <header>
        <h1>Welcome to My App</h1>
        <button className="login-btn">Login</button>
      </header>

      <main>
        <section className="hero">
          <h2>Get Started Today</h2>
          <p>This is a sample application for testing PokeUI annotations.</p>
          <button className="cta-btn">Sign Up Now</button>
        </section>

        <section className="features">
          <div className="feature-card">
            <h3>Feature One</h3>
            <p>Description of feature one goes here.</p>
          </div>
          <div className="feature-card">
            <h3>Feature Two</h3>
            <p>Description of feature two goes here.</p>
          </div>
        </section>
      </main>

      <footer>
        <p>Copyright 2024 My App</p>
      </footer>
    </div>
  );
}
ORIGINAL_CONTENT

  echo -e "${GREEN}Test project reset complete${NC}"
}

# Function to test an agent
test_agent() {
  local agent=$1
  local port=8765
  local pid_file="/tmp/pokeui-test-server-$$.pid"

  echo ""
  echo -e "${BLUE}----------------------------------------${NC}"
  echo -e "${BLUE}Testing: $agent${NC}"
  echo -e "${BLUE}----------------------------------------${NC}"

  # Reset test project before each test
  reset_test_project

  # Start the server in background
  echo -e "${YELLOW}Starting server with AGENT=$agent...${NC}"

  cd "$SERVER_DIR"
  PROJECT_DIR="$TEST_PROJECT" AGENT="$agent" PORT="$port" npm run dev &
  SERVER_PID=$!
  echo $SERVER_PID > "$pid_file"

  # Wait for server to start
  echo -e "${YELLOW}Waiting for server to be ready...${NC}"
  local retries=30
  while [ $retries -gt 0 ]; do
    if nc -z localhost $port 2>/dev/null; then
      break
    fi
    sleep 1
    ((retries--))
  done

  if [ $retries -eq 0 ]; then
    echo -e "${RED}Server failed to start!${NC}"
    kill $SERVER_PID 2>/dev/null || true
    rm -f "$pid_file"
    RESULTS_AGENTS+=("$agent")
    RESULTS_STATUS+=("FAILED (server didn't start)")
    ((FAILED++))
    return 1
  fi

  echo -e "${GREEN}Server ready!${NC}"
  sleep 2  # Give it a moment to fully initialize

  # Run the test
  echo -e "${YELLOW}Running test...${NC}"
  RESULTS_AGENTS+=("$agent")
  if npx tsx tests/test-agent.ts --scenario="$SCENARIO"; then
    RESULTS_STATUS+=("PASSED")
    echo -e "${GREEN}$agent: PASSED${NC}"
  else
    RESULTS_STATUS+=("FAILED")
    ((FAILED++))
    echo -e "${RED}$agent: FAILED${NC}"
  fi

  # Stop the server
  echo -e "${YELLOW}Stopping server...${NC}"
  kill $SERVER_PID 2>/dev/null || true
  rm -f "$pid_file"

  # Wait for port to be free
  sleep 2

  return 0
}

# Run tests for each agent
for agent in "${AGENTS[@]}"; do
  test_agent "$agent" || true
done

# Print summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test Results Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

for i in "${!RESULTS_AGENTS[@]}"; do
  agent="${RESULTS_AGENTS[$i]}"
  result="${RESULTS_STATUS[$i]}"
  if [[ "$result" == "PASSED" ]]; then
    echo -e "  $agent: ${GREEN}$result${NC}"
  else
    echo -e "  $agent: ${RED}$result${NC}"
  fi
done

echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}$FAILED test(s) failed${NC}"
  exit 1
fi
