import { Command, Commands, ScaffoldlyConfig, Schedule } from '../../../../config';
import {
  CreateScheduleCommand,
  CreateScheduleGroupCommand,
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
  UpdateScheduleCommand
>;

export type InvokeFunctionResource = CloudResource<
  LambdaClient,
  Command[],
  InvokeCommand,
  InvokeCommand
>;

const sanitizeSchedule = (schedule: Schedule): string => {
  return schedule.replace('@', '');
};

const scheduleExpression = (schedule: Schedule): string => {
  switch (schedule) {
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
  return serveCommands.commands.reduce((acc, command) => {
    const { schedule } = command;
    if (!schedule) {
      return acc;
    }
    if (!acc[schedule]) {
      acc[schedule] = new Commands();
    }

    acc[schedule].commands.push(command);

    return acc;
  }, {} as { [key in Schedule]: Commands });
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
          ).then((cmds) =>
            cmds.map((cmd) => {
              ui.updateBottomBar('');
              console.log(`\n✅ Executed \`${cmd.cmd}\``);
              if (cmd.output) {
                console.log(`   --> ${cmd.output.trim().replace('\n', '\n   -->')}`);
              }
            }),
          );
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
          console.log(
            `\n✅ Scheduled \`${commands.toString(schedule as Schedule)}\` to run ${schedule}`,
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

    // const actionAfterCompletion: ActionAfterCompletion =
    //   schedule === '@immediately' ? 'DELETE' : 'NONE';

    const target: Target = {
      Arn: functionArn,
      RoleArn: roleArn,
      Input: JSON.stringify(commands.encode()),
    };

    return {
      client: this.schedulerClient,
      read,
      create: (command) => this.schedulerClient.send(command).then(read),
      update: (command) => this.schedulerClient.send(command).then(read),
      request: {
        create: new CreateScheduleCommand({
          Name: name,
          GroupName: group,
          State: 'ENABLED',
          ScheduleExpression: scheduleExpression(schedule),
          ScheduleExpressionTimezone: 'UTC',
          ActionAfterCompletion: 'NONE',
          Target: target,
          FlexibleTimeWindow: {
            Mode: 'OFF',
          },
        }),
        update: new UpdateScheduleCommand({
          Name: name,
          GroupName: group,
          State: 'ENABLED',
          ScheduleExpression: scheduleExpression(schedule),
          ScheduleExpressionTimezone: 'UTC',
          ActionAfterCompletion: 'NONE',
          Target: target,
          FlexibleTimeWindow: {
            Mode: 'OFF',
          },
        }),
      },
    };
  }

  private invokeFunctionResource(name: string, commands: Commands): InvokeFunctionResource {
    let output: Command[] = [];
    const read = async () => {
      return output;
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
      if ('body' in payload && typeof payload.body === 'string') {
        output = JSON.parse(payload.body) as Command[];
      }
    };

    return {
      client: this.lambdaClient,
      read,
      create: (command) => this.lambdaClient.send(command).then(handleResponse).then(read),
      update: (command) => this.lambdaClient.send(command).then(handleResponse).then(read),
      request: {
        create: invokeCommand,
        update: invokeCommand,
      },
    };
  }
}
