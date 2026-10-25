-- 007_mcp_oauth.sql — OAuth 2.1 for the MCP server.
--
-- Lets an MCP client (claude.ai, ChatGPT, a coding agent) connect to a user's
-- account without a pasted API key. The access token is a short-lived JWT signed
-- by this server; the refresh token is an opaque value stored hashed. Both
-- resolve to the same user_id as an API key, so /mcp does not care which
-- credential arrived.

CREATE TABLE oauth_clients (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id                TEXT    NOT NULL UNIQUE,
  client_secret_hash       TEXT,                 -- sha256(pepper+secret); null for public clients
  client_name              TEXT    NOT NULL,
  redirect_uris            TEXT    NOT NULL,     -- JSON array of allowed redirect URIs
  grant_types              TEXT    NOT NULL DEFAULT '["authorization_code","refresh_token"]',
  response_types           TEXT    NOT NULL DEFAULT '["code"]',
  scope                    TEXT,
  token_endpoint_auth_method TEXT  NOT NULL DEFAULT 'none',  -- 'none' (PKCE public) or 'client_secret_post'
  created_at               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE oauth_authorization_codes (
  code                   TEXT    PRIMARY KEY,
  client_id              TEXT    NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri           TEXT    NOT NULL,
  scope                  TEXT,
  code_challenge         TEXT    NOT NULL,
  code_challenge_method  TEXT    NOT NULL DEFAULT 'S256',
  expires_at             TEXT    NOT NULL,
  consumed_at            TEXT,
  created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE oauth_refresh_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash  TEXT    NOT NULL UNIQUE,
  client_id   TEXT    NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope       TEXT,
  expires_at  TEXT    NOT NULL,
  revoked_at  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_oauth_codes_client  ON oauth_authorization_codes(client_id);
CREATE INDEX idx_oauth_codes_user    ON oauth_authorization_codes(user_id);
CREATE INDEX idx_oauth_refresh_user  ON oauth_refresh_tokens(user_id);
CREATE INDEX idx_oauth_refresh_client ON oauth_refresh_tokens(client_id);
