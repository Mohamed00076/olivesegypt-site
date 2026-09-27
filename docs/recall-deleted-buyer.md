# Recalling a deleted buyer

The CRM has two ways to remove a buyer. They were decided by the owner on
2026-09-27 (outstanding item 12 in `deployment-record.md`).

| On the buyer page | Use it when | What happens | Can it be recalled? |
|---|---|---|---|
| **Delete** | Staff decide the record is no longer needed: a test, a lost lead, a duplicate | The buyer disappears from every CRM page. It stays in the database. | **Yes**, with this guide |
| **Erase (deletion request)** | The person asked for their data to be deleted, as `/privacy` allows | The buyer, its notes, its stage history and the website enquiries linked to it are removed from the database | **No.** Nothing is kept to recall. |

After a Delete, opening the buyer in the CRM shows only that it was deleted
and when. Everything else is recalled from the database with the queries
below.

## Where to run these

In the Neon console, open the project's **SQL Editor** on the production
database. Run one query at a time. Replace `12` with the buyer's id.

The id is in the address of the buyer's page (`/crm/buyer/?id=12`). If you
don't have it, query 1 lists every deleted buyer with its id.

Reading data here is **not** written to the CRM's audit log. The CRM records
every time a buyer page is read, but the SQL Editor does not. Query 4 writes
its own audit entry.

## 1. List the deleted buyers

```sql
SELECT id, company_name, contact_name, contact_email, deleted_at
FROM buyers
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;
```

## 2. See one in full

```sql
SELECT * FROM buyers WHERE id = 12;
```

## 3. See its notes and stage history

The first note on a buyer added from a website enquiry holds a copy of the
original message.

```sql
SELECT created_at, created_by, entry
FROM buyer_activity_log
WHERE buyer_id = 12
ORDER BY created_at;

SELECT changed_at, from_stage, to_stage, changed_by
FROM buyer_stage_history
WHERE buyer_id = 12
ORDER BY changed_at;
```

## 4. Put it back in the CRM

This undoes a Delete. The buyer reappears in the buyer list, the Kanban board
and the dashboard, with its notes, history and documents. The same statement
records the restore in the CRM's audit log.

```sql
WITH restored AS (
  UPDATE buyers SET deleted_at = NULL, updated_at = now()
  WHERE id = 12 AND deleted_at IS NOT NULL
  RETURNING id
)
INSERT INTO crm_audit_log (actor, action, record_type, record_id, details)
SELECT 'owner (Neon SQL Editor)', 'restore', 'buyer', id, 'restored after delete'
FROM restored
RETURNING record_id;
```

If it returns no row, that buyer was not deleted, was erased, or never
existed.

## What cannot be recalled

- **An erased buyer.** Erase removes the rows; nothing is kept.
- **An enquiry or request deleted from the Enquiries page.** That delete is
  also permanent (Deploy 49).

In both cases the audit log keeps who did it and when, and never the
person's details.
