CREATE TABLE visit_sessions (
  day TEXT NOT NULL,
  session_id TEXT NOT NULL,
  first_seen TEXT NOT NULL,
  PRIMARY KEY (day, session_id)
);
--> statement-breakpoint
CREATE TABLE visit_pages (
  day TEXT NOT NULL,
  page TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, page)
);
