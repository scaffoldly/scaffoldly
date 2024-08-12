import { STSClient } from '@aws-sdk/client-sts';
import packageJson from '../../../package.json';
import { Octokit } from 'octokit';

export class ApiHelper {
  private dev = false;

  private octokit?: Octokit;

  constructor(private argv: string[]) {
    this.dev = this.argv.includes('--dev');

    if (this.dev) {
      console.log(`
*******************
IN DEVELOPMENT MODE
*******************`);
    }
  }

  stsApi(): STSClient {
    return new STSClient();
  }

  githubApi(withToken: string): Octokit {
    if (this.octokit) {
      return this.octokit;
    }
    const octokit = new Octokit({
      auth: withToken,
      userAgent: this.userAgent(),
    });

    this.octokit = octokit;
    return octokit;
  }

  userAgent(): string {
    return `${packageJson.name}/${packageJson.version}`;
  }
}
