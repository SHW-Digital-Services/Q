export class SupabaseHelper {
  static async createTestUser(email: string, _password: string) {
    console.log(`Create user ${email}`);
  }

  static async deleteTestUser(email: string) {
    console.log(`Delete user ${email}`);
  }

  static async resetUserData(email: string) {
    console.log(`Reset data for ${email}`);
  }
}

