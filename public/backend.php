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

if($_SERVER['REQUEST_METHOD'] !== 'POST') {
	$reply = [
		'status' => 'client-error',
		'error' => 'only POST requests are allowed',
	];
} else if(!isset($_GET['a'])) {
	$reply = [
		'status' => 'client-error',
		'error' => 'no action',
	];
} else if($_GET['a'] === 'models') {
	require realpath(__DIR__).'/../common.php';
	$reply = [
		'status' => 'ok',
		'models' => [],
	];
	$q = $db->query('SELECT model_name FROM models ORDER BY model_name ASC;');
	while($m = $q->fetchArray(\SQLITE3_NUM)) {
		$reply['models'][] = $m[0];
	}
} else {
	$reply = [
		'status' => 'client-error',
		'error' => 'unknown action',
	];
}

if(!isset($reply)) {
	$reply = [
		'status' => 'server-error',
		'error' => 'backend did not generate a reply',
	];
}

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
