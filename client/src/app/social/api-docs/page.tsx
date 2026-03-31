import { ExternalLink, Key, Code2, Shield, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export const metadata = { title: 'API Documentation — SignApps Social' };

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  example: { request?: string; response: string };
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/social/posts',
    description: 'List all posts for the authenticated user',
    params: [
      { name: 'status', type: 'string', required: false, description: 'Filter by status: draft, scheduled, published, failed' },
      { name: 'account_id', type: 'string', required: false, description: 'Filter by social account ID' },
      { name: 'limit', type: 'integer', required: false, description: 'Max results (default 50)' },
    ],
    example: {
      response: JSON.stringify({ data: [{ id: 'post_abc', content: 'Hello World!', status: 'published', published_at: '2026-03-01T09:00:00Z' }] }, null, 2),
    },
  },
  {
    method: 'POST',
    path: '/api/v1/social/posts',
    description: 'Create a new social post',
    params: [
      { name: 'content', type: 'string', required: true, description: 'Post text content' },
      { name: 'account_ids', type: 'string[]', required: true, description: 'Target account IDs' },
      { name: 'scheduled_at', type: 'ISO 8601', required: false, description: 'Schedule the post at this time' },
      { name: 'hashtags', type: 'string[]', required: false, description: 'Hashtags without # prefix' },
      { name: 'media_urls', type: 'string[]', required: false, description: 'Attached image/video URLs' },
    ],
    example: {
      request: JSON.stringify({ content: 'Hello from the API!', account_ids: ['acc_xyz'], scheduled_at: '2026-04-01T09:00:00Z' }, null, 2),
      response: JSON.stringify({ id: 'post_new', status: 'scheduled', scheduled_at: '2026-04-01T09:00:00Z' }, null, 2),
    },
  },
  {
    method: 'GET',
    path: '/api/v1/social/posts/:id',
    description: 'Get a specific post by ID',
    example: {
      response: JSON.stringify({ id: 'post_abc', content: 'Hello!', status: 'published', likes_count: 42, shares_count: 7 }, null, 2),
    },
  },
  {
    method: 'PATCH',
    path: '/api/v1/social/posts/:id',
    description: 'Update a post (only drafts and scheduled posts)',
    params: [
      { name: 'content', type: 'string', required: false, description: 'New post text' },
      { name: 'scheduled_at', type: 'ISO 8601', required: false, description: 'New schedule time' },
    ],
    example: {
      request: JSON.stringify({ content: 'Updated content', scheduled_at: '2026-04-02T10:00:00Z' }, null, 2),
      response: JSON.stringify({ id: 'post_abc', status: 'scheduled' }, null, 2),
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/social/posts/:id',
    description: 'Delete a post',
    example: {
      response: JSON.stringify({ message: 'Post deleted' }, null, 2),
    },
  },
  {
    method: 'GET',
    path: '/api/v1/social/accounts',
    description: 'List connected social accounts',
    example: {
      response: JSON.stringify({ data: [{ id: 'acc_xyz', platform: 'twitter', username: 'yourhandle', is_active: true }] }, null, 2),
    },
  },
  {
    method: 'GET',
    path: '/api/v1/social/analytics/overview',
    description: 'Get analytics overview (followers, engagement, reach)',
    example: {
      response: JSON.stringify({ total_followers: 12400, engagement_rate: 3.2, total_reach: 48000, posts_this_week: 7 }, null, 2),
    },
  },
  {
    method: 'GET',
    path: '/api/v1/social/inbox',
    description: 'Get inbox items (mentions, comments, DMs)',
    params: [
      { name: 'platform', type: 'string', required: false, description: 'Filter by platform' },
      { name: 'type', type: 'string', required: false, description: 'mention | comment | dm' },
      { name: 'unread_only', type: 'boolean', required: false, description: 'Only return unread items' },
    ],
    example: {
      response: JSON.stringify({ data: [{ id: 'inbox_1', type: 'mention', content: '@you great post!', author_name: 'user123', is_read: false }] }, null, 2),
    },
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  POST: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  PATCH: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const JS_EXAMPLE = `const response = await fetch('https://app.signapps.io/api/v1/social/posts', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: 'Hello from the API! 🚀',
    account_ids: ['acc_xyz'],
    scheduled_at: '2026-04-01T09:00:00Z',
  }),
});
const post = await response.json();
console.log(post.id);`;

const PYTHON_EXAMPLE = `import requests

response = requests.post(
    'https://app.signapps.io/api/v1/social/posts',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'content': 'Hello from the API! 🚀',
        'account_ids': ['acc_xyz'],
        'scheduled_at': '2026-04-01T09:00:00Z',
    }
)
print(response.json())`;

const CURL_EXAMPLE = `curl -X POST https://app.signapps.io/api/v1/social/posts \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Hello from the API! 🚀",
    "account_ids": ["acc_xyz"],
    "scheduled_at": "2026-04-01T09:00:00Z"
  }'`;

export default function ApiDocsPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">SignApps Social API</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Programmatic access to your social media management. Create posts, fetch analytics, manage accounts.
        </p>
        <div className="flex items-center gap-3 mt-4">
          <Badge variant="secondary">v1</Badge>
          <Badge variant="outline">Base URL: /api/v1</Badge>
          <a
            href="/social/settings/api-keys"
            className="flex items-center gap-1 text-sm text-primary underline underline-offset-2"
          >
            <Key className="w-3.5 h-3.5" />
            Generate API Key
          </a>
        </div>
      </div>

      {/* Authentication */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" />
            Authentication — OAuth 2.0 / API Key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>All API requests must include an <strong>Authorization</strong> header:</p>
          <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto font-mono">
            {`Authorization: Bearer YOUR_API_KEY`}
          </pre>

          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">OAuth 2.0 Flow</h3>
            <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
              <li>
                Register your app at{' '}
                <Link href="/social/settings/api-keys" className="text-primary underline">
                  Settings → API Keys
                </Link>
              </li>
              <li>
                Redirect user to:{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  /oauth/authorize?client_id=CLIENT_ID&redirect_uri=CALLBACK_URL&response_type=code&scope=social:read+social:write
                </code>
              </li>
              <li>User authenticates and approves access</li>
              <li>
                Exchange code for token:{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  POST /oauth/token
                </code>
              </li>
              <li>Use the access token in the Authorization header</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Scopes</h3>
            <div className="space-y-1 text-muted-foreground">
              <div className="flex gap-2">
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">social:read</code>
                <span>Read posts, analytics, inbox</span>
              </div>
              <div className="flex gap-2">
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">social:write</code>
                <span>Create, update, delete posts</span>
              </div>
              <div className="flex gap-2">
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">accounts:read</code>
                <span>List connected social accounts</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Endpoints
        </h2>

        {ENDPOINTS.map((ep, i) => (
          <Card key={i}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold font-mono ${METHOD_COLORS[ep.method]}`}>
                  {ep.method}
                </span>
                <code className="font-mono text-sm font-semibold">{ep.path}</code>
              </div>
              <p className="text-sm text-muted-foreground">{ep.description}</p>

              {ep.params && ep.params.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1.5 pr-3">Parameter</th>
                        <th className="text-left py-1.5 pr-3">Type</th>
                        <th className="text-left py-1.5 pr-3">Required</th>
                        <th className="text-left py-1.5">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ep.params.map((p) => (
                        <tr key={p.name} className="border-b last:border-0">
                          <td className="py-1.5 pr-3 font-mono font-medium">{p.name}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{p.type}</td>
                          <td className="py-1.5 pr-3">
                            {p.required ? (
                              <span className="text-red-500">required</span>
                            ) : (
                              <span className="text-muted-foreground">optional</span>
                            )}
                          </td>
                          <td className="py-1.5 text-muted-foreground">{p.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ep.example.request && (
                  <div>
                    <p className="text-xs font-medium mb-1">Request body</p>
                    <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto font-mono">{ep.example.request}</pre>
                  </div>
                )}
                <div className={ep.example.request ? '' : 'md:col-span-2'}>
                  <p className="text-xs font-medium mb-1">Response</p>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto font-mono">{ep.example.response}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Code examples */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Code2 className="w-5 h-5 text-blue-500" />
          Code Examples — Create Post
        </h2>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">JavaScript / TypeScript</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono">{JS_EXAMPLE}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Python</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono">{PYTHON_EXAMPLE}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">cURL</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono">{CURL_EXAMPLE}</pre>
          </CardContent>
        </Card>
      </div>

      {/* Rate limits */}
      <Card>
        <CardContent className="pt-4 text-sm space-y-2">
          <h3 className="font-semibold">Rate Limits</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>100 requests / minute per API key</li>
            <li>1000 posts / day (applies to POST /posts)</li>
            <li>Rate limit headers: <code className="bg-muted px-1 rounded text-xs">X-RateLimit-Remaining</code>, <code className="bg-muted px-1 rounded text-xs">X-RateLimit-Reset</code></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
