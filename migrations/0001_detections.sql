CREATE TABLE IF NOT EXISTS detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    sci_name TEXT NOT NULL,
    com_name TEXT NOT NULL,
    confidence REAL NOT NULL,
    lat REAL,
    lon REAL,
    cutoff REAL,
    week INTEGER,
    sens REAL,
    overlap REAL,
    file_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_detections_date_time
    ON detections (date, time DESC);

CREATE INDEX IF NOT EXISTS idx_detections_sci_name
    ON detections (sci_name);