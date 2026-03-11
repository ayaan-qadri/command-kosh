# Contributing to Command Kosh

First off, thanks for taking the time to contribute! 🎉

Command Kosh is an open-source project and we welcome contributions of all kinds - bug fixes, new features, documentation improvements, and platform-specific testing (especially on macOS and Linux).

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Development Setup](#development-setup)
- [Getting Help](#getting-help)

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold a welcoming and respectful environment for everyone.

## How Can I Contribute?

### Reporting Bugs

If you find a bug, please [open an issue](https://github.com/ayaan-qadri/command-kosh/issues/new?template=bug_report.md) with as much detail as possible:

- **OS and version** (e.g., Windows 11, macOS Sonoma, Ubuntu 24.04)
- **Steps to reproduce** the issue
- **Expected behavior** vs. **actual behavior**
- **Screenshots or logs** if applicable

### Suggesting Features

Have an idea? [Open a feature request](https://github.com/ayaan-qadri/command-kosh/issues/new?template=feature_request.md) and describe:

- The problem you're trying to solve
- How you envision the solution
- Any alternatives you've considered

### Submitting Pull Requests

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** and test them thoroughly
4. **Commit** with a clear, descriptive message:
   ```bash
   git commit -m "feat: add ability to backup commands as JSON"
   ```
5. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request** against the `main` branch

#### Commit Message Guidelines

We loosely follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Purpose |
|--------|---------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation changes |
| `style:` | Code style (formatting, no logic change) |
| `refactor:` | Code refactoring |
| `test:` | Adding or updating tests |
| `chore:` | Maintenance tasks |

## Development Setup

### Prerequisites

- **Node.js** (latest LTS): [nodejs.org](https://nodejs.org/en/download)
- **Rust** (via rustup): [rustup.rs](https://rustup.rs/)
- **Platform-specific dependencies** for Tauri: [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

### Installation

```bash
# Clone your fork
git clone https://github.com/<your-username>/command-kosh.git
cd command-kosh

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```


## Getting Help

If you're stuck or have questions:

- Open a [Discussion](https://github.com/ayaan-qadri/command-kosh/discussions) on GitHub
- Comment on the relevant issue

Thank you for helping make Command Kosh better! 🚀
