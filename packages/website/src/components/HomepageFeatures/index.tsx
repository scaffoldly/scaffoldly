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
        The declarative <Link to="/docs/config">configuration</Link> is <strong>simple</strong> and
        in your <code>package.json</code> or predefined{' '}
        <Link to="/docs/config/presets">
          <code>--preset</code>
        </Link>{' '}
        options on the <Link to="/docs/cli">CLI</Link>.
      </>
    ),
  },
  {
    title: 'Simple Deployment',
    description: (
      <>The CLI or GitHub Action generate Dockerfiles and Cloud Resources at deploy time.</>
    ),
  },
  {
    title: 'Cost Effective AWS',
    description: (
      <>
        <strong>Containerized</strong> deployments to <strong>AWS Lambda</strong> and support for
        CDNs allow your application to run at scale with <strong>minimal cost</strong>.
      </>
    ),
  },
];

function Feature({ title, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
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
