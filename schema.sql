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

CREATE INDEX votes_results ON votes(model_name_a, model_name_b, vote);

CREATE VIEW voting_pairs AS
SELECT sessions.session_id, prompts.prompt_id, prompt, a.model_name AS model_name_a, b.model_name AS model_name_b, a.answer AS answer_a, b.answer AS answer_b
FROM prompts -- for all prompts...
JOIN sessions -- and all sessions...
JOIN answers AS a ON a.prompt_id = prompts.prompt_id -- grab all the answers
LEFT JOIN votes AS va ON va.session_id = sessions.session_id AND va.prompt_id = prompts.prompt_id AND (va.model_name_a = a.model_name OR va.model_name_b = a.model_name) AND va.session_id IS NULL -- anti join already voted-on answers
JOIN answers AS b ON b.prompt_id = prompts.prompt_id AND a.model_name < b.model_name
LEFT JOIN votes AS vb ON vb.session_id = sessions.session_id AND vb.prompt_id = prompts.prompt_id AND (vb.model_name_a = b.model_name OR vb.model_name_b = b.model_name) AND vb.session_id IS NULL;

CREATE VIEW results AS
SELECT COUNT(session_id)
FROM votes
GROUP BY(model_name_a, model_name_b, vote);

COMMIT;
