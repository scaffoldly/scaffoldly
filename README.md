# Scaffoldly

> [!WARNING]
> This framework is currently in active development and should be considered alpha.

![GitHub release (latest by date)](https://img.shields.io/github/v/release/scaffoldly/scaffoldly?label=version) ![GitHub issues](https://img.shields.io/github/issues/scaffoldly/scaffoldly)

- Website: https://scaffoldly.dev
- Forums: https://github.com/scaffoldly/scaffoldly/discussions
- Documentation: https://scaffoldly.dev/docs

## Introduction

This is the [Scaffoldly](https://scaffoldly.dev) toolhain. The following packages are provided:

- [Scaffoldly CLI](https://scaffoldly.dev/docs/cli)
- [Scaffoldly GitHub Action](https://scaffoldly.dev/docs/gha)
- [Scaffoldly Website](https://scaffoldly.dev)

## CLI Reference

The Scaffoldly CLI is a developer friendly tool build and host applications on AWS Lambda with ease. This guide will provide you with an overview of the available commands and their usage.

_**See**_: [Scaffoldly CLI Documentation](https://scaffoldly.dev/docs/cli)

### Installation

To run the Scaffoldly CLI, you can use `npx`:

```bash
npx scaffoldly [command]
```

```
npx scaffoldly [command]

Commands:
  npx scaffoldly show    Display config, dockerfiles, etc.
  npx scaffoldly dev     [ALPHA FEATURE] Launch a development environment
  npx scaffoldly deploy  Deploy an environment

Options:
  --help     Show help  [boolean]
  --version  Show version number  [boolean]
```

## GitHub Action Reference

Scaffoldly provides a seamless integration with GitHub Actions, allowing you to automate your deployment workflows. This guide will walk you through the process of setting up GitHub Actions for your Scaffoldly projects.

Scaffoldly is available on the [GitHub Actions Marketplace](https://github.com/marketplace/actions/scaffoldly).

_**See**_: [Scaffoldly GitHub Action Documentation](https://scaffoldly.dev/docs/gha)

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy
        uses: scaffoldly/scaffoldly@v1
        with:
          secrets: ${{ toJSON(secrets) }}
```

## Reporting Issues

Please [Open a New Issue](https://github.com/scaffoldly/cli/issues/new/choose) in GitHub if an issue is found with this tool.

Please see [SECURITY.md](SECURITY.md) to report a Security Vulnerability.

## Maintainers

- [Scaffoldly](https://github.com/scaffoldly)
- [cnuss](https://github.com/cnuss)

## Usage Metrics Opt-Out

If you do not want to be included in Anonymous Usage Metrics, ensure an environment variable named `SCAFFOLDLY_DNT` is set:

```bash
SCAFFOLDLY_DNT=1 npx scaffoldly
```

## License

[Functional Source License, Version 1.1](LICENSE.md)
