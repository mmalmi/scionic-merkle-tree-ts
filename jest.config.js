module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  moduleNameMapper: {
    '^multiformats/(.*)$': '<rootDir>/node_modules/multiformats/dist/src/$1.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(multiformats)/)',
  ],
};
