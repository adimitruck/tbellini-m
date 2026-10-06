// Reserved edge service boundary; no archive data or credentials are exposed here.
const worker = {
  async fetch(request) {
    if (new URL(request.url).pathname === '/health' && request.method === 'GET') {
      return Response.json({ service: 'tbellini-m-edge', status: 'ok' }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return new Response('Not found', { status: 404 });
  },
};

export default worker;
