import _ from 'lodash';
import { AwsBehavior, AwsVpcBehavior, AwsVpcSubnetsBehavior, BehaviorException } from '..';

export class AwsVpcSubnetsBehaviorImpl implements AwsVpcSubnetsBehavior {
  readonly max = 1;

  private _subnetIds?: string[];

  subnetIds = (subnetIds?: string[]): string[] => {
    const next = (subnetIds || []).sort().slice(0, this.max);

    if (this._subnetIds && !_.isEqual(this._subnetIds, next)) {
      throw new BehaviorException({
        type: 'AwsVpcSubnetIds',
        effect: 'changed',
        actual: this._subnetIds,
        expected: next,
      });
    }

    this._subnetIds = next;
    return next;
  };
}

export class AwsVpcBehaviorImpl implements AwsVpcBehavior {
  subnets: AwsVpcSubnetsBehavior = new AwsVpcSubnetsBehaviorImpl();

  private _vpcId?: string;

  private _securityGroupIds?: string[];

  vpcId = (vpcId?: string): string => {
    if (this._vpcId && this._vpcId !== vpcId) {
      throw new BehaviorException({
        type: 'AwsVpcId',
        effect: 'changed',
        actual: this._vpcId,
        expected: vpcId,
      });
    }

    if (!vpcId || (this._vpcId && !vpcId)) {
      throw new BehaviorException({
        type: 'AwsVpcId',
        effect: 'removed',
        actual: this._vpcId,
        expected: vpcId,
      });
    }

    this._vpcId = vpcId;
    return this._vpcId;
  };

  securityGroupIds = (securityGroupIds?: string[]): string[] => {
    // Merge and dedupe the security group ids
    const next = [
      ...new Set([...(securityGroupIds || []), ...(this._securityGroupIds || [])]),
    ].sort();

    this._securityGroupIds = next;
    return this._securityGroupIds;
  };
}

export class AwsBehaviorImpl implements AwsBehavior {
  vpc = new AwsVpcBehaviorImpl();
}
