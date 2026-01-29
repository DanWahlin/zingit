# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.16.0](https://github.com/danwahlin/zingit/compare/v0.15.0...v0.16.0) (2026-01-28)

### Bug Fixes

* **security**: Fix command injection vulnerability in git operations ([server/src/services/git-manager.ts](server/src/services/git-manager.ts))
  * Replaced `execAsync` with `execFileAsync` using array arguments to prevent shell injection
  * Affected commands: git diff, git reset --hard
* **security**: Fix XSS vulnerability in agent response rendering ([client/src/components/agent-response-panel.ts](client/src/components/agent-response-panel.ts))
  * Implemented safe Lit templating instead of `.innerHTML`
  * All user content is now automatically HTML-escaped by Lit's template system
  * Markdown formatting (bold, italic, code) preserved while preventing script injection

### Features

* Add 'prompts' keyword to package.json for improved discoverability
