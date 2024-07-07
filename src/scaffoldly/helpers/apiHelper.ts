import { STSClient } from '@aws-sdk/client-sts';
import packageJson from '../../../package.json';
import { Octokit } from 'octokit';

export class ApiHelper {
  private dev = false;

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
    return new STSClient({
      region: 'us-east-1',
    });
  }

  githubApi(withToken: string): Octokit {
    return new Octokit({
      auth: withToken,
      userAgent: this.userAgent(),
    });
  }

  userAgent(): string {
    return `${packageJson.name}/${packageJson.version}`;
  }
}
