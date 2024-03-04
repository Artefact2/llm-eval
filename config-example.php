<?php

return [
	/* generate one yourself, with eg $(xxd -c 32 -p -l 32 /dev/urandom) */
	'hmac_secret' => '',
	/* if you have lots of prompts, increase this to 1,2,3... etc to reduce the number of voting pairs */
	'prune_voting_pairs' => 0,
	/* will be passed to llama.cpp server binary */
	'server_args' => function(string $model_path): string { return '-cb -np 8 -c 32768 -ngl 999'; },
	/* rate limits: array of [ num_seconds => max_requests, ... ], set to
	 * empty array [] to disable, keep sorted in descending key order */
	'rate_limits' => [ 600 => 120, 180 => 60 ],
	/* returns the IP of the client, if you have a proxy you might want HTTP_X_FORWARDED_FOR here */
	'remote_addr' => function() { return $_SERVER['REMOTE_ADDR']; },
	/* if the whitelist returns true, access is allowed and the blacklist is not checked. */
	'whitelist' => function(string $ip): bool { return false; },
	/* if the blacklist returns true, access is denied. */
	'blacklist' => function(string $ip): bool { return false; },
	/* sample blacklist implementation: blocks tor exits, vpns and datacenters
	 * run $(./fetch-blacklist > blacklist.php) then uncomment the line below */
	// 'blacklist' => require __DIR__.'/blacklist.php';
];
