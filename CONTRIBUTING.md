# Contributing to ZingIt

Thank you for your interest in contributing to ZingIt! We welcome contributions from the community.

Note: This is a "hobby" project maintained by [Dan Wahlin](https://x.com/danwahlin) in his spare time. While contributions are appreciated, please understand that response times may vary.

## How to Contribute

### Reporting Issues

If you encounter a bug or have a feature request:

1. Check the [existing issues](https://github.com/danwahlin/zingit/issues) to see if it's already reported
2. If not, [create a new issue](https://github.com/danwahlin/zingit/issues/new) with:
   - A clear, descriptive title
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Your environment (browser, OS, Node version)
   - Screenshots or error messages if applicable

### Submitting Pull Requests

1. **Fork the repository** and create a new branch from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines below

3. **Test your changes** by doing a typecheck and ensuring everything works as expected
   ```bash
   npm run typecheck
   ```

4. **Commit your changes** using clear, descriptive commit messages
   ```bash
   git commit -m "feat: add new feature description"
   ```

5. **Push to your fork** and submit a pull request
   ```bash
   git push origin feature/your-feature-name
   ```

6. In your pull request description:
   - Describe what changes you made and why
   - Reference any related issues (e.g., "Fixes #123")
   - Include screenshots for UI changes

## Development Setup

Refer to the [README.md](README.md) for detailed instructions on setting up your development environment and running ZingIt locally.

## Code Style Guidelines

- **TypeScript**: Use strict typing, avoid `any` types
- **Components**: Follow Lit web component patterns
- **Formatting**: Run `npm run typecheck` before committing
- **Comments**: Document complex logic and public APIs
- **Naming**: Use descriptive variable/function names

## Commit Message Convention

We use conventional commits for clarity:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Build process or tooling changes

Example: `feat: add screenshot auto-capture for markers`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
