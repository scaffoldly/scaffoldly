import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Scaffoldly',
  tagline: 'Scaffoldly Framework',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: process.env.PUBLIC_URL || 'http://localhost:3000',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'scaffoldly', // Usually your GitHub org/user name.
  projectName: 'scaffoldly', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          remarkPlugins: [[require('@docusaurus/remark-plugin-npm2yarn'), { sync: true }]],
          rehypePlugins: [],
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/scaffoldly/scaffoldly/tree/main/packages/website/docs/',
        },
        blog: {
          remarkPlugins: [[require('@docusaurus/remark-plugin-npm2yarn'), { sync: true }]],
          rehypePlugins: [],
          showReadingTime: true,
          editUrl: 'https://github.com/scaffoldly/scaffoldly/tree/main/packages/website/blog',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'Scaffoldly',
      logo: {
        alt: 'Scaffoldly Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docSidebar',
          position: 'left',
          label: 'Documentation',
        },
        { to: '/blog', label: 'Blog', position: 'left' },
        {
          href: 'https://github.com/scaffoldly/scaffoldly/discussions',
          label: 'Discussions',
          position: 'right',
        },
        {
          href: 'https://join.slack.com/share/enQtNzc0ODI4NTgxNDQ4MS03MWUwZjAxZWExOWM5YzU0NjU1NjJjYzhkNzhhMzM5MDU5Y2ZhZDM0ZWNjNDNmOTMwZDExZGQwODVhNThhYzkx',
          label: 'Community',
          position: 'right',
        },
        {
          href: 'https://github.com/scaffoldly/scaffoldly',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Documentation',
              to: '/docs',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Stack Overflow',
              href: 'https://stackoverflow.com/questions/tagged/scaffoldly',
            },
            {
              label: 'x.com/scaffoldly',
              href: 'https://x.com/scaffoldly',
            },
            {
              label: 'Discussions',
              href: 'https://github.com/scaffoldly/scaffoldly/discussions',
            },
            {
              label: 'Slack',
              href: 'https://join.slack.com/share/enQtNzc0ODI4NTgxNDQ4MS03MWUwZjAxZWExOWM5YzU0NjU1NjJjYzhkNzhhMzM5MDU5Y2ZhZDM0ZWNjNDNmOTMwZDExZGQwODVhNThhYzkx',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/scaffoldly/scaffoldly',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Scaffoldly, LLC.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
