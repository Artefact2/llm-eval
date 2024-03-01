<?php

return [
	/* generate one yourself, with eg $(xxd -c 32 -p -l 32 /dev/urandom) */
	'hmac_secret' => '',
	/* will be passed to llama.cpp server binary */
	'server_args' => function(string $model_path): string {
		return '-ngl 999';
	},
];
