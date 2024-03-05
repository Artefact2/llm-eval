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

let models = {};

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

const parse_and_sanitize_md = s => {
	const config = {
		PARSER_MEDIA_TYPE: 'application/xhtml+xml',
		RETURN_DOM_FRAGMENT: true,
		ALLOWED_TAGS: [
			"a", "article", "b", "blockquote", "br", "caption", "code", "del", "details", "div", "em",
			"h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins", "kbd", "li", "main", "ol",
			"p", "pre", "section", "span", "strike", "strong", "sub", "summary", "sup", "table",
			"tbody", "td", "th", "thead", "tr", "u", "ul", "#text",
		],
		KEEP_CONTENT: true,
	};
	let frag = DOMPurify.sanitize(marked.parse(s), config);
	if(frag) return frag;
	/* some prompts/answers have things that *look* like HTML, but are not
	 * (eg, C++ templates like Foo<Bar>), and this trips up the sanitizer.
	 * fall back to raw text in this case. */
	frag = document.createElement('div');
	frag.setAttribute('style', 'white-space: pre-wrap;');
	frag.textContent = s;
	return frag;
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
			$("div#voting-ui-prompt").empty().append(parse_and_sanitize_md(data.pair.prompt));
			chop_element($("div#voting-ui-a").empty().append(parse_and_sanitize_md(data.pair.answer_a))[0], 0, 30);
			chop_element($("div#voting-ui-b").empty().append(parse_and_sanitize_md(data.pair.answer_b))[0], 0, 30);
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
		let operand, mna = models[cpair.pair.model_id_a], mnb = models[cpair.pair.model_id_b];
		if(cpair.vote === -1)     operand = ' > ';
		else if(cpair.vote === 0) operand = ' = ';
		else                      operand = ' < ';
		if(data.swap) {
			operand = mnb + operand + mna;
		} else {
			operand = mna + operand + mnb;
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

const format_votes_results = (element, s_votes, n_votes) => {
	if(n_votes === 0) {
		/* no data */
		return;
	}

	/* get a win frequency in [0;1] */
	let f = 1.0 - (s_votes/n_votes + 1.0) / 2.0;
	/* 99% lower bound, https://en.wikipedia.org/wiki/Standard_normal_table */
	let s = 2.33 * 0.5/Math.sqrt(n_votes);

	let cont = document.createElement('div'), row = document.createElement('div');
        cont.appendChild(row);
	element.appendChild(cont);
	cont.setAttribute('class', 'container-fluid');
	row.setAttribute('class', 'row');
	let pbar = document.createElement('div');
	element.appendChild(pbar);
	pbar.setAttribute('class', 'progress');
	pbar.setAttribute('style', 'height: 2px;');

        let col = document.createElement('div');
	row.appendChild(col);
	col.classList.add('col-6');
        col.classList.add('ps-0');
	col.classList.add('text-start');
	if(f-s > 0.005) {
		col.textContent = (new Intl.NumberFormat(undefined, {style: "percent"})).format(f-s);
		col.classList.add('text-success');
		if(f-s > 0.5) col.classList.add('fw-bold');
		let pbe = document.createElement('div');
		pbar.appendChild(pbe);
		pbe.setAttribute('class', 'progress-bar bg-success');
		pbe.setAttribute('style', 'width: ' + (100.0 * (f-s)).toFixed(2) + '%;');
	} else {
		col.textContent = '0%';
		col.classList.add('text-body-tertiary');
	}
	let pbe = document.createElement('div');
	pbar.appendChild(pbe);
	pbe.setAttribute('class', 'progress-bar bg-dark');
	pbe.setAttribute('style', 'width: ' + (100.0 * (1 - Math.max(0.0, f-s) - Math.max(0.0, 1-f-s))).toFixed(2) + '%;');
	col = document.createElement('div');
	row.appendChild(col);
	col.classList.add('col-6');
	col.classList.add('pe-0');
	col.classList.add('text-end');
	if(f+s < .995) {
		col.textContent = (new Intl.NumberFormat(undefined, {style: "percent"})).format(1-f-s);
		col.classList.add('text-danger');
		if(f+s < 0.5) col.classList.add('fw-bold');
		let pbe = document.createElement('div');
		pbar.appendChild(pbe);
		pbe.setAttribute('class', 'progress-bar bg-danger');
		pbe.setAttribute('style', 'width: ' + (100.0 * (1-f-s)).toFixed(2) + '%;');
	} else {
		col.textContent = '0%';
		col.classList.add('text-body-tertiary');
	}
};

const format_results = (element, data) => {
	let heading = document.createElement('h5');
	element.appendChild(heading);
	heading.textContent = 'Pairwise preference rate (lower bound, 99% confidence)';

	/* XXX: making a lot of assumptions here wrt model names */
	let table_name = k => k.match(/^(.+)[-.](q|iq|f|bf)[1-8]/i)[1];
	let quant_name = k => k.match(/(^|[-.])((q|iq|f|bf)[1-8](.*?))([-.]|$)/i)[2];
	let row_name = k => 'prefers ' + quant_name(k);
	let col_name = k => 'vs ' + quant_name(k);
	let table = document.createElement('table');
	element.appendChild(table);
	table.setAttribute('data-ts', (new Date()).getTime());
        table.classList.add('table');
	table.classList.add('table-striped');

	let thead = document.createElement('thead');
	table.appendChild(thead);
        for(let a in data.results) {
		let tr = document.createElement('tr');
		let th = document.createElement('th');
		th.append(document.createTextNode(table_name(models[a])));
		tr.appendChild(th);
		thead.appendChild(tr);
		for(let b in data.results[a]) {
			let th = document.createElement('th');
			th.appendChild(document.createTextNode(col_name(models[b])));
			tr.appendChild(th);
		}
		break;
	}

	let tbody = document.createElement('tbody');
	table.appendChild(tbody);
	for(let a in data.results) {
		let tr = document.createElement('tr');
		let th = document.createElement('th');
		th.append(document.createTextNode(row_name(models[a])));
		tr.appendChild(th);
		tbody.appendChild(tr);
		for(let b in data.results[a]) {
			let td = document.createElement('td');
			if(a > b) {
				format_votes_results(
					td,
					data.results[a][b][0],
					data.results[a][b][1]
				);
			}
			tr.appendChild(td);
		}
	}
	$(thead).find('tr > th:last-child').remove();
        $(tbody).find('tr:first-child, tr > td:last-child').remove();
};

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
				format_results(ch.empty()[0], data);
				ch.fadeIn(200);
			});
		});
	});
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
			select.empty();
			for(let model_id in models) {
				let optn = document.createElement('option');
				optn.setAttribute('value', model_id);
				optn.setAttribute('selected', 'selected');
				optn.textContent = models[model_id];
				select.append(optn);
			}
			select.prop('disabled', false);
			select.trigger('change');
			select.next('button').prop('disabled', false);
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
		if($("section#results div.collapse.show").length) return;
		$("div#results-global").prev().find('button').click();
	});

	for(let a of [ "global", "session" ]) {
		(a => {
			let div = $("div#results-" + a);
			div.prev().find('button').on('click', () => {
				/* XXX: also fires when hiding */
                                maybe_refresh_results(a);
			});
		})(a);
	}

	post({ a: 'models' }, data => {
		models = data.models;

		addEventListener("hashchange", e => {
			show_section(window.location.hash.substring(1));
		});
		if(window.location.hash.length > 1) {
			show_section(window.location.hash.substring(1), 0);
		} else {
			window.location.hash = "#play";
		}
	});
});
