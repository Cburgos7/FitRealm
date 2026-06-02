jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockAuth = { getSession: jest.fn(), onAuthStateChange: jest.fn() };
const mockClient = { auth: mockAuth };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockClient),
}));

describe('supabase client', () => {
  it('should not be null', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { supabase } = require('../lib/supabase');
    expect(supabase).not.toBeNull();
  });

  it('should have auth property', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { supabase } = require('../lib/supabase');
    expect(supabase.auth).not.toBeNull();
  });
});
