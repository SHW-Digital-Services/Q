import app from '../server.ts';

export default function handler(req: any, res: any) {
  return app(req, res);
}

