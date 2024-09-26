import clsx from 'clsx';
import styles from './styles.module.css';
import ReactPlayer from 'react-player';
// eslint-disable-next-line import/no-unresolved
import demoUrl from './sly-deploy-1920x695.mp4';

export default function DemoVideo(): JSX.Element {
  return (
    <section className={styles.videoSection}>
      <div className="container">
        <div className="row">
          <div className={clsx('col col--12')}>
            <ReactPlayer
              className={styles.reactPlayer}
              url={demoUrl}
              playing={true}
              loop={true}
              muted={true}
              width="100%"
              height="100%"
            ></ReactPlayer>
          </div>
        </div>
      </div>
    </section>
  );
}
