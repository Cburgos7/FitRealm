/**
 * Manual Jest mock for expo-sqlite.
 *
 * Provides just enough of the API surface used by dayCredits.ts so that
 * unit tests can run without the native module.  The actual database
 * behaviour under test is controlled by the _injectDatabase() test helper.
 */

export const openDatabaseAsync = jest.fn(async (_name: string) => {
  // Returns a stub database. Tests that actually need DB behaviour should
  // call _injectDatabase() in beforeEach with their own in-memory mock.
  return {
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getFirstAsync: jest.fn().mockResolvedValue(null),
  };
});
