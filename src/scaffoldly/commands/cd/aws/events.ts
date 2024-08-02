import { Commands, ScaffoldlyConfig, Schedule } from '../../../../config';
import {
  CreateScheduleCommand,
  CreateScheduleGroupCommand,
  DeleteScheduleCommand,
  // eslint-disable-next-line import/named
  FlexibleTimeWindow,
  GetScheduleCommand,
  GetScheduleGroupCommand,
  SchedulerClient,
  // eslint-disable-next-line import/named
  Target,
  UpdateScheduleCommand,
} from '@aws-sdk/client-scheduler';
import { CloudResource, manageResource, ResourceOptions } from '..';
import { NotFoundException } from './errors';
import { DeployStatus } from '.';
import { IamConsumer, PolicyDocument, TrustRelationship } from './iam';
import {
  InvokeCommand,
  // eslint-disable-next-line import/named
  InvokeCommandOutput,
  LambdaClient,
} from '@aws-sdk/client-lambda';
import { ui } from '../../../command';

export type ScheduleGroup = {
  scheduleGroup: string;
};

export type ScheduleGroupResource = CloudResource<
  SchedulerClient,
  ScheduleGroup,
  CreateScheduleGroupCommand,
  undefined,
  undefined
>;

export type ScheduledEvent = {
  scheduleName: string;
  scheduleGroup: string;
};

export type ScheduleEventResource = CloudResource<
  SchedulerClient,
  ScheduledEvent,
  CreateScheduleCommand,
  UpdateScheduleCommand,
  DeleteScheduleCommand
>;

type InvokeOutput = {
  commands: Commands;
  body: string;
  failed: boolean;
};

export type InvokeFunctionResource = CloudResource<
  LambdaClient,
  InvokeOutput,
  InvokeCommand,
  undefined,
  undefined
>;

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

export class EventsService implements IamConsumer {
  schedulerClient: SchedulerClient;

  lambdaClient: LambdaClient;

