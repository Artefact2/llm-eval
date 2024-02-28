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

CREATE INDEX votes_results ON votes(model_name_a, model_name_b, vote);

CREATE VIEW results AS
SELECT COUNT(session_id)
FROM votes
GROUP BY(model_name_a, model_name_b, vote);

COMMIT;
