import clsx from 'clsx';
// eslint-disable-next-line import/no-unresolved
import Link from '@docusaurus/Link';
// eslint-disable-next-line import/no-unresolved
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
// eslint-disable-next-line import/no-unresolved
import Layout from '@theme/Layout';
// eslint-disable-next-line import/no-unresolved
import HomepageFeatures from '@site/src/components/HomepageFeatures';
// eslint-disable-next-line import/no-unresolved
import Heading from '@theme/Heading';
import * as amplitude from '@amplitude/analytics-browser';

import styles from './index.module.css';
import { useEffect } from 'react';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--dark', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs/tutorials/nextjs">
            Next.js on AWS Lambda Tutorial - 5min ⏱️
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  useEffect(() => {
    amplitude.init('2b55d9164cccff808f518a990c1fefb7');
  });

  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />"
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