  constructor(private config: ScaffoldlyConfig) {
    this.schedulerClient = new SchedulerClient();
    this.lambdaClient = new LambdaClient();
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
          Resource: [`arn:*:lambda:*:*:function:${this.config.name}*`],
        },
      ],
    };
  }

  public async deploy(status: DeployStatus, options: ResourceOptions): Promise<DeployStatus> {
    const { scheduleGroup } = await manageResource(
      this.scheduleGroupResource(this.config.name),
      options,
    );

    if (!scheduleGroup) {
      throw new Error('Missing scheduleGroup');
    }

    const { functionArn, roleArn } = status;
    if (!functionArn) {
      throw new Error('Missing functionArn');
    }

    if (!roleArn) {
      throw new Error('Missing roleArn');
    }

    await Promise.all(
      Object.entries(mapSchedules(this.config)).map(async ([schedule, commands]) => {
        if (schedule === '@immediately') {
          return manageResource(
            this.invokeFunctionResource(this.config.name, commands),
            options,
          ).then((output) => {
            ui.updateBottomBar('');
            const emoji = output.failed ? '❌' : '✅';
            console.log(`\n${emoji} Executed \`${commands.toString({ schedule })}\``);
            if (output.body) {
              console.log(`   --> ${output.body.trim().replace('\n', '\n   -->')}`);
            }
          });
        }

        return manageResource(
          this.scheduleCommandResource(
            scheduleGroup,
            schedule as Schedule,
            commands,
            functionArn,
            roleArn,
          ),
          options,
        ).then(() => {
          ui.updateBottomBar('');
          const command = commands.toString({ schedule: schedule as Schedule });
          if (!command) return;
          console.log(
            `\n✅ Scheduled \`${command}\` for ${scheduleExpression(schedule as Schedule)}`,
          );
        });
      }),
    );

    return { ...status };
  }

  private scheduleGroupResource(name: string): ScheduleGroupResource {
    const read = async () => {
      return this.schedulerClient
        .send(new GetScheduleGroupCommand({ Name: name }))
        .then((response) => {
          if (!response.Name) {
            throw new NotFoundException('Schedule Group not found');
          }
          return {
            scheduleGroup: response.Name,
          } as ScheduleGroup;
        })
        .catch((e) => {
          if (e.name === 'NotFoundException') {
            throw new NotFoundException('Schedule Group not found', e);
          }
          throw e;
        });
    };

    return {
      client: this.schedulerClient,
      read,
      create: (command) => this.schedulerClient.send(command).then(read),
      update: () => read(),
      request: {
        create: new CreateScheduleGroupCommand({
          Name: name,
        }),
      },
    };
  }

  private scheduleCommandResource(
    group: string,
    schedule: Schedule,
    commands: Commands,
    functionArn: string,
    roleArn: string,
  ): ScheduleEventResource {
    const name = sanitizeSchedule(schedule);

    const read = async () => {
      return this.schedulerClient
        .send(new GetScheduleCommand({ Name: name, GroupName: group }))
        .then((response) => {
          const { Name, GroupName } = response;
          if (!Name || !GroupName) {
            throw new NotFoundException('Schedule not found');
          }
          return {
            scheduleName: Name,
            scheduleGroup: GroupName,
          } as ScheduledEvent;
        })
        .catch((e) => {
          if (e.name === 'NotFoundException') {
            throw new NotFoundException('Schedule not found', e);
          }
          throw e;
        });
    };

    const target: Target = {
      Arn: functionArn,
      RoleArn: roleArn,
      Input: JSON.stringify(commands.encode()),
    };

    const flexibleTimeWindow: FlexibleTimeWindow =
      schedule === '@frequently'
        ? { Mode: 'FLEXIBLE', MaximumWindowInMinutes: 5 }
        : { Mode: 'OFF' };

    return {
      client: this.schedulerClient,
      read,
      create: (command) => this.schedulerClient.send(command).then(read),
      update: (command) => this.schedulerClient.send(command).then(read),
      dispose: (resource, command) => this.schedulerClient.send(command).then(() => resource),
      disposable: Promise.resolve(
        this.config.serveCommands.commands.every((c) => c.schedule !== schedule),
      ),
      request: {
        create: new CreateScheduleCommand({
          Name: name,
          GroupName: group,
          State: 'ENABLED',
          ScheduleExpression: scheduleExpression(schedule),
          ScheduleExpressionTimezone: 'UTC',
          ActionAfterCompletion: 'NONE',
          Target: target,
          FlexibleTimeWindow: flexibleTimeWindow,
        }),
        update: new UpdateScheduleCommand({
          Name: name,
          GroupName: group,
          State: 'ENABLED',
          ScheduleExpression: scheduleExpression(schedule),
          ScheduleExpressionTimezone: 'UTC',
          ActionAfterCompletion: 'NONE',
          Target: target,
          FlexibleTimeWindow: flexibleTimeWindow,
        }),
        dispose: new DeleteScheduleCommand({
          Name: name,
          GroupName: group,
        }),
      },
    };
  }

  private invokeFunctionResource(name: string, commands: Commands): InvokeFunctionResource {
    let output: string | undefined = '';
    let failed = false;
    const read = async () => {
      if (!output) {
        throw new NotFoundException('No output');
      }
      return {
        body: JSON.stringify(output),
        failed,
      } as InvokeOutput;
    };

    const invokeCommand: InvokeCommand = new InvokeCommand({
      FunctionName: name,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(commands.encode()),
    });

    const handleResponse = (response: InvokeCommandOutput) => {
      const { Payload } = response;
      if (!Payload) {
        return;
      }

      const payload = JSON.parse(Buffer.from(Payload).toString('utf-8'));
      if ('statusCode' in payload && payload.statusCode !== 200) {
        failed = true;
      }
      if ('body' in payload && typeof payload.body === 'string') {
        output = JSON.parse(payload.body);
      } else {
        output = JSON.stringify(payload);
      }
    };

    return {
      client: this.lambdaClient,
      read,
      create: (command) => this.lambdaClient.send(command).then(handleResponse).then(read),
      update: read,
      request: {
        create: invokeCommand,
      },
    };
  }
}
