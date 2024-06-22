import WebSocket from 'ws';
import { log } from './log';

function wsify(url?: string | URL): URL | undefined {
  if (!url) return undefined;
  if (typeof url === 'string') url = new URL(url);

  const wsUrl = new URL(url.toString());
  wsUrl.protocol = url.protocol.replace('http', 'ws');

  if (!wsUrl.protocol.startsWith('ws')) {
    return undefined;
  }

  return wsUrl;
}

export class WebsocketProxy {
  private ws?: WebSocket;
  public readonly url?: URL;
  constructor(url?: URL, private route?: string) {
    this.url = wsify(url);
  }

  init() {
    const { url, route, ws } = this;

    if (!url || !route || ws) {
      log('Skipping Websocket Initialization', {
        url,
        route,
        initialized: !!ws,
      });
      return;
    }

    this.ws = new WebSocket(url);
    this.ws.on('open', this.handleOpen.bind(this));
    this.ws.on('message', this.handleMessage.bind(this));
    this.ws.on('error', this.handleError.bind(this));
    this.ws.on('ping', this.handlePing.bind(this));
    this.ws.on('pong', this.handlePong.bind(this));
  }

  send(data: any) {
    log('Sending message', { data });
    if (!this.ws) {
      throw new Error('WebSocket is not initialized');
    }
    this.ws.send(data);
  }

  handleOpen() {
    log('Connected to WebSocket', {
      url: this.url,
      route: this.route,
    });
  }

  handlePing(data: Buffer) {
    log('Received Ping', { data });
  }

  handlePong(data: Buffer) {
    log('Received Pong', { data });
  }

  handleMessage(data: any) {
    log('Received Message', { data });
  }

  handleError(error: Error) {
    log('WebSocket error', { error });
  }
}
