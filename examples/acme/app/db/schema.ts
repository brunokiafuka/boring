import type { Database } from "@boring-dev/node";

export function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      org_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      billing_email TEXT NOT NULL,
      plan TEXT NOT NULL,
      mrr INTEGER NOT NULL,
      synced_at TEXT
    );
  `);
  if (db.get("SELECT 1 FROM users LIMIT 1")) return;

  const users = [
    ["ada", "Ada Okafor", "admin", "acme"],
    ["vik", "Vik Rao", "viewer", "acme"],
    ["oz", "Oz Lindqvist", "admin", "globex"],
  ];
  for (const user of users) db.run("INSERT INTO users VALUES (?, ?, ?, ?)", ...user);

  const customers: [string, string, string, string, string, number][] = [
    ["c_101", "acme", "Northwind Traders", "billing@northwind.example", "scale", 4200],
    ["c_102", "acme", "Halcyon Labs", "accounts@halcyon.example", "team", 890],
    ["c_103", "acme", "Pemberton & Co", "finance@pemberton.example", "team", 640],
    ["c_104", "acme", "Quarry Street Bakery", "hello@quarrystreet.example", "starter", 49],
    ["c_105", "acme", "Tidewater Freight", "ap@tidewater.example", "scale", 3100],
    ["c_106", "acme", "Lumen Optics", "billing@lumen.example", "starter", 79],
    ["c_201", "globex", "Marrow Analytics", "pay@marrow.example", "team", 720],
    ["c_202", "globex", "Birch & Vale", "accounts@birchvale.example", "scale", 2650],
  ];
  for (const customer of customers)
    db.run("INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, NULL)", ...customer);
}
