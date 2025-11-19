// Gamification functionality disabled - tables don't exist
export const gamificationService = {
  getUserBadges: async (userId: string) => {
    return [];
  },
  getUserStats: async (userId: string) => {
    return null;
  }
};
