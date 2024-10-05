import { STSClient } from '@aws-sdk/client-sts';
import { Octokit } from 'octokit';
import { EventService } from '../event';

export class ApiHelper {
  private dev = false;

  private octokit?: Octokit;

  constructor(private argv: string[], private eventService: EventService) {
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
      userAgent: this.eventService.userAgent,
    });

    this.octokit = octokit;
    return octokit;
  }
}
