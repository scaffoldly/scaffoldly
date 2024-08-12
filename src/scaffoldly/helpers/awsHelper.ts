import { ui } from '../command';
import { GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { ApiHelper } from './apiHelper';

export class AwsHelper {
  constructor(private apiHelper: ApiHelper) {}

  async currentIdentity(): Promise<string | undefined> {
    ui.updateBottomBar('Fetching AWS identity...');
    try {
      const sts = this.apiHelper.stsApi();
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      return identity.UserId;
    } catch (e) {
      return undefined;
    }
  }
}
