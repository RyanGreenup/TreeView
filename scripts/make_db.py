import sqlite3
from sqlite3 import Error


def create_connection(db_file):
    """Create a database connection to a SQLite database"""
    conn = None
    try:
        conn = sqlite3.connect(db_file)
        print(f"Connected to SQLite version {sqlite3.sqlite_version}")
        return conn
    except Error as e:
        print(e)
    return conn


def create_table(conn):
    """Create notes table with parent-child relationships"""
    sql = """
    CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        parent_id TEXT,
        FOREIGN KEY (parent_id) REFERENCES notes (id)
    );
    """
    try:
        c = conn.cursor()
        c.execute(sql)
    except Error as e:
        print(e)


def insert_initial_data(conn):
    """Insert the initial hierarchical data"""
    data = [
        # Root nodes
        ("1", "Documents", None),
        ("2", "Pictures", None),
        ("3", "Videos", None),
        ("4", "Music", None),
        # Documents children
        ("1-1", "Work", "1"),
        ("1-2", "Personal", "1"),
        # Work children
        ("1-1-1", "Project A", "1-1"),
        ("1-1-2", "Project B", "1-1"),
        ("1-1-3", "Meeting Notes", "1-1"),
        # Personal children
        ("1-2-1", "Tax Documents", "1-2"),
        ("1-2-2", "Insurance", "1-2"),
        ("1-2-3", "Receipts", "1-2"),
        # Project B children
        ("1-1-2-1", "Design Files", "1-1-2"),
        ("1-1-2-2", "Code Review", "1-1-2"),
        # Receipts children
        ("1-2-3-1", "2023", "1-2-3"),
        ("1-2-3-2", "2024", "1-2-3"),
        # Pictures children
        ("2-1", "Vacation", "2"),
        ("2-2", "Family", "2"),
        ("2-3", "Screenshots", "2"),
        # Vacation children
        ("2-1-1", "Beach Trip 2023", "2-1"),
        ("2-1-2", "Mountain Hike 2024", "2-1"),
        # Family children
        ("2-2-1", "Birthday Party", "2-2"),
        ("2-2-2", "Christmas 2023", "2-2"),
        # Videos children
        ("3-1", "Tutorials", "3"),
        ("3-2", "Movies", "3"),
        ("3-3", "Personal", "3"),
        # Movies children
        ("3-2-1", "Action", "3-2"),
        ("3-2-2", "Comedy", "3-2"),
        ("3-2-3", "Documentary", "3-2"),
    ]

    sql = "INSERT OR IGNORE INTO notes(id, label, parent_id) VALUES(?, ?, ?)"
    try:
        c = conn.cursor()
        c.executemany(sql, data)
        conn.commit()
    except Error as e:
        print(e)


def main():
    database = "notes.sqlite"

    # Create database connection
    conn = create_connection(database)
    if conn is not None:
        # Create notes table
        create_table(conn)

        # Insert initial data
        insert_initial_data(conn)

        # Close connection
        conn.close()
    else:
        print("Error! Cannot create the database connection.")


if __name__ == "__main__":
    main()
