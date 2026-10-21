export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'task-reference': ({ header }) => [
          /\[(?:FR-\d+|[A-Z][A-Z0-9]*-\d+)\]$/.test(header),
          'End the header with a real Jira key or local task ID, e.g. [SETUP-001]',
        ],
      },
    },
  ],
  rules: {
    'scope-enum': [2, 'always', ['web', 'api', 'ai', 'db', 'shared', 'ci', 'docs', 'deps']],
    'header-max-length': [2, 'always', 72],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'task-reference': [2, 'always'],
  },
};
