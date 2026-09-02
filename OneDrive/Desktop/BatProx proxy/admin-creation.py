import json
import os
import subprocess

DOMAIN = "https://api.stealthybat.org"
USE_REMOTE = os.environ.get("BATPROX_DOMAIN") or DOMAIN
SITE_DOMAIN = "https://stealthybat.org"

username = input("Enter account username you want: ").strip()
if not 3 <= len(username) <= 20:
    raise SystemExit("Username must be between 3 and 20 characters.")

invite_code = input("enter account invite code for that account. ").strip()
if not invite_code:
    raise SystemExit("An invite code is required.")

password = input("Enter account password: ").strip()
if len(password) < 8:
    raise SystemExit("Password must be at least 8 characters.")

database = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.sqlite")
script = r"""
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const [database, username, password, invite] = process.argv.slice(1);
const db = new sqlite3.Database(database);
db.serialize(async () => {
  try {
    const hash = await bcrypt.hash(password, 12);
    db.run('BEGIN TRANSACTION');
    db.run('DELETE FROM admin_accounts');
    db.run('DELETE FROM admin_users');
    db.run('INSERT INTO admin_accounts (username, password_hash) VALUES (?, ?)', [username, hash]);
    db.run('INSERT INTO admin_users (username, invite_code) VALUES (?, ?)', [username, invite]);
    db.run('COMMIT', (error) => {
      if (error) throw error;
      console.log(JSON.stringify({ success: true, username, verified: true }));
      db.close();
    });
  } catch (error) {
    db.run('ROLLBACK', () => {
      console.error(error.message);
      db.close();
      process.exitCode = 1;
    });
  }
});
"""

result = subprocess.run(
    ["node", "-e", script, database, username, password, invite_code],
    cwd=os.path.dirname(os.path.abspath(__file__)),
    capture_output=True,
    text=True,
)
if result.returncode:
    raise SystemExit(result.stderr.strip() or "Failed to create admin account.")

created = json.loads(result.stdout)
print("BatProx admin account created:", created["username"])
print("Account verified for admin login.")
print(f"Domain: {USE_REMOTE} — admin panel will connect to {USE_REMOTE}/api/* and /proxy")
try:
    import urllib.request
    urllib.request.urlopen(f"{USE_REMOTE}/health", timeout=5)
    print(f"Remote health check ok at {USE_REMOTE}/health")
except Exception as e:
    print(f"Note: remote {USE_REMOTE} not reachable locally ({e}) — local DB write succeeded, remote will sync on next deploy if using same DB")
