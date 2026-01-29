# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.17.2](https://github.com/danwahlin/zingit/compare/v0.17.1...v0.17.2) (2026-01-29)

### [0.17.1](https://github.com/danwahlin/zingit/compare/v0.16.1...v0.17.1) (2026-01-29)

### [0.16.1](https://github.com/danwahlin/zingit/compare/v0.16.0...v0.16.1) (2026-01-29)


### Features

* integrate standard-version for versioning and changelog management ([69c9f4e](https://github.com/danwahlin/zingit/commit/69c9f4ee5a025d845c4ea6bfb9185c8cee306a2f))

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
