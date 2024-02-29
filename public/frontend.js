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

const error_alert = message => {
	let div = $(document.createElement('div'));
	div.addClass('alert alert-danger alert-dismissible fade show mb-0');
	div.append(document.createTextNode(message));
	let btn = $(document.createElement('button'));
	btn.attr('type', 'button');
	btn.addClass('btn-close');
	btn.attr('data-bs-dismiss', 'alert');
	div.append(btn);
	$("body > nav.navbar").after(div);
};

const post = (params, success) => {
	$.post({
		url: 'backend.php?' + (new URLSearchParams(params)).toString(),
		dataType: 'json',
		success: data => {
			if(!("status" in data) || data.status !== "ok") {
				error_alert("Backend returned an error: " + JSON.stringify(data));
				return;
			}
			success(data);
		},
		error: (jqxhr, status) => {
			error_alert("Backend request errored out (" + status + ": " + jqxhr.responseText + "). Open the console for more details.");
			console.error(jqxhr);
		},
	});
};

const load_voting_pair = () => {
	let selected = $("div#model-select option").filter(':selected');
	let selected_vals = [];
	for(let opt of selected) {
		selected_vals.push(opt.value);
	}
	post({
		a: 'get-voting-pair',
		models: JSON.stringify(selected_vals),
	}, data => {
		/* XXX: add fancy animations */
		$("div#voting-ui").data('current-pair', data);
		$("div#voting-ui-a, div#voting-ui-b, div#voting-ui-prompt").empty();
		$("div#voting-ui-prompt").append(document.createTextNode(data.pair.prompt));
		$("div#voting-ui-a").append(document.createTextNode(data.pair.answer_a));
		$("div#voting-ui-b").append(document.createTextNode(data.pair.answer_b));
		$("div#voting-ui button").prop('disabled', false);

	});
};

$(() => {
	$('div#javascript-check').remove();

	let disclaimer_shown = false;
	$("section#play").on('my-show', () => {
		if(disclaimer_shown === true) return;
		(new bootstrap.Modal('#disclaimer-modal', {})).show();
		disclaimer_shown = true;

                if($("div#model-select span.badge > div.spinner-border").length) {
			let select = $("div#model-select select");
			select.on('change', () => {
				let badge = $("div#model-select span.badge");
				badge.empty();
				badge.text(select.children(':selected').length + ' models selected');
			});
			post({ a: 'models' }, data => {
				select.empty();
				for(let model of data.models) {
					let optn = $(document.createElement('option'));
					optn.attr('value', model);
					optn.attr('selected', 'selected');
					optn.append(document.createTextNode(model));
					select.append(optn);
				}
				select.prop('disabled', false);
				select.trigger('change');
				select.next('button').prop('disabled', false);
			});
		}
	});

	$("div#model-select form").on('submit', function(e) {
		e.preventDefault();
                $("div#voting-ui button.accordion-button").click();
	});

	$("div#voting-ui button.accordion-button").on('click', function(e) {
		if($("div#voting-ui div.spinner-border").length === 0) return;
		load_voting_pair();
	});
	$("button#vote-skip").on('click', load_voting_pair);

	$("section#results").on('my-show', () => {
		/* fetch votes from backend */
		/* do fancy math */
		/* generate tables */
	});

	const show_section = (section_id, delay) => {
		if(delay === undefined) delay = 250;
                $("body > section").fadeOut(delay).promise().done(() => {
			$(document.getElementById(section_id))
				.removeClass('d-none')
				.hide()
				.trigger('my-show')
				.fadeIn(delay);
			$("body > nav.navbar a.active").removeClass('active');
			$("body > nav.navbar a[href='#" + section_id + "']").addClass('active');
		});
	};

        addEventListener("hashchange", e => {
                show_section(window.location.hash.substring(1));
	});
	if(window.location.hash.length > 1) {
		show_section(window.location.hash.substring(1), 0);
	} else {
		window.location.hash = "#play";
	}
});
