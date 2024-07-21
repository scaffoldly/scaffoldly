# Scaffoldly

> [!WARNING]
> This framework is currently in active development and should be considered alpha.

![GitHub release (latest by date)](https://img.shields.io/github/v/release/scaffoldly/scaffoldly?label=version) ![GitHub issues](https://img.shields.io/github/issues/scaffoldly/scaffoldly) ![Acceptance Tests](https://img.shields.io/github/actions/workflow/status/scaffoldly/scaffoldly/acceptance-tests.yml?branch=main)

- Website: https://scaffold.ly
- Forums: https://github.com/scaffoldly/scaffoldly/discussions
- Documentation: https://docs.scaffold.ly

## Introduction

This is the [Scaffoldly](https://scaffold.ly) toolhain. The following packages are provided:

- Scaffoldly CLI
- Scaffoldly GitHub Action
- AWS Lambda Entrypoint

### CLI

```
scaffoldly [command]

Commands:
  scaffoldly identity  Show the current user identity
  scaffoldly login     Login to Scaffoldly

Options:
  --help     Show help  [boolean]
  --version  Show version number  [boolean]
```

## Installation

Please make sure the following is installed:

- NodeJS v18+
- `npm` or `yarn` or `npx` avaliable on the `$PATH`
- (MacOS Alternative) Homebrew available on the `$PATH`

### Using `npm` or `yarn` or `npx`

**`npm`**:

```bash
npm install -g scaffoldly
scaffoldly login # or sly login
```

**`yarn`**:

```bash
yarn global add scaffoldly
scaffoldly login # or sly login
```

**`npx`**:

```bash
npx scaffoldly login
```

### Using Homebrew (MacOS)

```bash
brew tap scaffoldly/tap
brew install scaffoldly
scaffoldly login # or sly login
```

## Getting Started

Once [the CLI is installed](#installation), run the following commands to login and assume roles:

```bash
# Saves a GitHub token to ~/.scaffoldly/github-token.json
scaffoldly login # or sly login
```

```bash
# Show the current identities
scaffoldly identity # or sly identity
```

## Reporting Issues

Please [Open a New Issue](https://github.com/scaffoldly/cli/issues/new/choose) in GitHub if an issue is found with this tool.

## Maintainers

- [Scaffoldly](https://github.com/scaffoldly)
- [cnuss](https://github.com/cnuss)

## Usage Metrics Opt-Out

If you do not want to be included in Anonymous Usage Metrics, ensure an environment variable named `SCAFFOLDLY_DNT` is set:

```bash
SAML_TO_DNT=1 npx scaffoldly
```

## License

[Functional Source License, Version 1.1](LICENSE.md)
