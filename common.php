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

$config = require __DIR__.'/config.php';

$db = new \SQLite3(__DIR__.'/db.sqlite', \SQLITE3_OPEN_READWRITE);
$db->exec('PRAGMA journal_mode = WAL;');
$db->exec('PRAGMA busy_timeout = 15000;');

function begin_immediate($db): bool {
	for($i = 0; $i < 5; ++$i) {
		if($db->exec('BEGIN IMMEDIATE') === true) return true;
		if($i === 4) return false;
		usleep(500000);
	}
}
