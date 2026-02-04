<h1 align="center">
  <sup>undici-extra</sup>
  <br>
  <a href="https://github.com/shahradelahi/undici-extra/actions/workflows/ci.yml"><img src="https://github.com/shahradelahi/undici-extra/actions/workflows/ci.yml/badge.svg?branch=main&event=push" alt="CI"></a>
  <a href="https://www.npmjs.com/package/undici-extra"><img src="https://img.shields.io/npm/v/undici-extra.svg" alt="NPM Version"></a>
  <a href="/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat" alt="MIT License"></a>
  <a href="https://bundlephobia.com/package/undici-extra"><img src="https://img.shields.io/bundlephobia/minzip/undici-extra" alt="npm bundle size"></a>
  <a href="https://packagephobia.com/result?p=undici-extra"><img src="https://packagephobia.com/badge?p=undici-extra" alt="Install Size"></a>
</h1>

_undici-extra_ wraps `undici.fetch` to provide an elegant and familiar API while maintaining the high-performance core of [Undici](https://github.com/nodejs/undici).

## Benefits

- **Elegant API:** Method shortcuts (`.post()`, `.put()`) and direct response parsing (`.json()`, `.text()`).
- **Smart Dispatcher:** Automatic handling and caching for Proxies and Unix Sockets.
- **Robust Retries:** Built-in retry logic with exponential backoff and customizable status codes.
- **Request Lifecycle:** Flexible hooks for `beforeRequest`, `afterResponse`, and `beforeRetry`.
- **Advanced Features:** Native support for Request Deduping, Pagination, and NDJSON streaming.
- **Developer Friendly:** Zero-config cURL command logging for easier debugging.

---

- [Benefits](#benefits)
- [Installation](#-installation)
- [Usage](#-usage)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#license)

## 📦 Installation

```bash
npm install undici-extra
```

<details>
<summary>Install using your favorite package manager</summary>

**pnpm**

```bash
pnpm install undici-extra
```

**yarn**

```bash
yarn add undici-extra
```

</details>

## 📖 Usage

### Basic Usage

```ts
import undici from 'undici-extra';

const data = await undici('https://api.example.com/data').json();
```

### JSON

Simplified JSON sending with automatic headers.

```ts
await undici.post('https://api.example.com/users', {
  json: { name: 'John Doe' },
});
```

### Prefix URL

Prepend a base URL to all requests.

```ts
const client = undici.extend({ prefixUrl: 'https://api.example.com/v1' });
const user = await client.get('users/1').json();
```

### Hooks

Lifecycle hooks for modifying requests and responses.

```ts
const client = undici.extend({
  hooks: {
    beforeRequest: [
      (request) => {
        request.headers.set('X-Request-Id', crypto.randomUUID());
      },
    ],
    afterResponse: [
      (request, options, response) => {
        if (response.status === 401) {
          // Handle unauthorized
        }
      },
    ],
  },
});
```

### Automatic Retries

Robust retry logic with exponential backoff.

```ts
await undici('https://api.example.com/retry', {
  retry: {
    limit: 5,
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
});
```

### Proxy & Unix Sockets

Smart dispatcher resolution for proxies and sockets.

```ts
// Proxy
await undici('https://api.example.com', { proxy: 'http://my-proxy:8080' });

// Unix Socket
await undici('http://localhost/info', { unixSocket: '/var/run/docker.sock' });
```

### Pagination

Easily iterate through paginated APIs.

```ts
const items = undici.paginate('https://api.example.com/events', {
  pagination: {
    transform: (res) => res.json().then((data) => data.items),
    paginate: (res) => res.json().then((data) => data.next_page_url),
  },
});

for await (const item of items) {
  console.log(item);
}
```

### NDJSON

Native support for streaming newline-delimited JSON.

```ts
for await (const log of undici('https://api.example.com/logs').ndjson()) {
  console.log(log.level, log.message);
}
```

### Request Deduping

Automatically coalesces concurrent requests to the same endpoint.

```ts
// Only one network request is made
const [r1, r2] = await Promise.all([
  undici('https://api.com/data', { dedup: true }),
  undici('https://api.com/data', { dedup: true }),
]);
```

### Debugging

Log equivalent `curl` commands for easier debugging.

```ts
await undici('https://api.example.com', { debug: true });
// Output: curl -X GET "https://api.example.com"
```

## 📚 Documentation

For all configuration options, please see [the API docs](https://www.jsdocs.io/package/undici-extra).

## 🤝 Contributing

Want to contribute? Awesome! To show your support is to star the project, or to raise issues on [GitHub](https://github.com/shahradelahi/undici-extra).

Thanks again for your support, it is much appreciated! 🙏

## License

[MIT](/LICENSE) © [Shahrad Elahi](https://github.com/shahradelahi) and [contributors](https://github.com/shahradelahi/undici-extra/graphs/contributors).
