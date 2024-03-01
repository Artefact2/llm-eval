<?php

return [
	/* generate one yourself, with eg $(xxd -c 32 -p -l 32 /dev/urandom) */
	'hmac_secret' => '',
	/* will be passed to llama.cpp server binary */
	'server_args' => function(string $model_path): string { return '-ngl 999'; },
	/* if the whitelist returns true, access is allowed and the blacklist is not checked. */
	'whitelist' => function(string $ip): bool { return false; },
	/* if the blacklist returns true, access is denied. */
	'blacklist' => function(string $ip): bool { return false; },
	/* sample blacklist implementation: blocks tor exits, vpns and datacenters
	 * run $(./fetch-blacklist > blacklist.php) then uncomment the line below */
	// 'blacklist' => require __DIR__.'/blacklist.php';
];
