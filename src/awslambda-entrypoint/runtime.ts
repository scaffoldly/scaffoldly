import axios from 'axios';
import { RuntimeEvent } from './types';

export const getRuntimeEvent = async (runtimeApi: string): Promise<RuntimeEvent> => {
  const { headers, data: event } = await axios.get(
    `http://${runtimeApi}/2018-06-01/runtime/invocation/next`,
    {
      // block indefinitely until a response is received
      timeout: 0,
      responseType: 'text',
    },
  );

  const requestId = headers['lambda-runtime-aws-request-id'];

  if (!requestId) {
    throw new Error('No request ID found in response headers');
  }

  const deadline = Number.parseInt(headers['lambda-runtime-deadline-ms']);

  if (!event || typeof event !== 'string') {
    throw new Error('No event found in response data');
  }

  return { requestId, event, deadline };
};

export const postRuntimeEventResponse = async (
  runtimeApi: string,
  requestId: string,
  payload: unknown,
): Promise<void> => {
  await axios.post(
    `http://${runtimeApi}/2018-06-01/runtime/invocation/${requestId}/response`,
    payload,
  );
};
