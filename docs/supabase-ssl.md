# Supabase SSL enforcement

Keep **Enforce SSL on incoming connections** enabled in Supabase Database Settings.
This controls PostgreSQL and pooler connections. Supabase's HTTP APIs (Auth,
Storage and the Data API) already require HTTPS. Q's main frontend and backend
use those APIs and need no database certificate or connection changes.

## Downloaded certificate

The downloaded file is a CA certificate used to verify the database server.
It is not a password or a client private key. Keep it in a stable folder outside
the repository, for example `C:\Users\Scott\.postgresql\supabase-ca.crt`.
There is no need to import it into Windows' system-wide trust store or the browser.

For a SQL desktop client, select SSL **verify-full** (or its equivalent: verify
the certificate and hostname), and select this file as the **root/CA certificate**.
Use the hostname from the dashboard's Connect panel, not an IP address.

## Q's optional analytics script

`server/scripts/generateAnalyticsReport.ts` is the only direct PostgreSQL client
in Q. Remote connections now require TLS with server certificate verification;
local loopback development connections retain their existing configuration.

Configure the script's process environment:

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@HOST:PORT/postgres'
$env:DATABASE_SSL_CA_FILE = 'C:\Users\Scott\.postgresql\supabase-ca.crt'
```

Replace the connection string with the correct direct or pooler connection from
Supabase. URL-encode special characters in credentials. The script does not
automatically load `.env`; supply these variables to its process. If running on
another machine, place the CA file there and use that machine's absolute path.

The helper also supports `PG_CONNECTION` and the standard pg connection variables.
Without an explicit CA file, remote TLS uses Node's trusted certificate authorities.
An unreadable CA file or an untrusted certificate fails closed; do not disable
verification to work around an error. URL SSL mode flags cannot weaken remote TLS.

The existing migration workflow uses the Supabase CLI's linked connection. Do not
put this certificate in frontend assets or set a `VITE_` certificate variable.
If a CLI connection fails after enforcement, check its SSL support and version
before rerunning a migration; the analytics helper does not configure the CLI.

References: [Supabase SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement)
and [node-postgres SSL configuration](https://node-postgres.com/features/ssl).
