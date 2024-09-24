Scaffoldly is a **new framework** for **packaging and deploying** applications to AWS. Scaffoldly provides:

- a [Simple Configuration](#usage) to specify packaging and runtime configuration.
- a [Command Line Interface](#command-line-interface) for packaging and deploying locally.
- a [GitHub Action](#github-action) for packaging and deploying in CI/CD.

It is a **open-source**, **no-code**, **developer-focused** solution that simplifies the packaging and deployment process for modern web applications.

✨ Our **[docs site](https://scaffoldly.dev)** is built and deployed **using Scaffoldly** ([source](https://github.com/scaffoldly/scaffoldly/blob/729100c6ef18de6105d0f12c721640be8e8df004/packages/website/package.json#L59-L87)), which uses the **Docusaurus Framework**, is hosted on **AWS Lambda**, and is deployed using **GitHub Actions** ([source](https://github.com/scaffoldly/scaffoldly/blob/729100c6ef18de6105d0f12c721640be8e8df004/.github/workflows/push-main.yml#L49-L52)).

### Motivation

- Current tooling (such as Serverless, AWS SAM, Terraform, Pulumi, AWS CDKs, and Docker) is **unintuitive** and **cumbersome** for developers.
- Popular frameworks (such as Next.js) are **expensive** and **difficult** to deploy to public Clouds Providers such as AWS.
- Most applications can be run **cost effectively** in **serverless compute** such as AWS Lambda.

We believe that developing apps locally has been made incredibly easy. **Deploying them to the Cloud Provider of your choice should be equally easy**. [Learn More](https://scaffoldy.dev/about).

### Key Features

- **Automatic Docker Image Generation**: No need to write Dockerfiles manually.
- **Infrastructure Automation**: Automatically create and manage AWS resources.
- **Built-in CI/CD Support**: Integrate with GitHub Actions for seamless deployments.
- **Environment Variables and Secrets**: Dotenv and GitHub Secrets are built-in.
- **Minimal configuration required**: Get started quickly with sensible defaults.
- **Built for the Public Cloud**: Deploy applications to AWS Lambda effortlessly. Don't get locked into using Vercel or Netlify.
- **Cost Effective**: Only pay for what you use with AWS Lambda.

## Tutorials

- Next.js: [Deploy a Next.js application to AWS lambda in 5 minutes](https://scaffoldly.dev/docs/tutorials/nextjs)

## Usage

Using a minimal configuration in `package.json`, the `scaffoldly` toolchain can package and deploy an application:

```jsonc title="package.json"
{
  "name": "my-app",
  "version": "0.1.0",
  // other package.json
  "scaffoldly": {
    "runtime": "node:22-alpine",
    "handler": "localhost:3000",
    "files": [".next", "node_modules", "package.json", "package-lock.json"],
    "scripts": {
      "install": "npm install",
      "dev": "npm run dev",
      "build": "npm run build",
      "start": "npm run start"
    }
  }
}
```

Running [`scaffoldly deploy`](#command-line-interface) or the [GitHub Action](#github-action) will automatically create and push a multi-stage Docker build to ECR and deploy it to AWS Lambda.

### Command Line Interface

```bash
npx scaffoldly [command]
```

The Scaffoldly CLI is a developer friendly tool build and host applications on AWS Lambda with ease, and is available on [npm](https://www.npmjs.com/package/scaffoldly) and can be invoked using `npx`.

```
Commands:
  npx scaffoldly show    Display config, dockerfiles, etc.
  npx scaffoldly dev     [ALPHA FEATURE] Launch a development environment
  npx scaffoldly deploy  Deploy an environment

Options:
  --help     Show help  [boolean]
  --version  Show version number  [boolean]
```

_**See**_: [CLI Docs](https://scaffoldly.dev/docs/cli) for more iformation.

### GitHub Action

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

Scaffoldly provides a seamless integration with GitHub Actions, allowing you to deploy your applications using GitHub, and is available on the [GitHub Actions Marketplace](https://github.com/marketplace/actions/scaffoldly).

_**See**_: [GitHub Action Docs](https://scaffoldly.dev/docs/gha) for more information.

### Usage Metrics Opt-Out

If you do not want to be included in Anonymous Usage Metrics, ensure an environment variable named `SCAFFOLDLY_DNT` is set:

```bash
SCAFFOLDLY_DNT=1 npx scaffoldly
```

## Documentation

Documentation for the Scaffoldly toolchain is located at [https://scaffoldly.dev/docs](https://scaffoldly.dev/docs).

## Reporting Issues

- **Bugs and Features**: Please [Open a New Issue](https://github.com/scaffoldly/cli/issues/new/choose) in GitHub.
- **Security Advisories**: Please [Report a Advisory](https://github.com/scaffoldly/scaffoldly/security/advisories/new) in GitHub.

## Maintainers

- [Scaffoldly](https://github.com/scaffoldly)
- [cnuss](https://github.com/cnuss)

## License

[Functional Source License, Version 1.1](https://github.com/scaffoldly/scaffoldly?tab=License-1-ov-file)
