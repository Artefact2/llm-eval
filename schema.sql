PRAGMA journal_mode = WAL;

BEGIN;

CREATE TABLE prompts (
prompt_id INTEGER NOT NULL,
prompt TEXT NOT NULL,
PRIMARY KEY(prompt_id)
);

CREATE TABLE models (
model_id INTEGER NOT NULL,
model_name TEXT NOT NULL,
PRIMARY KEY(model_id),
UNIQUE(model_name)
);

CREATE TABLE answers (
prompt_id INTEGER NOT NULL,
model_id INTEGER NOT NULL,
answer TEXT NOT NULL,
PRIMARY KEY(prompt_id, model_id),
FOREIGN KEY(model_id) REFERENCES models(model_id),
FOREIGN KEY(prompt_id) REFERENCES prompts(prompt_id)
);

CREATE TABLE sessions (
session_id INTEGER NOT NULL,
ip_addr TEXT NOT NULL,
user_agent TEXT NOT NULL,
timestamp INTEGER NOT NULL,
PRIMARY KEY(session_id)
);

CREATE INDEX sessions_ip_addr_user_agent ON sessions(ip_addr, user_agent);

CREATE TABLE voted_answers (
session_id INTEGER NOT NULL,
prompt_id INTEGER NOT NULL,
model_id INTEGER NOT NULL,
PRIMARY KEY(session_id, prompt_id, model_id),
FOREIGN KEY(session_id) REFERENCES sessions(session_id),
FOREIGN KEY(model_id, prompt_id) REFERENCES answers(model_id, prompt_id)
) WITHOUT ROWID;

CREATE TABLE votes (
session_id INTEGER NOT NULL,
prompt_id INTEGER NOT NULL,
model_id_a INTEGER NOT NULL,
model_id_b INTEGER NOT NULL,
vote INTEGER NOT NULL,
timestamp INTEGER NOT NULL,
PRIMARY KEY(session_id, prompt_id, model_id_a, model_id_b),
FOREIGN KEY(session_id, prompt_id, model_id_a) REFERENCES voted_answers(session_id, prompt_id, model_id),
FOREIGN KEY(session_id, prompt_id, model_id_b) REFERENCES voted_answers(session_id, prompt_id, model_id),
CHECK(vote IN(-1, 0, 1)),
CHECK(model_id_a < model_id_b)
) WITHOUT ROWID;

CREATE INDEX votes_models_ab_session_id ON votes(session_id, model_id_a, model_id_b, vote);
CREATE INDEX votes_models_ab_prompt_id ON votes(model_id_a, model_id_b, prompt_id, vote);

CREATE VIEW results_per_session AS
SELECT session_id, model_id_a, model_id_b, SUM(vote) AS s_votes, COUNT(vote) AS n_votes
FROM votes
GROUP BY session_id, model_id_a, model_id_b;

CREATE TABLE results_per_prompt (
model_id_a INTEGER NOT NULL,
model_id_b INTEGER NOT NULL,
prompt_id INTEGER NOT NULL,
median_vote INTEGER,
n_votes INTEGER NOT NULL,
PRIMARY KEY(model_id_a, model_id_b, prompt_id),
FOREIGN KEY(model_id_a) REFERENCES models(model_id),
FOREIGN KEY(model_id_b) REFERENCES models(model_id),
FOREIGN KEY(prompt_id) REFERENCES prompts(prompt_id),
CHECK(model_id_a < model_id_b)
) WITHOUT ROWID;

CREATE INDEX results_per_prompt_n_votes_idx ON results_per_prompt(model_id_a, model_id_b, n_votes);

CREATE VIEW voting_pairs AS
SELECT sessions.session_id, rpp.prompt_id, rpp.model_id_a, rpp.model_id_b, p.prompt, aa.answer AS answer_a, ab.answer AS answer_b
FROM sessions
JOIN results_per_prompt AS rpp
LEFT JOIN voted_answers AS va ON va.model_id = rpp.model_id_a AND va.prompt_id = rpp.prompt_id AND va.session_id = sessions.session_id
LEFT JOIN voted_answers AS vb ON vb.model_id = rpp.model_id_b AND vb.prompt_id = rpp.prompt_id AND vb.session_id = sessions.session_id
CROSS JOIN answers AS aa ON rpp.model_id_a = aa.model_id AND rpp.prompt_id = aa.prompt_id
CROSS JOIN answers AS ab ON rpp.model_id_b = ab.model_id AND rpp.prompt_id = ab.prompt_id
CROSS JOIN prompts AS p ON p.prompt_id = rpp.prompt_id
WHERE va.model_id IS NULL AND vb.model_id IS NULL
ORDER BY n_votes, random();


CREATE TABLE results_agg (
model_id_a INTEGER NOT NULL,
model_id_b INTEGER NOT NULL,
s_votes INTEGER NOT NULL,
n_votes INTEGER NOT NULL,
PRIMARY KEY(model_id_a, model_id_b),
FOREIGN KEY(model_id_a) REFERENCES models(model_id),
FOREIGN KEY(model_id_b) REFERENCES models(model_id),
CHECK(model_id_a < model_id_b)
) WITHOUT ROWID;

