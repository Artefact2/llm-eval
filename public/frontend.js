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

const post = (params, success, complete) => {
	$.post({
		url: 'backend.php',
		data: JSON.stringify(params),
		contentType: 'application/json; charset=utf-8',
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
		complete: (jqxhr, status) => {
			if(complete !== undefined) complete(jqxhr, status);
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
		models: selected_vals,
	}, data => {
		/* XXX: add fancy animations */
		$("div#voting-ui").data('current-pair', data);
		$("div#voting-ui-a, div#voting-ui-b, div#voting-ui-prompt").empty();
		$("div#voting-ui-prompt").append(document.createTextNode(data.pair.prompt));
		$("div#voting-ui-a").append(document.createTextNode(data.pair.answer_a));
		$("div#voting-ui-b").append(document.createTextNode(data.pair.answer_b));
		$("div#voting-ui div.overflow-y-scroll").scrollTop(0);
		setTimeout(() => { $("div#voting-ui button").prop('disabled', false); }, 5000);
	}, () => {
		setTimeout(() => { $("button#vote-skip").prop('disabled', false); }, 5000);
	});
};

const submit_vote = score => {
        $("div#voting-ui button").prop('disabled', true);
	if(score === undefined) {
		/* not actually voting, just skipping this prompt */
		load_voting_pair();
		return;
	}

	let outer = document.createElement('div'), spinner = document.createElement('div'), span = document.createElement('span');
	spinner.setAttribute('class', 'spinner-border spinner-border');
	span.setAttribute('class', 'visually-hidden');
	span.appendChild(document.createTextNode('Loading...'));
	spinner.appendChild(span);
	outer.setAttribute('class', 'spinner-outer mt-2 text-center');
	outer.appendChild(spinner);
	$("div#vote-feedback").empty().append(outer);

	let cpair = $("div#voting-ui").data('current-pair');
	cpair.a = 'submit-voting-pair';
	cpair.vote = score;
	post(cpair, data => {
                let operand;
		if(cpair.vote === -1)     operand = ' > ';
		else if(cpair.vote === 0) operand = ' = ';
		else                      operand = ' < ';
		if(data.swap) {
                        operand = cpair.pair.model_name_b + operand + cpair.pair.model_name_a;
		} else {
			operand = cpair.pair.model_name_a + operand + cpair.pair.model_name_b;
		}
                let alert = document.createElement('div'), strong = document.createElement('strong');
		alert.setAttribute('class', 'alert alert-success mt-2');
		alert.appendChild(document.createTextNode('Vote successful! '));
		strong.appendChild(document.createTextNode(operand));
		alert.appendChild(strong);
		alert.appendChild(document.createTextNode(' for prompt ' + cpair.pair.prompt_id + '.'));
		$("div#vote-feedback").fadeOut(200).promise().done(() => {
			$("div#vote-feedback").empty().append(alert).fadeIn(200);
		});
		load_voting_pair();
	}, () => {
                setTimeout(() => {
			$("div#voting-ui button").prop('disabled', false);
			$("div#vote-feedback > div.spinner-outer").remove();
		}, 5000);
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
	$("button#vote-skip").on('click', () => { submit_vote(); });
	$("button#vote-draw").on('click', () => { submit_vote(0); });
	$("button#vote-a").on('click', () => { submit_vote(-1); });
	$("button#vote-b").on('click', () => { submit_vote(1); });

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
