import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  usersSidebar: [
    {
      type: 'doc',
      id: 'users/index',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'How-To',
      collapsed: false,
      items: [
        'users/how-to/install-pai',
        'users/how-to/install-packs',
        'users/how-to/use-the-algorithm',
        'users/how-to/create-custom-agents',
        'users/how-to/automate-browser-tasks',
        'users/how-to/check-for-upgrades',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Skills',
          items: [
            'users/reference/skills/core',
            'users/reference/skills/agents',
            'users/reference/skills/algorithm',
            'users/reference/skills/browser',
            'users/reference/skills/prompting',
            'users/reference/skills/art',
            'users/reference/skills/upgrades',
          ],
        },
        'users/reference/cli-tools',
        'users/reference/packs-catalog',
      ],
    },
    {
      type: 'category',
      label: 'Explanation',
      collapsed: false,
      items: [
        'users/explanation/what-is-pai',
        'users/explanation/skill-system',
        'users/explanation/algorithm-philosophy',
        'users/explanation/effort-classification',
      ],
    },
  ],

  developersSidebar: [
    {
      type: 'doc',
      id: 'developers/index',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'How-To',
      collapsed: false,
      items: [
        'developers/how-to/create-a-skill',
        'developers/how-to/create-a-pack',
        'developers/how-to/add-hooks',
        'developers/how-to/extend-the-algorithm',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: false,
      items: [
        'developers/reference/skill-structure',
        'developers/reference/pack-structure',
        'developers/reference/hook-api',
        'developers/reference/capabilities-registry',
        'developers/reference/memory-system',
      ],
    },
    {
      type: 'category',
      label: 'Explanation',
      collapsed: false,
      items: [
        'developers/explanation/architecture-overview',
        'developers/explanation/cli-first-design',
        'developers/explanation/delegation-system',
        'developers/explanation/security-model',
      ],
    },
  ],
};

export default sidebars;
