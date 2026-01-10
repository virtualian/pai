import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'PAI',
  tagline: 'Personal AI Infrastructure',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // GitHub Pages deployment
  url: 'https://virtualian.github.io',
  baseUrl: '/pai/',
  organizationName: 'virtualian',
  projectName: 'pai',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/virtualian/pai/tree/main/website/',
          routeBasePath: '/', // Docs at root, no /docs prefix
        },
        blog: false, // Disable blog
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/pai-social-card.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'PAI',
      logo: {
        alt: 'PAI Logo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'usersSidebar',
          position: 'left',
          label: 'Users',
        },
        {
          type: 'docSidebar',
          sidebarId: 'developersSidebar',
          position: 'left',
          label: 'Developers',
        },
        {
          href: 'https://github.com/virtualian/pai',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Users',
          items: [
            { label: 'Install PAI', to: '/users/how-to/install-pai' },
            { label: 'Skills Reference', to: '/users/reference/skills/core' },
            { label: 'What is PAI?', to: '/users/explanation/what-is-pai' },
          ],
        },
        {
          title: 'Developers',
          items: [
            { label: 'Create a Skill', to: '/developers/how-to/create-a-skill' },
            { label: 'Architecture', to: '/developers/explanation/architecture-overview' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'GitHub', href: 'https://github.com/virtualian/pai' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Ian Marr. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
