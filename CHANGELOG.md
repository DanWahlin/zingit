# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## 0.17.5 (2026-02-22)


### Features

* integrate @codewithdan/agent-sdk-core for all AI agent providers ([a49229f](https://github.com/danwahlin/zingit/commit/a49229f390f00578539ea5bb3671565f01efbaee))


### Bug Fixes

* default PROJECT_DIR to npm invocation directory ([bd21484](https://github.com/danwahlin/zingit/commit/bd21484ea02b6a8e139fc850726c2e9f8597ee14))
* replace deprecated standard-version with commit-and-tag-version ([3e0646c](https://github.com/danwahlin/zingit/commit/3e0646c03d1cf3451dd334a15dfe95bb106b8744))
* update vulnerable devDependencies and harden querySelector ([c6a88e4](https://github.com/danwahlin/zingit/commit/c6a88e473a081dcee8887bbb7dae5390044e6102))


### Documentation

* update demo site setup steps for npm workspaces ([e53859c](https://github.com/danwahlin/zingit/commit/e53859cfb84a17b772e4570b378c95cf4c7b7f5b))
* update README and AGENTS.md for npm workspaces setup ([bf9a6ab](https://github.com/danwahlin/zingit/commit/bf9a6ab37ac0da8e2d41e283a9c185380d64803c))

### [0.17.4](https://github.com/danwahlin/zingit/compare/v0.17.3...v0.17.4) (2026-01-30)

### [0.17.3](https://github.com/danwahlin/zingit/compare/v0.17.2...v0.17.3) (2026-01-29)


### Features

* add issue templates for bug reports and feature requests, and update contributing guidelines ([a186827](https://github.com/danwahlin/zingit/commit/a18682762df7096a6c4003107f0590aafb22085d))


### Bug Fixes

* update documentation link and comment out discussions section in issue template ([1059c47](https://github.com/danwahlin/zingit/commit/1059c47d4f258f7ae626c86b95faa00ddfb2a034))

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
