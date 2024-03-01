BEGIN;

CREATE TABLE prompts (
prompt_id INTEGER NOT NULL,
prompt TEXT NOT NULL,
PRIMARY KEY(prompt_id)
);

CREATE TABLE answers (
prompt_id INTEGER NOT NULL,
model_name TEXT NOT NULL,
answer TEXT NOT NULL,
PRIMARY KEY(prompt_id, model_name),
FOREIGN KEY(prompt_id) REFERENCES prompts(prompt_id)
);

CREATE INDEX answers_model_name ON answers(model_name);

CREATE VIEW models AS
SELECT DISTINCT model_name
FROM answers;

CREATE TABLE sessions (
session_id INTEGER NOT NULL,
ip_addr TEXT NOT NULL,
user_agent TEXT NOT NULL,
timestamp INTEGER NOT NULL,
PRIMARY KEY(session_id)
);

CREATE INDEX sessions_ip_addr_user_agent ON sessions(ip_addr, user_agent);

CREATE TABLE votes (
session_id INTEGER NOT NULL,
prompt_id INTEGER NOT NULL,
model_name_a TEXT NOT NULL,
model_name_b TEXT NOT NULL,
vote INTEGER NOT NULL,
timestamp INTEGER NOT NULL,
PRIMARY KEY(session_id, prompt_id, model_name_a, model_name_b),
FOREIGN KEY(session_id) REFERENCES sessions(session_id),
FOREIGN KEY(prompt_id, model_name_a) REFERENCES answers(prompt_id, model_name),
FOREIGN KEY(prompt_id, model_name_b) REFERENCES answers(prompt_id, model_name),
CHECK(vote IN(-1, 0, 1)),
CHECK(model_name_a < model_name_b)
);

CREATE INDEX votes_models_ab_prompt_id ON votes(model_name_a, model_name_b, prompt_id);
CREATE INDEX votes_models_ab_session_id ON votes(session_id, model_name_a, model_name_b);

CREATE VIEW voting_pairs AS
SELECT sessions.session_id, prompts.prompt_id, prompt, a.model_name AS model_name_a, b.model_name AS model_name_b, a.answer AS answer_a, b.answer AS answer_b
FROM prompts -- for all prompts...
JOIN sessions -- and all sessions...
JOIN answers AS a ON a.prompt_id = prompts.prompt_id -- join first answer
LEFT JOIN votes AS va ON va.session_id = sessions.session_id AND va.prompt_id = prompts.prompt_id AND a.model_name IN(va.model_name_a, va.model_name_b)
JOIN answers AS b ON b.prompt_id = prompts.prompt_id AND a.model_name < b.model_name -- join second answer
LEFT JOIN votes AS vb ON vb.session_id = sessions.session_id AND vb.prompt_id = prompts.prompt_id AND b.model_name IN(vb.model_name_a, vb.model_name_b)
WHERE va.session_id IS NULL AND vb.session_id IS NULL; -- anti join already answered models

CREATE VIEW results_per_prompt AS
SELECT model_name_a, model_name_b, prompt_id, AVG(vote) AS avg_vote, COUNT(vote) AS n_votes
FROM votes
GROUP BY model_name_a, model_name_b, prompt_id;

CREATE VIEW results_agg AS
SELECT model_name_a, model_name_b, SUM(avg_vote) AS s_votes, COUNT(avg_vote) AS n_prompts, SUM(n_votes) AS n_votes
FROM results_per_prompt
GROUP BY model_name_a, model_name_b;

CREATE VIEW results_per_session AS
SELECT model_name_a, model_name_b, session_id, SUM(vote) AS s_votes, COUNT(vote) AS n_votes
FROM votes
GROUP BY model_name_a, model_name_b, session_id;

CREATE TABLE rate_limit (
ip_hash TEXT NOT NULL,
timestamp REAL NOT NULL,
PRIMARY KEY(ip_hash, timestamp)
) WITHOUT ROWID;

COMMIT;
