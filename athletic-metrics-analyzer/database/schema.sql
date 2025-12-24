-- Athletic Metrics Analyzer Database Schema

CREATE TABLE athletes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    age INTEGER,
    grade INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE metrics (
    id SERIAL PRIMARY KEY,
    athlete_id INTEGER REFERENCES athletes(id) ON DELETE CASCADE,
    dash40 DECIMAL(5,2),
    vertical_jump DECIMAL(5,2),
    broad_jump DECIMAL(5,2),
    pro_agility DECIMAL(5,2),
    l_drill DECIMAL(5,2),
    bench_press DECIMAL(6,2),
    squat DECIMAL(6,2),
    height DECIMAL(5,2),
    weight DECIMAL(5,2),
    body_fat DECIMAL(4,2),
    wingspan DECIMAL(5,2),
    hand_size DECIMAL(4,2),
    custom_measurements JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'athlete',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_metrics_athlete ON metrics(athlete_id);
