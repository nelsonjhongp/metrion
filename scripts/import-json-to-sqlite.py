import json
import sqlite3
import sys
from pathlib import Path


def load_json(base: Path, name: str):
    return json.loads((base / name).read_text(encoding="utf-8"))


def ensure_profile(con: sqlite3.Connection, name: str) -> int:
    con.execute("INSERT OR IGNORE INTO profiles (name) VALUES (?)", (name,))
    return con.execute("SELECT id FROM profiles WHERE name = ?", (name,)).fetchone()[0]


def ensure_business_unit(con: sqlite3.Connection, profile_id: int, name: str) -> int:
    con.execute(
        "INSERT OR IGNORE INTO business_units (profile_id, name, is_active) VALUES (?, ?, 1)",
        (profile_id, name),
    )
    return con.execute(
        "SELECT id FROM business_units WHERE profile_id = ? AND name = ?",
        (profile_id, name),
    ).fetchone()[0]


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: import-json-to-sqlite.py <sqlite-file> <import-dir>", file=sys.stderr)
        return 2

    sqlite_file = Path(sys.argv[1])
    import_dir = Path(sys.argv[2])

    profiles = load_json(import_dir, "profiles.json")
    business_units = load_json(import_dir, "business_units.json")
    suppliers = load_json(import_dir, "suppliers.json")
    purchases = load_json(import_dir, "purchases.json")
    monthly_sales = load_json(import_dir, "monthly_sales.json")

    con = sqlite3.connect(sqlite_file)
    con.execute("PRAGMA foreign_keys = ON")

    inserted_purchases = 0
    skipped_purchases = 0

    try:
        with con:
            profile_id = ensure_profile(con, profiles[0]["name"])
            unit_ids = {
                unit["name"]: ensure_business_unit(con, profile_id, unit["name"])
                for unit in business_units
            }

            for supplier in suppliers:
                con.execute(
                    """
                    INSERT INTO suppliers (profile_id, ruc, name, note)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(profile_id, ruc)
                    DO UPDATE SET
                      name = excluded.name,
                      note = COALESCE(suppliers.note, excluded.note),
                      updated_at = CURRENT_TIMESTAMP
                    """,
                    (profile_id, supplier["ruc"], supplier["name"], supplier.get("note")),
                )

            for purchase in purchases:
                business_unit_id = unit_ids.get(purchase["unit"])
                if not business_unit_id:
                    continue

                supplier_id = None
                if purchase.get("ruc"):
                    row = con.execute(
                        "SELECT id FROM suppliers WHERE profile_id = ? AND ruc = ?",
                        (profile_id, purchase["ruc"]),
                    ).fetchone()
                    supplier_id = row[0] if row else None

                exists = con.execute(
                    """
                    SELECT id
                    FROM purchases
                    WHERE profile_id = ?
                      AND business_unit_id = ?
                      AND period_month = ?
                      AND period_year = ?
                      AND purchase_date = ?
                      AND COALESCE(ruc, '') = COALESCE(?, '')
                      AND supplier_name = ?
                      AND COALESCE(invoice_number, '') = COALESCE(?, '')
                      AND amount = ?
                    """,
                    (
                        profile_id,
                        business_unit_id,
                        purchase["period_month"],
                        purchase["period_year"],
                        purchase["purchase_date"],
                        purchase.get("ruc"),
                        purchase["supplier_name"],
                        purchase.get("invoice_number"),
                        purchase["amount"],
                    ),
                ).fetchone()

                if exists:
                    skipped_purchases += 1
                    continue

                con.execute(
                    """
                    INSERT INTO purchases (
                      profile_id,
                      business_unit_id,
                      supplier_id,
                      period_month,
                      period_year,
                      purchase_date,
                      ruc,
                      supplier_name,
                      invoice_number,
                      amount,
                      payment,
                      note
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        profile_id,
                        business_unit_id,
                        supplier_id,
                        purchase["period_month"],
                        purchase["period_year"],
                        purchase["purchase_date"],
                        purchase.get("ruc"),
                        purchase["supplier_name"],
                        purchase.get("invoice_number"),
                        purchase["amount"],
                        purchase.get("payment"),
                        purchase.get("note"),
                    ),
                )
                inserted_purchases += 1

            for sale in monthly_sales:
                business_unit_id = unit_ids.get(sale["unit"])
                if not business_unit_id:
                    continue

                con.execute(
                    """
                    INSERT INTO monthly_sales (
                      profile_id,
                      business_unit_id,
                      period_month,
                      period_year,
                      total_amount,
                      observation
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(profile_id, business_unit_id, period_month, period_year)
                    DO UPDATE SET
                      total_amount = excluded.total_amount,
                      observation = excluded.observation,
                      updated_at = CURRENT_TIMESTAMP
                    """,
                    (
                        profile_id,
                        business_unit_id,
                        sale["period_month"],
                        sale["period_year"],
                        sale["total_amount"],
                        sale.get("observation"),
                    ),
                )
    finally:
        con.close()

    print(
        json.dumps(
            {
                "insertedPurchases": inserted_purchases,
                "skippedPurchases": skipped_purchases,
                "upsertedSuppliers": len(suppliers),
                "upsertedMonthlySales": len(monthly_sales),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

