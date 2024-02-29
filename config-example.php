<?php

return [
	/* generate one yourself, with eg $(xxd -c 32 -p -l 32 /dev/urandom) */
	'hmac_secret' => '',

	'server_args' => function(string $server_path): string {
		return '-ngl 999';
	},
];
