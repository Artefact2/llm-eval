<?php
/* Copyright 2024 Romain "Artefact2" Dal Maso <romain.dalmaso@artefact2.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

header('Content-Type: application/json');

/* should normally be overwritten */
$reply = [
	'status' => 'server-error',
	'error' => 'backend did not generate a reply',
];

register_shutdown_function(function() use(&$reply) {
	switch($reply['status'] ?? 'server-error') {
	case 'ok':
		break;
	case 'client-error':
		header('HTTP/1.1 400 Bad Request', true, 400);
		break;
	default:
		header('HTTP/1.1 500 Internal Server Error', true, 500);
	}

	echo json_encode($reply);
});


if($_SERVER['REQUEST_METHOD'] !== 'POST') {
	$reply = [
		'status' => 'client-error',
		'error' => 'only POST requests are allowed',
	];
	die();
}

$payload = json_decode(file_get_contents('php://input'), true);
if(!is_array($payload) || !isset($payload['a'])) {
	$reply = [
		'status' => 'client-error',
		'error' => 'payload parse error or no action specified',
	];
	die();
}

if($payload['a'] === 'models') {
	require realpath(__DIR__).'/../common.php';
	$q = $db->query('SELECT model_name FROM models ORDER BY model_name ASC;');
	if($q === false) {
		$reply = [
			'status' => 'server-error',
			'error' => 'db error',
		];
		die();
	}
	$reply = [
		'status' => 'ok',
		'models' => [],
	];
	while($m = $q->fetchArray(\SQLITE3_NUM)) {
		$reply['models'][] = $m[0];
	}
	die();
}

function hmac($anything): string {
	global $config;
	if(strlen($config['hmac_secret']) < 32) {
		trigger_error('hmac_secret not long enough (needs at least 32 characters), update your settings.php', \E_USER_ERROR);
		die(1);
	}
	return hash_hmac('sha256', json_encode($anything), $config['hmac_secret']);
}

function trim_ip(string $ip): string|false {
	$ip = inet_pton($ip);
	if($ip === false) return false;
	/* ipv4: keep entire address (4 bytes) */
	/* ipv6: keep /48 prefix (6 bytes) */
	return substr($ip, 6);
}

function get_session_id(): int|false {
	global $db;
	$ip = trim_ip($_SERVER['REMOTE_ADDR']);
	if($ip === false) return false;
	/* keep 28 bits of entropy from the ip address. it's a good balance
	 * between false positives and anonymity */
	$ip = substr(hmac($ip), 0, 7);
	$ua = $_SERVER['HTTP_USER_AGENT'] ?? false;
	if($ua === false) return false;
	$ua = substr(hmac([
		$_SERVER['HTTP_USER_AGENT'] ?? null,
		$_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? null,
		$_SERVER['HTTP_DNT'] ?? null,
	]), 0, 3); /* and 12 bits of entropy from client headers */
	$sid = $db->querySingle($sql = 'SELECT session_id FROM sessions WHERE ip_addr =\''.$ip.'\' AND user_agent = \''.$ua.'\';');
	if($sid === false) return false;
	if($sid !== null) return $sid;
	if(begin_immediate($db) === false) return false;
	$sid = $db->querySingle($sql);
	if($sid === false) return false;
	if($sid !== null) {
		$db->exec('ROLLBACK;');
		return $sid;
	}
	if($db->exec('INSERT INTO sessions(ip_addr, user_agent, timestamp) VALUES(\''.$ip.'\', \''.$ua.'\', '.time().');') === false) {
		$db->exec('ROLLBACK;');
		return false;
	}
	$sid = $db->lastInsertRowID();
	if($sid > 0 && $db->exec('COMMIT;') !== false) {
		return $sid;
	}
	$db->exec('ROLLBACK;');
	return false;
}

function should_swap(int $sid, int $pid, string $mna, string $mnb): bool {
	/* deterministically returns true about 50% of the time */
	return preg_match('/^[0-7]/', hmac([ $sid, $pid, $mna, $mnb ]));
}

if($payload['a'] === 'get-voting-pair') {
	require realpath(__DIR__).'/../common.php';
	$models = $payload['models'];
	if(!is_array($models) || count($models) < 2) {
		$reply = [
			'status' => 'client-error',
			'error' => 'at least 2 models must be selected',
		];
		die();
	}
	$sid = get_session_id();
	if($sid === false) {
		$reply = [ 'status' => 'server-error', 'error' => 'failed to generate sid' ];
		die();
	}
	$p = $db->prepare('SELECT session_id, prompt_id, model_name_a, model_name_b, prompt, answer_a, answer_b FROM voting_pairs WHERE session_id = :sid AND model_name_a IN (SELECT value FROM json_each(:models)) AND model_name_b IN (SELECT value FROM json_each(:models)) ORDER BY random() LIMIT 1;');
	$p->bindValue(':sid', $sid);
	$p->bindValue(':models', json_encode($models));
	$pair = $p->execute()->fetchArray(\SQLITE3_ASSOC);
	if(!isset($pair['prompt_id'])) {
		$reply = [ 'status' => 'server-error', 'error' => 'failed to fetch a voting pair' ];
		die();
	}

	if(should_swap($pair['session_id'], $pair['prompt_id'], $pair['model_name_a'], $pair['model_name_b'])) {
		$old = $pair['answer_a'];
		$pair['answer_a'] = $pair['answer_b'];
		$pair['answer_b'] = $old;
	}

	foreach([ 'prompt', 'answer_a', 'answer_b' ] as $k) {
		$pair[$k] = trim($pair[$k]);
	}

	$reply = [
		'status' => 'ok',
		'pair' => $pair,
		'hmac' => hmac($pair),
	];
	die();
}

if($payload['a'] === 'submit-voting-pair') {
	require realpath(__DIR__).'/../common.php';
	if(hmac($payload['pair']) !== $payload['hmac']) {
		$reply = [
			'status' => 'client-error',
			'error' => 'hmac mismatch',
		];
		die();
	}
	if(isset($payload['vote']) && ($swap = should_swap(
		$payload['pair']['session_id'],
		$payload['pair']['prompt_id'],
		$payload['pair']['model_name_a'],
		$payload['pair']['model_name_b']))) {
		$payload['vote'] = -$payload['vote'];
	}
	/* XXX: implement rate limiting */
	/* let the db constraint check for vote in [-1,0,1] */
	$stmt = $db->prepare('INSERT INTO votes(session_id, prompt_id, model_name_a, model_name_b, vote, timestamp) VALUES(:sid, :pid, :mna, :mnb, :vote, :ts);');
	$stmt->bindValue(':sid', $payload['pair']['session_id']);
	$stmt->bindValue(':pid', $payload['pair']['prompt_id']);
	$stmt->bindValue(':mna', $payload['pair']['model_name_a']);
	$stmt->bindValue(':mnb', $payload['pair']['model_name_b']);
	$stmt->bindValue(':vote', $payload['vote']);
	$stmt->bindValue(':ts', time());
	if($stmt->execute() === false) {
		$reply = [
			'status' => 'server-error',
			'error' => 'db failure',
		];
		die();
	}
	$reply = [ 'status' => 'ok', 'swap' => $swap ];
	die();
}

$reply = [
	'status' => 'client-error',
	'error' => 'unknown action',
];
