jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  },
}));

describe('useAuthStore', () => {
  it('initial session should be null', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('../store/useAuthStore');
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
  });

  it('initial isLoading should be true', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('../store/useAuthStore');
    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(true);
  });

  it('initialize should be a function', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('../store/useAuthStore');
    const state = useAuthStore.getState();
    expect(typeof state.initialize).toBe('function');
  });
});
