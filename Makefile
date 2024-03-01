fetch-deps: public/deps.js public/bootstrap.css

public/deps.js:
	curl "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" "https://code.jquery.com/jquery-3.7.1.min.js"  "https://cdn.jsdelivr.net/npm/marked/lib/marked.umd.js" "https://cdn.jsdelivr.net/npm/marked-xhtml/lib/index.umd.js" > $@.tmp
	mv -f $@.tmp $@

public/bootstrap.css:
	curl -o $@.tmp "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
	mv -f $@.tmp $@

host:
	@echo "Starting PHP's builtin web server. Browse to http://127.0.0.1:8080/index.xhtml to see the interface."
	php -S 127.0.0.1:8080 -t public

clean:
	rm -f public/deps.js public/bootstrap.css

.PHONY: host clean
