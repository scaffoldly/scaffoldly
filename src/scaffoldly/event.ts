import os from 'os';
import { v5 as uuidv5, v4 as uuidv4 } from 'uuid';
import urlJoin from 'url-join';
import { URLSearchParams } from 'url';
import { IScaffoldlyConfig, ScaffoldlyConfig } from '../config';
import { Subject } from 'rxjs';
import axios from 'axios';
import { onExit } from 'signal-exit';

export type AmplitudeEvent = {
  api_key: string;
  events: (Session | SessionEvent)[];
  options: Record<string, never>;
  client_upload_time: string;
};

export type Session = {
  device_id: string;
  session_id: number;
  time: number;
  platform: string;
  language: string;
  ip: string;
  insert_id: string;
  event_type: string;
  event_id: number;
  library: string;
  user_agent: string;
};

export type SessionEvent = Session & {
  event_type: '[Amplitude] Page Viewed';
  event_properties: {
    [key: string]: string;
  };
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

// eslint-disable-next-line @typescript-eslint/naming-convention
let _eventId = -1;

const eventId = () => {
  return (_eventId += 1);
};

const createSession = (
  platform: 'Cli' | 'Gha' | 'Ale',
  sessionId: number,
  library: string,
  userAgent: string,
): Session | undefined => {
  if (process.env.SCAFFOLDLY_DNT) {
    return undefined;
  }

  const now = Date.now();

  return {
    device_id: deviceId(),
    session_id: sessionId,
    time: now,
    platform,
    language: 'en-US',
    ip: '$remote',
    insert_id: uuidv4(),
    event_type: 'session_start',
    event_id: eventId(),
    library,
    user_agent: userAgent,
  };
};

const argsToUrl = (session: Session, argv: string[] | Record<string, string | undefined>): URL => {
  const pathParts: string[] = [];
  const params = new URLSearchParams();

  if (!Array.isArray(argv)) {
    argv = Object.entries(argv).reduce((acc, [key, value]) => {
      if (!value) {
        return acc;
      }
      acc.push(`--${key}=${value}`);
      return acc;
    }, [] as string[]);
  }

  argv.forEach((arg) => {
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

  const url = new URL(
    urlJoin(`https://${session.platform.toLowerCase()}.scaffoldly.dev`, ...pathParts),
  );
  url.search = params.toString();

  return url;
};

const createSessionEvent = (
  session: Session | undefined,
  config: Partial<IScaffoldlyConfig>,
  args: string[] | Record<string, string | undefined>,
): SessionEvent | undefined => {
  if (!session) {
    return undefined;
  }

  const url = argsToUrl(session, args);

  return {
    ...session,
    event_id: eventId(),
    insert_id: uuidv4(),
    event_type: '[Amplitude] Page Viewed',
    event_properties: {
      '[Amplitude] Page Domain': url.host,
      '[Amplitude] Page Location': `${url.origin}${url.pathname}`,
      '[Amplitude] Page Path': url.pathname,
      '[Amplitude] Page Title': `${session.platform} | ${url.pathname
        .slice(1)
        .split('/')
        .join('|')}`,
      '[Amplitude] Page URL': url.toString(),
      ...Object.entries(config).reduce((acc, [key, value]) => {
        if (typeof value === 'string') {
          return {
            ...acc,
            [`[Scaffoldly] ${key}`]: value,
          };
        } else {
          return {
            ...acc,
            [`[Scaffoldly] ${key}`]: JSON.stringify(value),
          };
        }
      }, {} as { [key: string]: string }),
    },
  };
};

export class EventService {
  private session: Session | undefined;

  private args?: string[] | Record<string, string | undefined>;

  private config?: Partial<IScaffoldlyConfig>;

  private event$: Subject<AmplitudeEvent> = new Subject();

  // Cli == Command Line Interface
  // Gha == GitHub Action
  // Ale == AWS Lambda Entrypoint
  constructor(private platform: 'Cli' | 'Gha' | 'Ale', private version?: string, autoEnd = true) {
    this.event$.subscribe(async (event) => {
      axios
        .post('https://api.amplitude.com/2/httpapi', event, { timeout: 1000 })
        .then(() => {})
        .catch(() => {});
    });

    if (autoEnd) {
      onExit(() => {
        this.end();
      });
    }
  }

  get library(): string {
    return `scaffoldly-${this.platform.toLowerCase()}/${this.version}`;
  }

  get userAgent(): string {
    return `${this.library} (${os.platform()}; ${os.arch()}) node/${process.version}`;
  }

  get sessionId(): number | undefined {
    return this.session?.session_id;
  }

  public withSessionId(sessionId?: number): EventService {
    let emit = false;

    if (!sessionId) {
      // Only emit if a session ID was created
      sessionId = Date.now();
      emit = true;
    }

    this.session = createSession(this.platform, sessionId, this.library, this.userAgent);

    if (emit) {
      this.emit(this.session);
    }

    return this;
  }

  public withArgs(args: string[] | Record<string, string | undefined>): EventService {
    this.args = args;
    this.emit();
    return this;
  }

  public withConfig(config: ScaffoldlyConfig): EventService {
    this.config = config.scaffoldly;
    this.emit();
    return this;
  }

  public end(): void {
    if (this.session) {
      this.emit({
        ...this.session,
        event_type: 'session_end',
        event_id: eventId(),
        insert_id: uuidv4(),
      });
      this.session = undefined;
    }
  }

  public emit(payload?: Session | SessionEvent): void {
    if (!this.session) {
      return;
    }

    if (!payload && this.args && this.config) {
      payload = createSessionEvent(this.session, this.config, this.args);
      return this.emit(payload);
    }

    if (payload) {
      this.event$.next({
        api_key: 'e8773fe68449dee5d1097aef9dd2b278',
        events: [payload],
        options: {},
        client_upload_time: new Date().toISOString(),
      });
    }
  }
}
