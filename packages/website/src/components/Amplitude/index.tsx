import { useEffect } from 'react';
import * as amplitude from '@amplitude/analytics-browser';

export default function Amplitude(): JSX.Element {
  useEffect(() => {
    amplitude.init('e8773fe68449dee5d1097aef9dd2b278', { autocapture: true });
    console.log('Initialized Amplitude!');
  });
  return <></>;
}
