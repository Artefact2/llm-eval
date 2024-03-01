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

const chop_text = (text, delay, delay_inc) => {
	let dfrag = document.createElement('span');
	let chopped = text.split(/(\p{P}|\p{Z})/u);
	let make_span = (delay) => {
		let span = document.createElement('span');
		span.setAttribute('class', 'typewrite');
		span.setAttribute('style', 'animation-delay: ' + delay + 'ms;');
		return span;
	};
        let span = make_span(delay);
	delay += delay_inc;
	for(let frag of chopped) {
		span.appendChild(document.createTextNode(frag));
                if(frag.match(/^(\p{P}|\p{Z})*$/u) === null) {
			dfrag.appendChild(span);
			span = make_span(delay);
			delay += delay_inc;
		}
	}
	dfrag.appendChild(span);
	return [ dfrag, delay ];
};

const chop_element = (element, delay, delay_inc) => {
	for(let i = 0; i < element.childNodes.length; ++i) {
		let ch = element.childNodes[i];
                if(ch.nodeType === 3) {
			/* text node */
			let chopped = chop_text(ch.wholeText, delay, delay_inc);
			element.replaceChild(chopped[0], ch);
			delay = chopped[1];
		} else if(ch.nodeType === 1) {
			/* element node */
			ch.classList.add('typewrite');
			ch.setAttribute('style', 'animation-delay: ' + delay + 'ms;');
			delay = chop_element(ch, delay, delay_inc);
		}
	}
	return delay;
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
                $("div#voting-ui").data('current-pair', data);
		$("div#voting-ui-a, div#voting-ui-b, div#voting-ui-prompt").fadeOut(200).promise().done(() => {
			$("div#voting-ui-a, div#voting-ui-b, div#voting-ui-prompt").empty().fadeIn(200);
			$("div#voting-ui-prompt").html(marked.parse(data.pair.prompt));
			chop_element($("div#voting-ui-a").html(marked.parse(data.pair.answer_a))[0], 0, 30);
			chop_element($("div#voting-ui-b").html(marked.parse(data.pair.answer_b))[0], 0, 30);
			$("div#voting-ui div.overflow-y-scroll").scrollTop(0);
			setTimeout(() => { $("div#voting-ui button").prop('disabled', false); }, 5000);

		});
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
		alert.setAttribute('class', 'alert alert-success');
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

const format_results_table = data => {
	/* XXX: making a lot of assumptions here wrt model names */
	let table_name = k => k.match(/^(.+)[-.](q|iq|f|bf)[1-8]/i)[1];
	let row_name = k => k.match(/(^|[-.])((q|iq|f|bf)[1-8](.*?))([-.]|$)/i)[2];
	let col_name = row_name;
	let table = document.createElement('table'), tbody = document.createElement('tbody');
	table.setAttribute('data-ts', (new Date()).getTime());
	table.appendChild(tbody);
	table.classList.add('table');
	for(let a in data.results) {
		let thead = document.createElement('thead');
		let tr = document.createElement('tr');
		let th = document.createElement('th');
		th.append(document.createTextNode(table_name(a)));
		tr.appendChild(th);
		table.appendChild(thead);
		thead.appendChild(tr);
		for(let b in data.results[a]) {
			let th = document.createElement('th');
			th.appendChild(document.createTextNode(col_name(b)));
			tr.appendChild(th);
		}
		break;
	}
	for(let a in data.results) {
		let tr = document.createElement('tr');
		let th = document.createElement('th');
		th.append(document.createTextNode(row_name(a)));
		tr.appendChild(th);
		tbody.appendChild(tr);
		for(let b in data.results[a]) {
			let td = document.createElement('td');
			td.appendChild(document.createTextNode(JSON.stringify(data.results[a][b])));
			tr.appendChild(td);
		}
	}
	return table;
};

$(() => {
	$('div#javascript-check').remove();
	marked.use(markedXhtml.markedXhtml());

	let disclaimer_shown = false;
	$("section#play").on('my-show', () => {
		if(disclaimer_shown === true) return;
		(new bootstrap.Modal('#disclaimer-modal', {})).show();
		disclaimer_shown = true;

		let badge = $("div#model-select").closest("div.accordion-item").find("span.badge");
                if(badge.find('div.spinner-border').length) {
			let select = $("div#model-select select");
			select.on('change', () => {
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
                $("div#voting-ui").closest("div.accordion-item").find("button.accordion-button").click();
	});

	$("div#voting-ui").closest("div.accordion-item").find("button.accordion-button").on('click', function(e) {
		if($("div#voting-ui div.spinner-border").length === 0) return;
		load_voting_pair();
	});
	$("button#vote-skip").on('click', () => { submit_vote(); });
	$("button#vote-draw").on('click', () => { submit_vote(0); });
	$("button#vote-a").on('click', () => { submit_vote(-1); });
	$("button#vote-b").on('click', () => { submit_vote(1); });

	$("section#results").on('my-show', () => {
		$("div#results-global").prev().find('button').click();
	});
	const maybe_refresh_results = a => {
		let div = $("div#results-" + a);
		let table = div.find('table');
		if(table.length && ((new Date()).getTime() - parseInt(table.data('ts'))) < 10000) return;
		let ch = div.children('div.accordion-body');
                ch.fadeOut(200).promise().done(() => {
                        ch.empty();
			let spinner = document.createElement('div'), span = document.createElement('span');
			spinner.setAttribute('class', 'spinner-border');
			spinner.appendChild(span);
			span.setAttribute('class', 'visually-hidden');
			span.appendChild(document.createTextNode('Loading...'));
			ch.empty().append(spinner);
			ch.fadeIn(200);
			post({ a: 'get-results-' + a }, data => {
				ch.fadeOut(200).promise().done(() => {
					ch.empty().append(format_results_table(data));
					ch.fadeIn(200);
				});
			});
		});
	};
	for(let a of [ "global", "session" ]) {
		(a => {
			$("div#results-" + a).prev().find('button').on('click', () => {
				maybe_refresh_results(a);
			});
		})(a);
	}

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
