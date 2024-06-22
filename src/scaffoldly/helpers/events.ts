import axios from 'axios';
import packageJson from '../../../package.json';

export const event = (action: string, subAction?: string): void => {
  const dnt = process.env.SCAFFOLDLY_DNT;
  if (dnt) {
    return;
  }

  axios
    .post(`https://eophjr2rod9d8mh.m.pipedream.net`, {
      event: action,
      properties: {
        subAction: subAction,
        version: packageJson.version,
      },
    })
    .then(() => {})
    .catch(() => {});
};
