import { Commands, ScaffoldlyConfig, Schedule } from '../../../../config';
import {
  CreateScheduleCommand,
  CreateScheduleGroupCommand,
  DeleteScheduleCommand,
  // eslint-disable-next-line import/named
  FlexibleTimeWindow,
  GetScheduleGroupCommand,
  // eslint-disable-next-line import/named
  GetScheduleGroupCommandOutput,
  ListSchedulesCommand,
  // eslint-disable-next-line import/named
  ListSchedulesCommandOutput,
  SchedulerClient,
  UpdateScheduleCommand,
} from '@aws-sdk/client-scheduler';
import { CloudResource, ResourceOptions } from '..';
import { IamConsumer, IamDeployStatus, PolicyDocument, TrustRelationship } from './iam';
import {
  InvokeCommand,
  // eslint-disable-next-line import/named
  InvokeCommandOutput,
  LambdaClient,
} from '@aws-sdk/client-lambda';
import { NotFoundException, SkipAction } from '../errors';
import { LambdaDeployStatus } from './lambda';
import { GitService } from '../git';

export type ScheduleDeployStatus = {
  scheduleGroup?: string;
};

export type ScheduleGroup = {
  scheduleGroup: string;
};

// export type ScheduleGroupResource = CloudResource<
//   SchedulerClient,
//   ScheduleGroup,
//   CreateScheduleGroupCommand,
//   undefined,
//   undefined
// >;

export type ScheduledEvent = {
  scheduleName: string;
  scheduleGroup: string;
};

// export type ScheduleEventResource = CloudResource<
//   SchedulerClient,
//   ScheduledEvent,
//   CreateScheduleCommand,
//   UpdateScheduleCommand,
//   DeleteScheduleCommand
// >;

type InvokeOutput = {
  commands?: Commands;
  failed?: boolean;
  lines?: string[];
};

// export type InvokeFunctionResource = CloudResource<
//   LambdaClient,
//   InvokeOutput,
//   InvokeCommand,
//   undefined,
//   undefined
// >;

const sanitizeSchedule = (schedule: Schedule): string => {
  return schedule.replace('@', '');
};

const scheduleExpression = (schedule: Schedule): string => {
  switch (schedule) {
    case '@frequently':
      return 'rate(5 minutes)';
    case '@hourly':
      return 'rate(1 hour)';
    case '@daily':
      return 'rate(1 day)';
    default:
      throw new Error(`Invalid schedule: ${schedule}`);
  }
};

const flexibleTimeWindow = (schedule: Schedule): FlexibleTimeWindow => {
  switch (schedule) {
    case '@frequently':
      return { Mode: 'FLEXIBLE', MaximumWindowInMinutes: 5 };
    default:
      return { Mode: 'OFF' };
  }
};

const mapSchedules = (config: ScaffoldlyConfig): { [key in Schedule]: Commands } => {
  const { serveCommands } = config;
  return serveCommands.commands.reduce(
    (acc, command) => {
      const { schedule } = command;
      if (!schedule) {
        return acc;
      }

      acc[schedule].commands.push(command);

      return acc;
    },
    {
      '@immediately': new Commands(),
      '@daily': new Commands(),
      '@hourly': new Commands(),
      '@frequently': new Commands(),
    },
  );
};

export class ScheduleService implements IamConsumer {
  schedulerClient: SchedulerClient;

  lambdaClient: LambdaClient;

  constructor(private gitService: GitService) {
    this.schedulerClient = new SchedulerClient();
    this.lambdaClient = new LambdaClient();
  }

  public async predeploy(status: ScheduleDeployStatus, options: ResourceOptions): Promise<void> {
    if (options.dev) {
      return;
    }

    const { scheduleGroup } = await new CloudResource<
      { scheduleGroup: string },
      GetScheduleGroupCommandOutput
    >(
      {
        describe: (resource) => {
          return { type: 'Schedule Group', label: resource.scheduleGroup };
        },
        read: () =>
          this.schedulerClient.send(
            new GetScheduleGroupCommand({ Name: this.gitService.config.name }),
          ),
        create: () => {
          if (!this.gitService.config.schedules) {
            throw new SkipAction('No schedules to create');
          }
          return this.schedulerClient.send(
            new CreateScheduleGroupCommand({ Name: this.gitService.config.name }),
          );
        },
      },
      (existing) => {
        return { scheduleGroup: existing.Name };
      },
    ).manage(options);

    status.scheduleGroup = scheduleGroup;
  }

