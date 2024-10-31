import os from 'os';
import { v5 as uuidv5 } from 'uuid';
import { URLSearchParams } from 'url';
import { ProjectJson } from '../config';
import { Subject } from 'rxjs';
import axios from 'axios';
import { NotifyAction } from './commands/cd';

type Session = {
  sessionId: string;
  time: number;
  insertId: string;
  eventId: number;
};

type StartEvent = Partial<Session> & {
  type: 'start';
  deviceId: string;
  platform: string;
  language: string;
  ip: string;
  library: string;
  userAgent: string;
  args: string[];
};

type ProjectEvent = Partial<Session> & {
  type: 'project';
  projectType: string;
  config?: {
    [key: string]: unknown;
  };
};

type ResourceEvent = Partial<Session> & {
  type: 'resource';
  action: string;
  resourceType: string;
  resourceId: string;
};

export type Event = Partial<StartEvent> | Partial<ProjectEvent> | Partial<ResourceEvent>;

export type SessionEvent = Partial<Event> & {
  sessionId: string;
  time: number;
};

export type EventResponse = Partial<SessionEvent> & {
  error?: string;
};

const deviceId = () => {
  const macAddresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((info) => !!info && info.mac && info.mac !== '00:00:00:00:00:00')
    .filter((info) => !!info)
    .map((info) => info.mac)
    .sort();
  return uuidv5(`macs://${macAddresses.join('/')}`, uuidv5.URL);
};

const resourceId = (resource: string | unknown) => {
  if (typeof resource === 'string') {
    return uuidv5(`resource://${resource}`, uuidv5.URL);
  }
  return uuidv5(`resource://${JSON.stringify(resource)}`, uuidv5.URL);
};

// eslint-disable-next-line @typescript-eslint/naming-convention
let _eventId = 0;

const eventId = () => {
  return (_eventId += 1);
};

const createSession = (
  sessionId: string,
  insertId: string,
  platform: 'Cli' | 'Gha' | 'Ale',
  args: string[],
  library: string,
  userAgent: string,
): StartEvent => {
  const now = Date.now();

  return {
    sessionId,
    time: now,
    insertId,
    eventId: eventId(),
    deviceId: deviceId(),
    type: 'start',
    platform,
    language: process.env.LANG || 'unknown',
    ip: '$remote',
    library,
    userAgent,
    args,
  };
};

const convertArgs = (args: string[] | Record<string, string | undefined> = []): string[] => {
  const pathParts: string[] = [];
  const params = new URLSearchParams();

  if (!Array.isArray(args)) {
    args = Object.entries(args).reduce((acc, [key, value]) => {
      if (!value) {
        return acc;
      }
      acc.push(`--${key}=${value}`);
      return acc;
    }, [] as string[]);
  }

  args.forEach((arg) => {
    if (arg.includes('=')) {
      const [key, value] = arg.split('=');

      let sanitizedKey = key;

      if (key.startsWith('--')) {
        sanitizedKey = key.slice(2);
      } else if (key.startsWith('-')) {
        sanitizedKey = key.slice(1);
      }

      params.append(sanitizedKey, value);
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      params.append(key, 'true');
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      params.append(key, 'true');
    } else {
      pathParts.push(arg);
    }
  });

  return args;
};

const createProjectEvent = (
  sessionId: string,
  insertId: string,
  project: ProjectJson,
): ProjectEvent => {
  return {
    sessionId,
    type: 'project',
    time: Date.now(),
    eventId: eventId(),
    insertId,
    config: project.scaffoldly,
    projectType: project.type,
  };
};

const createResourceEvent = (
  sessionId: string,
  insertId: string,
  action: NotifyAction,
  type: string,
  message: string,
): ResourceEvent => {
  return {
    sessionId,
    type: 'resource',
    time: Date.now(),
    eventId: eventId(),
    insertId,
    action,
    resourceType: type,
    resourceId: resourceId(message),
  };
};

export class EventService {
  private post = (event: Event) =>
    axios
      .post<EventResponse>('https://events.scaffoldly.dev/api/v1/session', event, {
        timeout: 10000,
      })
      .then(() => {})
      .catch(() => {});

  private args?: string[];

  private project?: ProjectJson;

  private sessionId: string | undefined;

  private insertId: string | undefined;

  private event$: Subject<Event> = new Subject();

  // Cli == Command Line Interface
  // Gha == GitHub Action
  // Ale == AWS Lambda Entrypoint
  constructor(private platform: 'Cli' | 'Gha' | 'Ale', private version?: string) {
    if (process.env.SCAFFOLDLY_DNT) {
      return;
    }

    this.event$.subscribe({
      next: (event) => this.post(event),
    });
  }

  get library(): string {
    return `scaffoldly-${this.platform.toLowerCase()}/${this.version}`;
  }

  get userAgent(): string {
    return `${this.library} (${os.platform()}; ${os.arch()}) node/${process.version}`;
  }

  public withSessionId(sessionId: string): EventService {
    this.sessionId = sessionId;
    this.emit();
    return this;
  }

  public withInsertId(object: unknown): EventService {
    this.insertId = resourceId(object);
    this.emit();
    return this;
  }

  public withArgs(args: string[] | Record<string, string | undefined>): EventService {
    this.args = convertArgs(args);
    this.emit();
    return this;
  }

  public withProject(project?: ProjectJson): EventService {
    this.project = project;
    this.emit();
    return this;
  }

  public emitAction(action: NotifyAction, type: string, message: string): void {
    if (this.sessionId && this.insertId) {
      this.event$.next(createResourceEvent(this.sessionId, this.insertId, action, type, message));
    }
  }

  private emit(): void {
    if (this.sessionId && this.insertId && this.args) {
      this.event$.next(
        createSession(
          this.sessionId,
          this.insertId,
          this.platform,
          this.args,
          this.library,
          this.userAgent,
        ),
      );
    }

    if (this.sessionId && this.insertId && this.project) {
      this.event$.next(createProjectEvent(this.sessionId, this.insertId, this.project));
    }
  }
}
