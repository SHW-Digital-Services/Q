import { APIRequestContext } from '@playwright/test';

export class ApiHelper {
  constructor(
    private request: APIRequestContext
  ) {}

  async get(
    endpoint: string
  ) {
    return await this.request.get(
      endpoint
    );
  }

  async post(
    endpoint: string,
    data: unknown
  ) {
    return await this.request.post(
      endpoint,
      {
        data
      }
    );
  }

  async delete(
    endpoint: string
  ) {
    return await this.request.delete(
      endpoint
    );
  }
}