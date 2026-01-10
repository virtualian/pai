import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/users/how-to/install-pai">
            Get Started
          </Link>
          <Link
            className="button button--secondary button--lg"
            style={{marginLeft: '1rem'}}
            to="/users/explanation/what-is-pai">
            Learn More
          </Link>
        </div>
      </div>
    </header>
  );
}

function Feature({title, description, link}: {title: string; description: string; link: string}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="padding-horiz--md padding-vert--lg">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
        <Link to={link}>Learn more →</Link>
      </div>
    </div>
  );
}

function HomepageFeatures() {
  return (
    <section className="padding-vert--xl">
      <div className="container">
        <div className="row">
          <Feature
            title="Skills"
            description="Modular capabilities that extend Claude Code. Install packs to add new powers like browser automation, agent composition, and more."
            link="/users/explanation/skill-system"
          />
          <Feature
            title="THE ALGORITHM"
            description="Universal execution engine using scientific method. Effort classification gates capabilities for optimal resource allocation."
            link="/users/explanation/algorithm-philosophy"
          />
          <Feature
            title="CLI-First Tools"
            description="TypeScript CLIs instead of APIs. Zero token overhead, direct execution, simple debugging."
            link="/developers/explanation/cli-first-design"
          />
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Personal AI Infrastructure"
      description="Extend Claude Code with skills, memory, and orchestration">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
