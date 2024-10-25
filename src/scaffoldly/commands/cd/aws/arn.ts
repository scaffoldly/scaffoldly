import { parse } from '@aws-sdk/util-arn-parser';
import { EnvProducer } from '../../ci/env';
import { CloudResource, ResourceOptions } from '..';
import { ui } from '../../../command';

export class ARN<ReadCommandOutput> implements EnvProducer {
  private _arn: string;

  private _resource: string;

  private _searchParams: URLSearchParams;

  private _hash: string;

  constructor(
    arn: string,
    private cloudResource: CloudResource<{ arn: string }, ReadCommandOutput>,
    private options: ResourceOptions,
    private desired?: ReadCommandOutput,
  ) {
    this._arn = arn.toLowerCase();

    const { name, searchParams, hash } = ARN.resource(this._arn);
    this._resource = name;
    this._searchParams = searchParams;
    this._hash = hash;
  }

  static resource(arn: string): { name: string; searchParams: URLSearchParams; hash: string } {
    const { partition, service, resource: rawResource } = parse(arn.toLowerCase());
    const url = new URL(`${partition || 'aws'}://${service}/${rawResource}`);

    const name = url.pathname.split('/').slice(1).join('/');
    const searchParams = url.searchParams;
    const hash = url.hash.split('#').slice(1).join('#');

    return { name, searchParams, hash };
  }

  get arn(): Promise<string | undefined> {
    return Promise.resolve(this.partition).then(async (partition) => {
      if (partition) {
        return this._arn;
      }

      // If partitition is unknown, we need to manage the resource
      const { arn } = await this.cloudResource.manage(this.options, this.desired);
      if (arn) {
        this._arn = arn;
      }

      return this._arn;
    });
  }

  get partition(): string | undefined {
    return parse(this._arn).partition;
  }

  get service(): string {
    return parse(this._arn).service;
  }

  get region(): Promise<string | undefined> {
    return Promise.resolve(parse(this._arn).region);
  }

  get accountId(): string | undefined {
    return parse(this._arn).accountId;
  }

  get resource(): string {
    return this._resource;
  }

  get hash(): string {
    return this._hash || 'cruds'; // create, read, update, delete, stream by default
  }

  get permissions(): {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    stream: boolean;
  } {
    const hashes = this.hash.toLowerCase().split('');
    return {
      create: hashes.includes('c'),
      read: hashes.includes('r'),
      update: hashes.includes('u'),
      delete: hashes.includes('d'),
      stream: hashes.includes('s'),
    };
  }

  get searchParams(): URLSearchParams {
    return this._searchParams;
  }

  get env(): Promise<Record<string, string>> {
    return Promise.all([this.arn, this.partition, this.service, this.resource]).then(
      ([arn, partition = 'aws', service, resource]) => {
        if (!arn) {
          ui.updateBottomBar('');
          console.warn(`🟠 Unable to determine ARN for ${this._arn}`);
          return {};
        }

        // Split resource into parts on non-word characters
        const partitionParts = partition.split(/[^a-zA-Z0-9]/);
        const resourceParts = resource.split(/[^a-zA-Z0-9]/);

        // arn:aws:dynamodb:us-east-1:123456789012:table/my-table ==> AWS_DYNAMODB_TABLE_MY_TABLE
        // arn:aws:s3:::my-bucket ==> AWS_S3_BUCKET_MY_BUCKET
        // arn:aws:lambda:us-east-1:123456789012:function:my-function ==> AWS_LAMBDA_FUNCTION_MY_FUNCTION
        // arn:aws-cn:s3:::my-bucket ==> AWS_CN_S3_BUCKET_MY_BUCKET
        // arn:aws:secretsmanager:us-east-1:123456789012:secret:events@main ==> AWS_SECRETSMANAGER_SECRET_EVENTS_MAIN

        const parts = [...partitionParts, service, ...resourceParts];
        const key = parts.join('_').toUpperCase();

        return {
          [key]: arn,
        };
      },
    );
  }
}
