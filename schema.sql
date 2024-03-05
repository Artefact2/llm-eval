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

CREATE VIEW voting_pairs AS
SELECT sessions.session_id, prompts.prompt_id, prompt, a.model_id AS model_id_a, b.model_id AS model_id_b, a.answer AS answer_a, b.answer AS answer_b
FROM prompts -- for all prompts...
JOIN sessions -- and all sessions...
JOIN answers AS a ON a.prompt_id = prompts.prompt_id -- join first answer
LEFT JOIN voted_answers AS va ON va.session_id = sessions.session_id AND va.prompt_id = prompts.prompt_id AND va.model_id = a.model_id
JOIN answers AS b ON b.prompt_id = prompts.prompt_id AND a.model_id < b.model_id -- join second answer
LEFT JOIN voted_answers AS vb ON vb.session_id = sessions.session_id AND vb.prompt_id = prompts.prompt_id AND vb.model_id = b.model_id
WHERE va.session_id IS NULL AND vb.session_id IS NULL; -- anti join already voted on answers

CREATE INDEX votes_models_ab_session_id ON votes(session_id, model_id_a, model_id_b, vote);
CREATE VIEW results_per_session AS
SELECT session_id, model_id_a, model_id_b, SUM(vote) AS s_votes, COUNT(vote) AS n_votes
FROM votes
GROUP BY session_id, model_id_a, model_id_b;

CREATE INDEX votes_models_ab_prompt_id ON votes(model_id_a, model_id_b, prompt_id, vote);
CREATE VIEW results_per_prompt AS
SELECT model_id_a, model_id_b, prompt_id, AVG(vote) AS avg_vote
FROM votes
GROUP BY model_id_a, model_id_b, prompt_id;

CREATE TABLE results_agg (
model_id_a INTEGER,
model_id_b INTEGER,
s_votes REAL,
n_votes INTEGER,
PRIMARY KEY(model_id_a, model_id_b),
FOREIGN KEY(model_id_a) REFERENCES models(model_id),
FOREIGN KEY(model_id_a) REFERENCES models(model_id),
CHECK(model_id_a < model_id_b)
) WITHOUT ROWID;

CREATE TRIGGER results_agg_update AFTER INSERT ON votes BEGIN
INSERT OR REPLACE INTO results_agg(model_id_a, model_id_b, s_votes, n_votes)
SELECT model_id_a, model_id_b, SUM(avg_vote), COUNT(avg_vote)
FROM results_per_prompt
WHERE model_id_a = new.model_id_a AND model_id_b = new.model_id_b
GROUP BY model_id_a, model_id_b;
END;

CREATE TRIGGER results_agg_update AFTER DELETE ON votes BEGIN
INSERT OR REPLACE INTO results_agg(model_id_a, model_id_b, s_votes, n_votes)
SELECT model_id_a, model_id_b, SUM(avg_vote), COUNT(avg_vote)
FROM results_per_prompt
WHERE model_id_a = old.model_id_a AND model_id_b = old.model_id_b
GROUP BY model_id_a, model_id_b;
END;

CREATE TRIGGER results_agg_update AFTER UPDATE ON votes BEGIN
INSERT OR REPLACE INTO results_agg(model_id_a, model_id_b, s_votes, n_votes)
SELECT model_id_a, model_id_b, SUM(avg_vote), COUNT(avg_vote)
FROM results_per_prompt
WHERE (model_id_a = old.model_id_a AND model_id_b = old.model_id_b) OR (model_id_a = new.model_id_a AND model_id_b = new.model_id_b)
GROUP BY model_id_a, model_id_b;
END;

CREATE TABLE rate_limit (
ip_hash TEXT NOT NULL,
timestamp REAL NOT NULL,
PRIMARY KEY(ip_hash, timestamp)
) WITHOUT ROWID;

COMMIT;
