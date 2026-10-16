from flask import Flask, render_template, request, jsonify
import sqlite3
from pathlib import Path

app = Flask(__name__)
DB = Path(__file__).parent / "tasks.db"

CATEGORIES = ("Assigned", "Accepted", "Review")
STATUSES = ("Pending", "Completed")
PRIORITIES = ("Low", "Medium", "High")


def connect_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with connect_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                deadline TEXT DEFAULT '',
                status TEXT DEFAULT 'Pending',
                priority TEXT DEFAULT 'Medium'
            )
        """)
        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(tasks)")
        }
        if "category" not in columns:
            conn.execute(
                "ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT 'Assigned'"
            )
        if "created_by" not in columns:
            conn.execute(
                "ALTER TABLE tasks ADD COLUMN created_by TEXT DEFAULT 'Admin'"
            )


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    category = request.args.get("category", "")
    status = request.args.get("status", "")
    deadline = request.args.get("deadline", "")
    query = "SELECT * FROM tasks WHERE 1=1"
    params = []

    if category in CATEGORIES:
        query += " AND category=?"
        params.append(category)
    if status in STATUSES:
        query += " AND status=?"
        params.append(status)
    if deadline:
        query += " AND deadline=?"
        params.append(deadline)

    query += " ORDER BY id DESC"
    with connect_db() as conn:
        tasks = conn.execute(query, params).fetchall()
    return jsonify([dict(task) for task in tasks])


@app.route("/api/tasks", methods=["POST"])
def add_task():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    category = data.get("category", "Assigned")
    priority = data.get("priority", "Medium")

    if not title:
        return jsonify({"error": "Task title is required"}), 400
    if category not in CATEGORIES or priority not in PRIORITIES:
        return jsonify({"error": "Invalid category or priority"}), 400

    with connect_db() as conn:
        cursor = conn.execute("""
            INSERT INTO tasks
            (title, description, deadline, priority, category, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            title, data.get("description", ""), data.get("deadline", ""),
            priority, category, "Admin"
        ))
        task = conn.execute(
            "SELECT * FROM tasks WHERE id=?", (cursor.lastrowid,)
        ).fetchone()
    return jsonify(dict(task)), 201


@app.route("/api/tasks/<int:task_id>", methods=["PATCH", "PUT"])
def update_task(task_id):
    data = request.get_json(silent=True) or {}
    with connect_db() as conn:
        task = conn.execute(
            "SELECT * FROM tasks WHERE id=?", (task_id,)
        ).fetchone()
        if task is None:
            return jsonify({"error": "Task not found"}), 404

        old = dict(task)
        title = str(data.get("title", old["title"])).strip()
        description = data.get("description", old["description"])
        deadline = data.get("deadline", old["deadline"])
        status = data.get("status", old["status"])
        priority = data.get("priority", old["priority"])
        category = data.get("category", old["category"])

        if not title:
            return jsonify({"error": "Task title is required"}), 400
        if status not in STATUSES:
            return jsonify({"error": "Invalid status"}), 400
        if priority not in PRIORITIES or category not in CATEGORIES:
            return jsonify({"error": "Invalid priority or category"}), 400

        conn.execute("""
            UPDATE tasks SET title=?, description=?, deadline=?,
            status=?, priority=?, category=? WHERE id=?
        """, (
            title, description, deadline, status,
            priority, category, task_id
        ))
        updated = conn.execute(
            "SELECT * FROM tasks WHERE id=?", (task_id,)
        ).fetchone()
    return jsonify(dict(updated))


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    with connect_db() as conn:
        cursor = conn.execute(
            "DELETE FROM tasks WHERE id=?", (task_id,)
        )
        if cursor.rowcount == 0:
            return jsonify({"error": "Task not found"}), 404
    return jsonify({"message": "Task deleted successfully"})


init_db()

if __name__ == "__main__":
    app.run(debug=False)