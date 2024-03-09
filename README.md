# llm-eval

A super simple web interface to perform blind tests on LLM outputs. Released
under the Apache License, version 2.0.

Dependencies: PHP, SQLite3.

[**See a live demo here.**](https://freya.artefact2.com/llm-eval/)

# Quickstart guide

```
git clone https://github.com/ggerganov/llama.cpp
make -C llama.cpp server

sqlite3 db.sqlite < schema.sql

cp config{-example,}.php
$EDITOR config.php

# prompts.json should be an array of strings
# (or populate the prompts table on your own)
./import-prompts < prompts.json

# generate-answer args:
# - path to model file,
# - instruct prefix,
# - instruct suffix,
# - json array of stop sequences,
# - comma-separated worker index and worker count
# (or populate the answers table on your own)
parallel -n1 -j1 --ungroup ./generate-answers {} '[INST]' '[/INST]' '["[/INST]"]' 10 ::: ./models/*.gguf

make fetch-deps
make host
```

# Updating

```
git pull

# check for changes in the default configuration file
git diff master@{1}..master config-example.php

# check for schema updates
git log --grep='^schema[,:]' --reverse master@{1}..master
```
