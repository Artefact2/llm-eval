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

if(!isset($_GET['a'])) {
	$reply = [
		'status' => 'client-error',
		'error' => 'no action',
	];
	die();
}

if($_GET['a'] === 'models') {
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
	return hash_hmac('sha256', json_encode($anything), $config['hmac_secret']);
}

function get_session_id(): int|false {
	global $db;
	$ip = inet_pton($_SERVER['REMOTE_ADDR']);
	if($ip === false) return false;
	/* ipv4: keep entire address (4 bytes) */
	/* ipv6: keep /48 prefix (6 bytes) */
	$ip = hmac(substr($ip, 6));
	$ua = $_SERVER['HTTP_USER_AGENT'] ?? false;
	if($ua === false) return false;
	$ua = hmac($ua);
	$db->exec('BEGIN;');
	$sid = $db->querySingle('SELECT session_id FROM sessions WHERE ip_addr =\''.$ip.'\' AND user_agent = \''.$ua.'\'');
	if($sid === false) return false;
	if($sid !== null) return $sid;
	if($db->exec('INSERT INTO sessions(ip_addr, user_agent, timestamp) VALUES(\''.$ip.'\', \''.$ua.'\', '.time().');') === false) return false;
	$sid = $db->lastInsertRowID();
	if($sid > 0 && $db->exec('COMMIT;') !== false) {
		return $sid;
	}
	return false;
}

if($_GET['a'] === 'get-voting-pair') {
	require realpath(__DIR__).'/../common.php';
	$models = json_decode($_GET['models'], true);
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

	/* deterministically swap the answer, 50% of the time */
	if(ord(hmac([ $pair['session_id'], $pair['answer_a'], $pair['answer_b'] ])) < 128) {
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

if($_GET['a'] === 'submit-voting-pair') {
	require realpath(__DIR__).'/../common.php';
	die();
}

$reply = [
	'status' => 'client-error',
	'error' => 'unknown action',
];
