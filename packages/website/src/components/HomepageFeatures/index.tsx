import clsx from 'clsx';
// eslint-disable-next-line import/no-unresolved
import Heading from '@theme/Heading';
import styles from './styles.module.css';
import Link from '@docusaurus/Link';

type FeatureItem = {
  title: string;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Simple Configuration',
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    description: (
      <>
        The declarative{' '}
        <Link to="/docs/config">
          <strong>configuration</strong>
        </Link>{' '}
        is <strong>simple</strong> and in your <code>package.json</code> or predefined{' '}
        <Link to="/docs/config/presets">
          <code>
            <strong>--preset</strong>
          </code>
        </Link>{' '}
        options on the{' '}
        <Link to="/docs/cli">
          <strong>CLI</strong>
        </Link>
        .
      </>
    ),
  },
  {
    title: 'Simple Deployment',
    description: (
      <>
        The{' '}
        <Link to="/docs/cli">
          <strong>CLI</strong>
        </Link>{' '}
        or{' '}
        <Link to="/docs/gha">
          <strong>GitHub Action</strong>
        </Link>{' '}
        generate Dockerfiles and Cloud Resources at deploy time.
      </>
    ),
  },
  {
    title: 'Cost Effective',
    description: (
      <>
        <Link to="docs/cli#dockerfile-command">
          <strong>Containerized</strong>
        </Link>{' '}
        deployments to <strong>AWS Lambda</strong> and support for{' '}
        <Link to="/docs/cloud/cdn">
          <strong>CDNs</strong>
        </Link>{' '}
        allow your application to run at scale with <strong>minimal cost</strong>.
      </>
    ),
  },
  {
    title: '12-Factor Apps',
    description: (
      <>
        Built in support for{' '}
        <Link to="docs/config/environment">
          <strong>Environment Variables</strong>
        </Link>{' '}
        and{' '}
        <Link to="docs/config/secrets">
          <strong>Secrets</strong>
        </Link>{' '}
        allow quick addoption to{' '}
        <Link to="https://12factor.net/" target="_blank">
          <strong>12-Factor Apps</strong>
        </Link>
        .
      </>
    ),
  },
];

function Feature({ title, description }: FeatureItem) {
  return (
    <div className={clsx('col col--3')}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
