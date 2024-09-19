import React from 'react';
import Amplitude from '@site/src/components/Amplitude';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function Root({ children }): JSX.Element {
  return (
    <>
      <Amplitude />
      {children}
    </>
  );
}
