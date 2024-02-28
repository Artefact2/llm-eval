# llm-eval

A super simple web interface to perform blind tests on LLM outputs. Released
under the Apache License, version 2.0.

Dependencies: PHP, SQLite3.

# Quickstart guide

```
git clone https://github.com/ggerganov/llama.cpp
make -C llama.cpp server

sqlite3 db.sqlite < schema.sql

# prompts.json should be an array of strings
./import-prompts < prompts.json

# args: path to model file, instruct prefix, instruct suffix, json array of stop sequences
parallel -n1 -j1 --ungroup ./generate-answers {} '[INST]' '[/INST]' '["[/INST]"]' ::: models/*.gguf
```
