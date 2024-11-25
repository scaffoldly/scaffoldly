import { AwsBehaviorImpl } from './aws';

export interface Behavior {
  readonly version: 'v1';
  aws: AwsBehavior;
}

export interface AwsBehavior {
  vpc: AwsVpcBehavior;
}

export interface AwsVpcBehavior {
  subnets: AwsVpcSubnetsBehavior;

  vpcId: (vpcId?: string) => string;
  securityGroupIds: (securityGroupIds?: string[]) => string[];
}

export interface AwsVpcSubnetsBehavior {
  readonly max: number;

  subnetIds: (subnetIds?: string[]) => string[];
}

export class BehaviorException<T, V> extends Error {
  reason: { type: T; effect: 'changed' | 'removed' | 'added'; actual: V; expected: V };

  constructor(reason: {
    type: T;
    effect: 'changed' | 'removed' | 'added';
    actual: V;
    expected: V;
  }) {
    const name = 'BehaviorException';
    super(
      `${name}: ${reason.type} ${reason.effect} (actual: ${reason.actual}, expected: ${reason.expected})`,
    );
    this.name = name;
    this.reason = reason;
  }

  static isBehaviorException<T, V>(error: Error): error is BehaviorException<T, V> {
    return (
      error.name === 'BehaviorException' &&
      'reason' in error &&
      !!error.reason &&
      typeof error.reason === 'object' &&
      'type' in error.reason &&
      'actual' in error.reason &&
      'expected' in error.reason
    );
  }
}

export class ScaffoldlyBehavior implements Behavior {
  readonly version = 'v1';

  aws = new AwsBehaviorImpl();

  static load(): Behavior {
    // TODO: Merge in behavior from scaffoldly.toml
    const behavior = new ScaffoldlyBehavior();

    return behavior;
  }
}