  public async deploy(
    status: ScheduleDeployStatus & LambdaDeployStatus & IamDeployStatus,
    options: ResourceOptions,
  ): Promise<void> {
    if (options.dev) {
      return;
    }

    const { name } = this.gitService.config;

    const schedules = mapSchedules(this.gitService.config);

    const desiredSchedules = Object.entries(schedules).filter(
      ([schedule, commands]) => schedule !== '@immediately' && !commands.isEmpty(),
    );

    const undesiredSchedules = Object.entries(schedules).filter(
      ([schedule, commands]) => schedule !== '@immediately' && commands.isEmpty(),
    );

    await new CloudResource<{ schedules: string[] }, ListSchedulesCommandOutput>(
      {
        describe: (resource) => {
          return { type: 'Schedules', label: resource.schedules?.join(', ') };
        },
        read: () =>
          this.schedulerClient.send(new ListSchedulesCommand({ GroupName: status.scheduleGroup })),
        update: () => {
          if (!desiredSchedules.length) {
            throw new SkipAction('No schedules to update');
          }
          return Promise.all(
            desiredSchedules.map(([schedule, commands]) =>
              this.schedulerClient
                .send(
                  new UpdateScheduleCommand({
                    Name: sanitizeSchedule(schedule as Schedule),
                    GroupName: status.scheduleGroup,
                    State: 'ENABLED',
                    ScheduleExpression: scheduleExpression(schedule as Schedule),
                    ScheduleExpressionTimezone: 'UTC',
                    ActionAfterCompletion: 'NONE',
                    Target: {
                      Arn: status.functionArn,
                      RoleArn: status.roleArn,
                      Input: JSON.stringify(commands.encode()),
                    },
                    FlexibleTimeWindow: flexibleTimeWindow(schedule as Schedule),
                  }),
                )
                .catch(() =>
                  this.schedulerClient.send(
                    new CreateScheduleCommand({
                      Name: sanitizeSchedule(schedule as Schedule),
                      GroupName: status.scheduleGroup,
                      State: 'ENABLED',
                      ScheduleExpression: scheduleExpression(schedule as Schedule),
                      ScheduleExpressionTimezone: 'UTC',
                      ActionAfterCompletion: 'NONE',
                      Target: {
                        Arn: status.functionArn,
                        RoleArn: status.roleArn,
                        Input: JSON.stringify(commands.encode()),
                      },
                      FlexibleTimeWindow: flexibleTimeWindow(schedule as Schedule),
                    }),
                  ),
                ),
            ),
          );
        },
        dispose: () =>
          Promise.all(
            undesiredSchedules.map(([schedule]) =>
              this.schedulerClient.send(
                new DeleteScheduleCommand({
                  Name: sanitizeSchedule(schedule as Schedule),
                  GroupName: status.scheduleGroup,
                }),
              ),
            ),
          ),
      },
      (existing) => {
        return {
          schedules: (existing.Schedules || [])
            .filter(
              (s) =>
                !!s.Name &&
                desiredSchedules.some(
                  ([schedule]) => sanitizeSchedule(schedule as Schedule) === s.Name,
                ),
            )
            .map((s) => s.Name) as string[],
        };
      },
    )
      .manage(options)
      .dispose();

    if (!schedules['@immediately'].isEmpty()) {
      let invokeOutput: InvokeOutput | undefined = undefined;

      const outputPrefix = '   ==> ';

      const parseOutput = (output: Partial<InvokeCommandOutput>): InvokeOutput => {
        if (!output) {
          return { commands: schedules['@immediately'] };
        }

        const { Payload } = output;
        let failed = true;
        let body = '';

        if (!Payload) {
          return { commands: schedules['@immediately'], failed, lines: [] };
        }

        const payload = JSON.parse(Buffer.from(Payload).toString('utf-8'));
        if ('statusCode' in payload && payload.statusCode === 200) {
          failed = false;
        }

        if ('body' in payload && typeof payload.body === 'string') {
          body = JSON.parse(payload.body);
        } else {
          body = JSON.stringify(payload);
        }

        const lines = body.split('\n').map((line) => `${outputPrefix}${line}`);
        lines.unshift(''); // Add a blank line at the beginning

        if (failed) {
          throw new Error(lines.join('\n'));
        }

        return { commands: schedules['@immediately'], failed, lines };
      };

      await new CloudResource<InvokeOutput, InvokeOutput>(
        {
          describe: (resource) => {
            const type = 'Invocation for @immediately';
            if (resource.failed) {
              // Don't show lines they will be in the error when it's outputted
              return { type };
            }
            return { type, label: resource.lines?.join('\n') };
          },
          read: () => {
            if (!invokeOutput) {
              throw new NotFoundException('Not invoked');
            }
            return Promise.resolve(invokeOutput);
          },
          create: () =>
            this.lambdaClient
              .send(
                new InvokeCommand({
                  FunctionName: name,
                  InvocationType: 'RequestResponse',
                  Payload: JSON.stringify(schedules['@immediately'].encode()),
                }),
              )
              .then((response) => {
                invokeOutput = parseOutput(response);
                return invokeOutput;
              }),
        },
        (output) => output,
      ).manage(options);
    }
  }

  get trustRelationship(): TrustRelationship {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'scheduler.amazonaws.com',
          },
          Action: 'sts:AssumeRole',
        },
      ],
    };
  }

  get policyDocument(): PolicyDocument {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Action: ['lambda:InvokeFunction'],
          Effect: 'Allow',
          Resource: [`arn:*:lambda:*:*:function:${this.gitService.config.name}*`],
        },
      ],
    };
  }
}
