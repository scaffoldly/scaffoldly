import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';
import DemoVideo from '../components/DemoVideo';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--dark', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.tagline}
        </Heading>
        <p className="hero__subtitle subtitle">
          Scaffoldly is a <strong>new framework</strong> for{' '}
          <strong>packaging and deploying</strong>&nbsp;applications to AWS.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/about">
            Learn More
          </Link>
          &nbsp;
          <Link className="button button--secondary button--lg" to="/docs/tutorials/nextjs">
            Tutorial
            <small>&nbsp;5min ⏱️</small>
          </Link>
        </div>
        <div className={styles.links}>
          <Link to="https://github.com/scaffoldly/scaffoldly" target="_blank">
            <img
              alt="GitHub Repo stars"
              src="https://img.shields.io/github/stars/scaffoldly/scaffoldly?style=for-the-badge&logo=github&logoColor=%23ffffff&link=https%3A%2F%2Fgithub.com%2Fscaffoldly%2Fscaffoldly"
            />
          </Link>
          &nbsp;
          <Link to="https://discord.gg/7FTY8CPPfZ" target="_blank">
            <img
              alt="Discord"
              src="https://img.shields.io/discord/1288104633465573418?style=for-the-badge&logo=discord&logoColor=%23ffffff&cacheSeconds=30&link=https%3A%2F%2Fdiscord.gg%2F7FTY8CPPfZ"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <DemoVideo />
      </main>
    </Layout>
  );
}