CREATE INDEX results_agg_n_votes_idx ON results_agg(n_votes);

CREATE TRIGGER vote_insert AFTER INSERT ON votes BEGIN
INSERT OR REPLACE INTO results_per_prompt(model_id_a, model_id_b, prompt_id, median_vote, n_votes)
SELECT new.model_id_a, new.model_id_b, new.prompt_id, vote,
(SELECT COUNT(*) FROM votes WHERE model_id_a = new.model_id_a AND model_id_b = new.model_id_b AND prompt_id = new.prompt_id)
FROM votes
WHERE model_id_a = new.model_id_a AND model_id_b = new.model_id_b AND prompt_id = new.prompt_id
ORDER BY vote ASC
LIMIT 1 OFFSET CAST(0.5 * (SELECT COUNT(*) FROM votes WHERE model_id_a = new.model_id_a AND model_id_b = new.model_id_b AND prompt_id = new.prompt_id) AS INTEGER);
INSERT OR REPLACE INTO results_agg(model_id_a, model_id_b, s_votes, n_votes)
SELECT model_id_a, model_id_b, SUM(median_vote), COUNT(median_vote)
FROM results_per_prompt
WHERE model_id_a = new.model_id_a AND model_id_b = new.model_id_b
GROUP BY model_id_a, model_id_b;
END;

CREATE TRIGGER vote_delete AFTER DELETE ON votes BEGIN
DELETE FROM results_per_prompt WHERE model_id_a = new.model_id_a AND model_id_b = new.model_id_b AND prompt_id = new.prompt_id;
INSERT OR REPLACE INTO results_per_prompt(model_id_a, model_id_b, prompt_id, median_vote, n_votes)
SELECT new.model_id_a, new.model_id_b, new.prompt_id, vote,
(SELECT COUNT(*) FROM votes WHERE model_id_a = new.model_id_a AND model_id_b = new.model_id_b AND prompt_id = new.prompt_id)
FROM votes
WHERE model_id_a = new.model_id_a AND model_id_b = new.model_id_b AND prompt_id = new.prompt_id
ORDER BY vote ASC
LIMIT 1 OFFSET CAST(0.5 * (SELECT COUNT(*) FROM votes WHERE model_id_a = new.model_id_a AND model_id_b = new.model_id_b AND prompt_id = new.prompt_id) AS INTEGER);
INSERT OR REPLACE INTO results_agg(model_id_a, model_id_b, s_votes, n_votes)
SELECT model_id_a, model_id_b, SUM(median_vote), COUNT(median_vote)
FROM results_per_prompt
WHERE model_id_a = old.model_id_a AND model_id_b = old.model_id_b
GROUP BY model_id_a, model_id_b;
END;

CREATE TRIGGER vote_update AFTER UPDATE ON votes BEGIN
INSERT OR REPLACE INTO results_per_prompt(model_id_a, model_id_b, prompt_id, median_vote, n_votes)
SELECT new.model_id_a, new.model_id_b, new.prompt_id, vote,
(SELECT COUNT(*) FROM votes WHERE model_id_a = new.model_id_a AND model_id_b = new.model_id_b AND prompt_id = new.prompt_id)
FROM votes
WHERE model_id_a = new.model_id_a AND model_id_b = new.model_id_b AND prompt_id = new.prompt_id
ORDER BY vote ASC
LIMIT 1 OFFSET CAST(0.5 * (SELECT COUNT(*) FROM votes WHERE model_id_a = new.model_id_a AND model_id_b = new.model_id_b AND prompt_id = new.prompt_id) AS INTEGER);
INSERT OR REPLACE INTO results_agg(model_id_a, model_id_b, s_votes, n_votes)
SELECT model_id_a, model_id_b, SUM(median_vote), COUNT(median_vote)
FROM results_per_prompt
WHERE (model_id_a = old.model_id_a AND model_id_b = old.model_id_b) OR (model_id_a = new.model_id_a AND model_id_b = new.model_id_b)
GROUP BY model_id_a, model_id_b;
END;

CREATE TRIGGER model_insert AFTER INSERT ON models BEGIN
INSERT INTO results_agg(model_id_a, model_id_b, s_votes, n_votes)
SELECT a.model_id, b.model_id, 0, 0
FROM models AS a
JOIN models AS b ON a.model_id < b.model_id
WHERE a.model_id = new.model_id OR b.model_id = new.model_id;
END;

CREATE TRIGGER prompt_insert AFTER INSERT ON prompts BEGIN
INSERT INTO results_per_prompt(model_id_a, model_id_b, prompt_id, median_vote, n_votes)
SELECT a.model_id, b.model_id, new.prompt_id, NULL, 0
FROM models AS a
JOIN models AS b ON a.model_id < b.model_id;
END;

CREATE TABLE rate_limit (
ip_hash TEXT NOT NULL,
timestamp REAL NOT NULL,
PRIMARY KEY(ip_hash, timestamp)
) WITHOUT ROWID;

COMMIT;
